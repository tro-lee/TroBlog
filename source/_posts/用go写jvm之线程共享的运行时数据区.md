---
title: 用go写jvm之线程共享的运行时数据区
date: 2023-05-28 18:24:50
tags:
  - Go
  - 项目
  - JVM
---
在本节，我们将实现线程共享的运行时数据区，包括方法区和运行时常量池
<!-- more -->
# 方法区
它是运行时数据区的一块逻辑区域，由多个线程共享，主要存放从class文件获取的类信息，另外类变量也存放在方法区中。

### class相关结构体
我们首先实现类结构体和类成员结构体，
````Golang
// Class 定义类结构体
type Class struct {
	accessFlags       uint16                  //访问标志
	name              string                  //类名，完全限定名
	superClassName    string                  //超类名
	interfaceNames    []string                //接口名
	constantPool      *classfile.ConstantPool //运行时常量池指针
	fields            []*Field                //字段表
	methods           []*Method               //方法表
	loader            *ClassLoader            //读取类数据的类加载器
	superClass        *Class                  //超类
	interfaces        []*Class                //接口
	instanceSlotCount uint                    //实例变量占据的空间大小
	staticSlotCount   uint                    //静态变量占据的空间大小
	staticVars        Slots                  //静态变量
}
// 类成员，包括字段和方法
type ClassMember struct {
	accessFlags uint16 //访问标志
	name        string //名字
	descriptor  string //标志
	class       *Class //所属类
}
// Field 字段
type Field struct {
	ClassMember
}
// Method 方法
type Method struct {
	ClassMember
	maxStack  uint   // 操作数栈的最大深度
	maxLocals uint   // 局部变量表大小
	code      []byte // 字节码
}
````
### 运行时常量池
````Golang
type ConstantPool struct {
	class  *Class
	consts []Constant
}

func newConstantPool(class *Class, cfCp classfile.ConstantPool) *ConstantPool {
	// 将class文件中的常量池，转换为运行时常量池
	cpCount := len(cfCp)
	consts := make([]Constant, cpCount)
	rtCp := &ConstantPool{class, consts}

	// cp的引用类型，继承关系如下:
	// symref -> classRef
	//		  -> memberRef
	//						-> fieldRef
	//						-> methodRef

	for i := 0; i < cpCount; i++ {
		// 获取常量池信息
		cpInfo := cfCp[i]
		switch cpInfo.(type) {
		case *classfile.ConstantIntegerInfo:
			// 整数
			intInfo := cpInfo.(*classfile.ConstantIntegerInfo)
			consts[i] = intInfo.Value()
		case *classfile.ConstantFloatInfo:
			// 浮点数
			floatInfo := cpInfo.(*classfile.ConstantFloatInfo)
			consts[i] = floatInfo.Value()
		case *classfile.ConstantLongInfo:
			// 长整数，因为占两个位置，所以需要跳过一个位置
			longInfo := cpInfo.(*classfile.ConstantLongInfo)
			consts[i] = longInfo.Value()
			i++
		case *classfile.ConstantDoubleInfo:
			// 双精度浮点数，因为占两个位置，所以需要跳过一个位置
			doubleInfo := cpInfo.(*classfile.ConstantDoubleInfo)
			consts[i] = doubleInfo.Value()
			i++
		case *classfile.ConstantStringInfo:
			// 字符串字面量
			stringInfo := cpInfo.(*classfile.ConstantStringInfo)
			consts[i] = stringInfo.Name()
		case *classfile.ConstantClassInfo:
			// 类符号引用
			classInfo := cpInfo.(*classfile.ConstantClassInfo)
			consts[i] = newClassRef(rtCp, classInfo)
		case *classfile.ConstantFieldrefInfo:
			// 字段符号引用
			fieldrefInfo := cpInfo.(*classfile.ConstantFieldrefInfo)
			consts[i] = newFieldRef(rtCp, fieldrefInfo)
		case *classfile.ConstantMethodrefInfo:
			// 方法符号引用
			methodrefInfo := cpInfo.(*classfile.ConstantMethodrefInfo)
			consts[i] = newMethodRef(rtCp, methodrefInfo)
		case *classfile.ConstantInterfaceMethodrefInfo:
			// 接口方法符号引用
			methodrefInfo := cpInfo.(*classfile.ConstantInterfaceMethodrefInfo)
			consts[i] = newInterfaceMethodRef(rtCp, methodrefInfo)
		}
	}

	return rtCp
}
````
对应classFile中的常量池中元素类型，我们转换其相应的类型，
分为字面量和引用，字面量包括整数、浮点数、长整数、双精度浮点数、字符串字面量，引用包括类符号引用、字段符号引用、方法符号引用、接口方法符号引用。

