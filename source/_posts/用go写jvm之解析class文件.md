---
title: 用go写jvm之解析class文件
date: 2023-05-26 15:13:13
tags:
  - Go
  - 项目
  - JVM
---
在搜索到class文件后，得到字节码数据，然后将它解析为class文件结构
<!-- more -->
## Class文件结构
分析class文件结构，可以发现它主要是由以下部分组成：
- 魔数、版本号、访问标志、类索引、父类索引
- 常量池
- 字段表、方法表
- 属性表
据此建立class文件结构体，然后将字节码数据解析为结构体。
````Golang
type ClassFile struct {
	minorVersion uint16 // 次版本号
	majorVersion uint16 // 主版本号

	constantPool ConstantPool // 常量池

	accessFlags uint16 // 访问标志
	thisClass   uint16 // 类索引
	superClass  uint16 // 父类索引

	interfaces []uint16 // 接口索引表

	fields  []*MemberInfo // 字段表
	methods []*MemberInfo // 方法表

	attributes []AttributeInfo // 属性表
}
````

## 解析Class
````Golang
// Parse 解析class文件
func Parse(classData []byte) (cf *ClassFile, err error) {
	// defer + recover做到异常捕获
	defer func() {
		// 尝试恢复，如果恢复成功，将err赋值为恢复的错误
		if r := recover(); r != nil {
			var ok bool
			err, ok = r.(error) // 类型断言
			if !ok {
				err = fmt.Errorf("%v", r)
			}
		}
	}()

	// 读取数据
	cr := &ClassReader{classData}
	cf = &ClassFile{}

	// 装填数据
	cf.read(cr)
	return
}

// read 读取
func (self *ClassFile) read(reader *ClassReader) {
	self.readAndCheckMagic(reader)               // 读取并检查魔数
	self.readAndCheckVersion(reader)             // 读取并检查版本号
	self.constantPool = readConstantPool(reader) // 读取常量池

	self.accessFlags = reader.readUint16() // 读取访问标志
	self.thisClass = reader.readUint16()   // 读取类索引
	self.superClass = reader.readUint16()  // 读取父类索引
	self.interfaces = reader.readUint16s() // 读取接口索引表

	self.fields = readMembers(reader, self.constantPool)        // 读取字段表
	self.methods = readMembers(reader, self.constantPool)       // 读取方法表
	self.attributes = readAttributes(reader, self.constantPool) // 读取属性表
}
````
模拟tryCatch，然后读取数据，根据class文件的字节码顺序，进行读取，将数据存储在classfile中。

## 分析常量池
常量池，是存储常量（Constant_Info）的表，读取常量池大小，然后读取常量。
````Golang
// ConstantPool 常量池，常量的表
type ConstantPool []ConstantInfo

