---
title: 用go写jvm之搜索class文件
date: 2023-05-23 21:12:27
tags:
  - Go
  - 项目
  - JVM
---
java虚拟机首先要做的事情就是搜索class文件，这里我们用go来实现搜索class文件的功能。
<!-- more -->
## 整体流程
Oracle的Java虚拟机根据类路径来搜索类，
我们可以创建类路径，存储类路径项。

> 类路径可以分为启动类路径，扩展类路径，用户类路径
> 类路径项可以分为普通Entry，目录Entry，压缩包或JarEntry，复合Entry

## 类路径
````Golang
// ClassPath 结构体，存放三种类路径
type ClassPath struct {
	// 启动类路径
	bootClasspath Entry
	// 扩展类路径
	extClasspath Entry
	// 用户类路径
	userClasspath Entry
}

// Parse 解析类路径
func Parse(jreOption, cpOption string) *ClassPath {
	cp := &ClassPath{}
	// 解析启动类路径和扩展类路径
	cp.parseBootAndExtClasspath(jreOption)
	// 解析用户类路径
	cp.parseUserClasspath(cpOption)

	return cp
}

// parseBootAndExtClasspath 解析启动类路径和扩展类路径
func (self *ClassPath) parseBootAndExtClasspath(jreOption string) {
	// 对jre目录进行判断
	jreDir := getJreDir(jreOption)

	// jre/lib/* 解析启动类路径
	jreLibPath := filepath.Join(jreDir, "lib", "*")
	self.bootClasspath = newWildcardEntry(jreLibPath)

	// jre/lib/ext/* 解析扩展类路径
	jreExtPath := filepath.Join(jreDir, "lib", "ext", "*")
	self.extClasspath = newWildcardEntry(jreExtPath)
}

// 辅助函数 getJreDir 获取jre目录
// 优先使用用户输入-Xjre选项作为jre目录，
// 如果没有，就用当前目录下的jre目录，如果找不到，就尝试使用JAVA_HOME环境变量
func getJreDir(jreOption string) string {
	if jreOption != "" && exists(jreOption) {
		return jreOption
	}
	if exists("./jre") {
		return "./jre"
	}
	if jh := os.Getenv("JAVA_HOME"); jh != "" {
		return filepath.Join(jh, "jre")
	}
	panic("找不到jre目录！")
}

// 辅助函数 exists 判断文件是否存在
func exists(path string) bool {
	// 如果返回的错误为nil，说明文件或者目录存在
	if _, err := os.Stat(path); err != nil {
		// 再次确认错误类型是否为不存在，还是其他
		if os.IsNotExist(err) {
			return false
		}
	}
	return true
}

// parseUserClasspath 解析用户类路径
func (self *ClassPath) parseUserClasspath(cpOption string) {
	// 如果用户没有提供-classpath/-cp选项，则使用当前目录作为用户类路径
	if cpOption == "" {
		cpOption = "."
	}
	self.userClasspath = newEntry(cpOption)
}

// ReadClass 读取
func (self *ClassPath) ReadClass(className string) ([]byte, Entry, error) {
	// 将类名转换为相对路径
	className = className + ".class"
	// 依次从启动类路径、扩展类路径和用户类路径中搜索class文件
	if data, entry, err := self.bootClasspath.readClass(className); err == nil {
		return data, entry, err
	}
	if data, entry, err := self.extClasspath.readClass(className); err == nil {
		return data, entry, err
	}
	return self.userClasspath.readClass(className)
}

// String 转化为字符串
func (self *ClassPath) String() string {
	return self.userClasspath.String()
}
````
在这里，我们实现了类路径的解析，以及读取class文件的功能。

### 分析类路径解析部分
> 通过jreOption与cpOption来解析类路径，jreOption是-Xjre选项，cpOption是-classpath/-cp选项。
> 
> 启动类与拓展类使用jreOption，它们是lib或lib/ext目录下的所有类，
> 所以首先采用通配符Entry生成，将目录全部分析，然后再向下不断分析。
> 注意的是，我们应该先对Jre目录进行判断，先看jreOption是否存在，如果不存在，再看当前目录下是否存在jre目录，如果还是不存在，再看JAVA_HOME环境变量是否存在，如果还是不存在，就抛出异常。
> 
> cpOption是用户类路径，如果用户没有提供-classpath/-cp选项，则使用当前目录作为用户类路径。

### 分析读取class文件部分
> 读取class文件，首先将类名转换为相对路径，然后依次从启动类路径、扩展类路径和用户类路径中搜索class文件。

## 类路径项
````Golang
// Entry 接口
const pathListSeparator = string(os.PathListSeparator)

// Entry 类路径项
// 举例作用：假设要读取java.lang.Object类，传入参数应该是java/lang/Object.class，
// 返回读取到的字节数据，最终定位到class文件的Entry
type Entry interface {
	// readClass 用来寻找和加载class文件
	readClass(className string) ([]byte, Entry, error)
	// String 类似返回变量的字符串表示
	String() string
}

// newEntry 创建新的Entry
func newEntry(path string) Entry {
	// 如果包含分隔符，说明是复合Entry
	// 例如: java -cp a.jar;b.jar;c.jar; com.example.Main
	if strings.Contains(path, pathListSeparator) {
		return newCompositeEntry(path)
	}

	// 如果是*结尾，说明是通配符Entry
	// 例如: java -cp * com.example.Main
	if strings.HasSuffix(path, "*") {
		return newWildcardEntry(path)
	}

	// 如果是zip或者jar包，说明是zip或者jar包Entry
	// 例如: java -cp a.jar com.example.Main
	if strings.HasSuffix(path, ".jar") || strings.HasSuffix(path, ".JAR") ||
		strings.HasSuffix(path, ".zip") || strings.HasSuffix(path, ".ZIP") {
		return newZipEntry(path)
	}

	// 否则是目录Entry
	// 例如: java -cp com/example Main
	return newDirEntry(path)
}
````
[其他Entry实现在TRO148/TroJvm中](https://github.com/TRO148/TroJvm/tree/master/go/src/jvmgo/classpath)

## 测试
````Golang
    cp := classpath.Parse(XjreOption, cpOption)
	// 把.全部替换成/
	className := strings.Replace(cmd.class, ".", "/", -1)
	classData, _, err := cp.ReadClass(className)
````

### 总结
就这样，我们完成了类路径的解析，以及读取class文件的功能。