举例如方法符号引用：
````Golang
// SymRef 符号引用
type SymRef struct {
	cp        *ConstantPool // 常量池，运行时常量指针
	className string        // 类名，完全限定名
	class     *Class        // 类
}

// MemberRef 字段符号引用和方法符号引用共有的信息
type MemberRef struct {
	SymRef
	name       string // 字段名
	descriptor string // 字段描述符，代表在java虚拟机的角度，一个类可以有多个同名字段
}
// copyMemberRefInfo()方法从classfile.MemberInfo结构体中复制数据
func (self *MemberRef) copyMemberRefInfo(memberInfo *classfile.ConstantMemberrefInfo) {
	self.className = memberInfo.ClassName()
	self.name, self.descriptor = memberInfo.NameAndDescriptor()
}

// MethodRef 方法符号引用
type MethodRef struct {
	MemberRef
	method *Method
}

func newMethodRef(cp *ConstantPool, refInfo *classfile.ConstantMethodrefInfo) *MethodRef {
	ref := &MethodRef{}
	ref.cp = cp
	ref.copyMemberRefInfo(&refInfo.ConstantMemberrefInfo)
	return ref
}
````
### 类加载器
类加载器，用来读取class文件、解析class、验证和准备class，
分别使用classpath,classfile，相当于再次走一遍过程即可。

重点说一下验证和准备class:
````Golang

// 链接，进行验证和准备
func link(class *Class) {
	// 对类进行严格验证
	verify(class)
	// 准备阶段，给类变量分配空间并给予初始值
	prepare(class)
}

func verify(class *Class) {
	// todo
}

// prepare 准备阶段，给类变量分配空间并给予初始值
// 从上一个类的实例变量个数开始，给类的实例变量分配空间
func prepare(class *Class) {
	calcInstanceFieldSlotIds(class)
	calcStaticFieldSlotIds(class)
	allocAndInitStaticVars(class)
}

// 计算类的实例字段变量个数
func calcInstanceFieldSlotIds(class *Class) {
	slotId := uint(0)
	if class.superClass != nil {
		// 等于超类的实例变量个数
		slotId = class.superClass.instanceSlotCount
	}
	for _, field := range class.fields {
		if !field.IsStatic() {
			field.slotId = slotId
			slotId++
			if field.isLongOrDouble() {
				field.slotId++
			}
		}
	}
	class.instanceSlotCount = slotId
}

// 计算类的静态变量个数
func calcStaticFieldSlotIds(class *Class) {
	slotId := uint(0)
	for _, field := range class.fields {
		if field.IsStatic() {
			field.slotId = slotId
			slotId++
			if field.isLongOrDouble() {
				slotId++
			}
		}
	}
	class.staticSlotCount = slotId
}

// 给类变量分配空间
func allocAndInitStaticVars(class *Class) {
	// 给类变量分配空间
	class.staticVars = newSlots(class.staticSlotCount)
	// 给类变量赋予初始值
	for _, field := range class.fields {
		// 给静态变量复制，从常量池中加载常量值
		if field.IsStatic() && field.IsFinal() {
			initStaticFinalVar(class, field)
		}
	}
}