// readConstantPool 读取常量池
// 需要注意的是表头给出的常量大小比实际大1
// 0是无效索引，不指向任何常量
// CONSTANT_Long_info和CONSTANT_Double_info各占两个位置，实际常量数量比n-1还小
func readConstantPool(reader *ClassReader) ConstantPool {
	// 读取常量池大小
	cpCount := int(reader.readUint16())
	// 生成常量池
	cp := make([]ConstantInfo, cpCount)

	for i := 1; i < cpCount; i++ {
		cp[i] = readConstantInfo(reader, cp)
		// 根据类型进行操作
		switch cp[i].(type) {
		case *ConstantLongInfo, *ConstantDoubleInfo:
			i++
		}
	}

	return cp
}
````
读取常量部分，采用不同类型，进行不同操作，生成不同常量
````Golang
// ConstantInfo 定义常量信息接口
type ConstantInfo interface {
	// 读取常量信息
	readInfo(reader *ClassReader)
}
// readConstantInfo 读取常量信息
// 先读出tag值，创建具体的常量，最后调用常量的readInfo()方法读取常量信息
func readConstantInfo(reader *ClassReader, cp ConstantPool) ConstantInfo {
	// 读出什么类型的
	tag := reader.readUint8()
	// 创建常量
	c := newConstantInfo(tag, cp)
	// 读取常量信息
	c.readInfo(reader)
	return c
}
// newConstantInfo 生成常量信息
func newConstantInfo(tag uint8, cp ConstantPool) ConstantInfo {
	switch tag {
	case CONSTANT_Integer:
		return &ConstantIntegerInfo{}
	case CONSTANT_Float:
		return &ConstantFloatInfo{}
	case CONSTANT_Long:
		return &ConstantLongInfo{}
	case CONSTANT_Double:
		return &ConstantDoubleInfo{}
	case CONSTANT_Utf8:
		return &ConstantUtf8Info{}
	case CONSTANT_String:
		return &ConstantStringInfo{cp: cp}
	case CONSTANT_Class:
		return &ConstantClassInfo{cp: cp}
	case COMSTANT_Fieldref:
		return &ConstantFieldrefInfo{ConstantMemberrefInfo{cp: cp}}
	case CONSTANT_Methodref:
		return &ConstantMethodrefInfo{ConstantMemberrefInfo{cp: cp}}
	case CONSTANT_InterfaceMethodref:
		return &ConstantInterfaceMethodrefInfo{ConstantMemberrefInfo{cp: cp}}
	case CONSTANT_NameAndType:
		return &ConstantNameAndTypeInfo{}
		// 目的解析invokedynamic指令
	default:
		panic("java.lang.ClassFormatError: constant pool tag!")
	}
}
````
对于不同的常量处理过程，详见[这里](https://github.com/TRO148/TroJvm/tree/master/go/src/jvmgo/classfile)

## 解析字段和方法表
由于字段表和方法表采用相同的结构，所以采用相同的方法进行解析。
````Golang
// MemberInfo 字段和方法表
type MemberInfo struct {
	cp              ConstantPool    // 常量池
	accessFlags     uint16          //访问标志
	nameIndex       uint16          //常量池索引,给出字段名或方法名
	descriptorIndex uint16          //常量池索引,给出字段或方法描述符
	attributes      []AttributeInfo //属性表
}

// readMembers 生成读取字段表和方法表的函数
func readMembers(reader *ClassReader, cp ConstantPool) []*MemberInfo {
	// 读取字段表或方法表的成员数量
	memberCount := reader.readUint16()
	// 生成字段表或方法表
	members := make([]*MemberInfo, memberCount)
	for i := range members {
		members[i] = readMember(reader, cp)
	}
	return members
}

// 辅助函数 readMember 用来读取字段或方法数据
func readMember(reader *ClassReader, cp ConstantPool) *MemberInfo {
	// 依次读取数据
	return &MemberInfo{
		cp:              cp,
		accessFlags:     reader.readUint16(),        // 访问标志
		nameIndex:       reader.readUint16(),        // 名称索引
		descriptorIndex: reader.readUint16(),        // 描述符索引
		attributes:      readAttributes(reader, cp), // 属性表
	}
}
````
## 解析属性表
````Golang
// AttributeInfo 属性信息接口
// 按照用户，23种预定义属性可分为三组，第一组是实现Java虚拟机所必需的，共有5种；第二组是Java类库所必需的，共有12种；第三组是可选的，共有6种。
type AttributeInfo interface {
	readInfo(reader *ClassReader)
}

// readAttributes 读取属性表
func readAttributes(reader *ClassReader, cp ConstantPool) []AttributeInfo {
	// 读取属性表长度
	attributesCount := reader.readUint16()
	// 创建属性表
	attributes := make([]AttributeInfo, attributesCount)
	for i := range attributes {
		attributes[i] = readAttribute(reader, cp)
	}
	return attributes
}

// readAttribute 读取属性
func readAttribute(reader *ClassReader, cp ConstantPool) AttributeInfo {
	// 读取属性名索引
	attrNameIndex := reader.readUint16()
	// 在常量池中查询属性名
	attrName := cp.getUtf8(attrNameIndex)
	// 读取属性长度
	attrLen := reader.readUint32()
	// 创建属性信息
	attrInfo := newAttributeInfo(attrName, attrLen, cp)
	// 读取属性信息reader
	attrInfo.readInfo(reader)
	return attrInfo
}

// newAttributeInfo 创建属性信息 23种属性
func newAttributeInfo(attrName string, attrLen uint32, cp ConstantPool) AttributeInfo {
	switch attrName {

	// 标识的
	// Deprecated是最简单的属性之一，仅起到标记作用，不包含任何数据，可出现在ClassFile、field_info和method_info结构中。
	// Deprecated 用于表示不建议使用的属性，可以在java中使用@Deprecated标签指出编译器给出警告信息。
	case "Deprecated":
		return &DeprecatedAttribute{}
		// Synthetic也是最简单的属性之一，起到标识作用，不包含任何数据，可出现在ClassFile、field_info和method_info结构中。
		// Synthetic 用于标记源文件中不存在、由编译器生成的类成员，引入Synthetic属性主要是为了支持嵌套类和嵌套接口。
	case "Synthetic":
		return &SyntheticAttribute{}

		// 编译器生成的
		// SourceFile是可选定长属性，只会出现在ClassFile结构中，用于指出源文件名。
	case "SourceFile":
		return &SourceFileAttribute{cp: cp}
	case "LineNumberTable":
		return &LineNumberTableAttribute{}
	case "LocalVariableTable":
		return &LocalVariableTableAttribute{}

		// 存放信息
		// ConstantValue是定长属性，只会出现在field_info结构中，用于表示常量表达式的值。
	case "ConstantValue":
		return &ConstantValueAttribute{}
		// Code是变长属性，只会出现在method_info结构中，用于存放字节码等方法相关信息。
	case "Code":
		return &CodeAttribute{cp: cp}
		// Exceptions是变长属性，用于指出方法抛出的异常表。
	case "Exceptions":
		return &ExceptionsAttribute{}

	default:
		return &UnparsedAttribute{attrName, attrLen, nil}
	}
}
````
首先读取属性表，然后再读每一个属性，根据属性名，创建属性信息，然后读取属性信息。

具体属性信息也详见[这里](https://github.com/TRO148/TroJvm/tree/master/go/src/jvmgo/classfile)

### 结束
解析class文件部分，基本就是使用reader，读取固定长度的字节，获取相应的信息，并组成不同的信息结构，这里就不再赘述了。