// 给静态变量赋予初始值
func initStaticFinalVar(class *Class, field *Field) {
	// 获取静态变量表
	vars := class.staticVars
	// 获取常量池
	cp := class.constantPool
	// 获取常量值索引
	cpIndex := field.ConstValueIndex()
	// 获取静态变量索引
	slotId := field.SlotId()

	if cpIndex > 0 {
		switch field.descriptor {
		case "Z", "B", "C", "S", "I":
			// 获取int类型的常量值
			val := cp.GetConstant(cpIndex).(int32)
			// 给静态变量赋值
			vars.SetInt(slotId, val)
		case "J":
			// 获取long类型的常量值
			val := cp.GetConstant(cpIndex).(int64)
			// 给静态变量赋值
			vars.SetLong(slotId, val)
		case "F":
			// 获取float类型的常量值
			val := cp.GetConstant(cpIndex).(float32)
			// 给静态变量赋值
			vars.SetFloat(slotId, val)
		case "D":
			// 获取double类型的常量值
			val := cp.GetConstant(cpIndex).(float64)
			// 给静态变量赋值
			vars.SetDouble(slotId, val)
		case "Ljava/lang/String;":
			panic("todo")
		}
	}
}
````

### 类和类成员引用
实现ResolvedClass和ResolvedMemberRef接口，用来表示类和类成员引用。
````Golang
// ResolvedClass 类符号引用解析
func (self *SymRef) ResolvedClass() *Class {
	// 如果已经解析过了，就不解析了
	if self.class == nil {
		self.resolveClassRef()
	}
	return self.class
}
// resolveClassRef 类符号引用解析
func (self *SymRef) resolveClassRef() {
	d := self.cp.class                      // 使用当前主类的类加载器
	c := d.loader.LoadClass(self.className) // 加载类
	// 类的访问控制规则
	if !c.isAccessibleTo(d) {
		panic("java.lang.IllegalAccessError")
	}
	self.class = c
}
````
如果类已经解析过了，就不解析了。解析类时，应进行类的访问控制规则判断，只有符合规则的类才能被访问。
类似，我们实现字段引用
````Golang
// FieldRef 定义字段引用
type FieldRef struct {
	MemberRef
	field *Field //指向属性
}

// ResolvedField 字段符号引用解析
func (self *FieldRef) ResolvedField() *Field {
	if self.field == nil {
		self.resolvedFieldRef()
	}
	return self.field
}

func (self *FieldRef) resolvedFieldRef() {
	d := self.cp.class
	c := self.ResolvedClass()
	// 查找字段
	field := lookupField(c, self.name, self.descriptor)

	if field == nil {
		panic("java.lang.NoSuchFieldError")
	}

	// 判断字段是否可以访问
	if !field.isAccessibleTo(d) {
		panic("java.lang.IllegalAccessError")
	}
}

// lookupField 查找字段
func lookupField(class *Class, name, descriptor string) *Field {
	// 先在当前类中查找
	for _, field := range class.fields {
		if field.name == name && field.descriptor == descriptor {
			return field
		}
	}
	// 在接口中查找
	for _, iface := range class.interfaces {
		if field := lookupField(iface, name, descriptor); field != nil {
			return field
		}
	}
	// 在父类中查找
	if class.superClass != nil {
		return lookupField(class.superClass, name, descriptor)
	}
	return nil
}

// 访问控制规则
func (self *Field) isAccessibleTo(d *Class) bool {
	// 如果是public，就是任意访问
	if self.IsPublic() {
		return true
	}
	c := self.class

	// 如果是protected, 就是同一个类，子类，同一个包
	if self.IsProtected() {
		return d == c || d.isSubClassOf(c) || c.getPackageName() == d.getPackageName()
	}

	// 如果是private, 就是同一个类
	if self.IsPrivate() {
		return d == c
	}

	return c.getPackageName() == d.getPackageName()
}
````
如果字段已经解析了，就不解析了。
解析字段的时候，先进行查找字段，查询字段所属类是否存在字段，然后查询其父类和接口是否存在字段。
最后进行字段的访问控制规则判断，只有符合规则的字段才能被访问。

### 总结
在本篇，我们实现了类的结构体，以及其相关的属性。
常量池将class文件的常量池转换而来，常量池存储常量数值和符号引用。
方法表与字段表存储对应的类成员信息，静态变量存储静态变量。
当然我们也做了classLoader的实现，实现了类的加载，解析，初始化。
