---
title: 用go写jvm之指令集和解释器
date: 2023-05-27 09:47:34
tags:
  - Go
  - 项目
  - JVM
---
Java虚拟机规范，把定义的205条指令按用途分成11类，
分别是常量constants指令，加载loads指令，存储stores指令，操作数stack指令，数学math指令，转换conversions指令，比较comparisons指令，控制control指令，引用references指令，扩展extended指令和保留reserved指令。

在本节，我们将实现大部分指令集和解释器
<!-- more -->
### 指令集部分
为读取字节码，我们创建指令接口用于读取和执行
````Golang
// Instruction 指令接口
type Instruction interface {
	// FetchOperands 从字节码中提取操作数
	FetchOperands(reader *BytecodeReader)
	// Execute 执行指令逻辑
	Execute(frame *rtda.Frame)
}

// NoOperandsInstruction 无操作数指令
type NoOperandsInstruction struct {
}

func (i NoOperandsInstruction) FetchOperands(reader *BytecodeReader) {
	// noting to do
}

// BranchInstruction 跳转指令
type BranchInstruction struct {
	// 跳转偏移量
	Offset int
}

func (self *BranchInstruction) FetchOperands(reader *BytecodeReader) {
	// 从字节码中读取一个uint16整数
	self.Offset = int(reader.ReadInt16())
}

// Index8Instruction 读取一个uint8整数
type Index8Instruction struct {
	// 局部变量表索引
	Index uint
}

func (self *Index8Instruction) FetchOperands(reader *BytecodeReader) {
	self.Index = uint(reader.ReadUint8())
}

// Index16Instruction 读取一个uint16整数
type Index16Instruction struct {
	// 局部变量索引
	Index uint
}

func (self *Index16Instruction) FetchOperands(reader *BytecodeReader) {
	self.Index = uint(reader.ReadUint16())
}
````
在这里，我们分别定义了基本指令接口，无操作数指令，跳转指令，读取一个uint8整数指令和读取一个uint16整数指令。

然后根据上面定义的结构体，拓展更多指令，在这里我们就不详细说了，具体代码看[这里](https://github.com/TRO148/TroJvm/tree/master/instructions)

> 在这里我们简要分析一些指令:
> 
> _const系列指令：
> _const系列指令用于将常量推入操作数栈顶，包括null指令，int指令，float指令，long指令，double指令和aconst_null指令。
> 直接使用栈帧中操作栈的推入，即可完成对应的指令
> 
> _store系列指令：
> _store系列指令用于将操作数栈顶的值存入局部变量表，包括istore指令，lstore指令，fstore指令，dstore指令，astore指令和istore_n指令。
> 直接使用栈帧中局部变量表的存储，即可完成对应的指令
> 
> _load系列指令：
> _load系列指令用于将局部变量表的值推入操作数栈顶，包括iload指令，lload指令，fload指令，dload指令，aload指令和iload_n指令。
> 直接使用栈帧中局部变量表的读取，即可完成对应的指令
> 
> stack系指令:
> dup:复制栈顶数值并将复制值压入栈顶，并区分dup和dup_x1，dup_x2，dup2，dup2_x1，dup2_x2，用来使复制值放入不同的顺序之中。
> 通过弹出对应的变量，然后再推入一定顺序的变量来实现操作。
> 
> control系列指令:
> control系列指令用于控制程序流程，包括goto指令，tableswitch指令和lookupswitch指令。通过改变pc，来实现跳转。

### 解释器部分
在这里，我们实现解释器方法
````Golang
// Interpret 解释器
func Interpret(methodInfo *classfile.MemberInfo) {
	codeAttr := methodInfo.CodeAttribute()
	// 局部属性表最大索引
	maxLocals := codeAttr.MaxLocals()
	// 操作栈深度
	maxStack := codeAttr.MaxStack()
	bytecode := codeAttr.Code()

	//创建一个Thread实例，创建帧并推入虚拟机栈顶，然后执行方法
	thread := rtda.NewThread()
	frame := thread.NewFrame(maxLocals, maxStack)
	thread.PushFrame(frame)

	defer catchErr(frame)
	loop(thread, bytecode)
}

// CatchErr 报错
func catchErr(frame *rtda.Frame) {
	if r := recover(); r != nil {
		fmt.Printf("LocalVars:%v\n", frame.LocalVars())
		fmt.Printf("OperandStack:%v\n", frame.OperandStack())
		panic(r)
	}
}

// Loop 循环
func loop(thread *rtda.Thread, bytecode []byte) {
	frame := thread.PopFrame()
	reader := &base.BytecodeReader{}
	for {
		//计算pc
		pc := frame.NextPC()
		thread.SetPc(pc)

		//解码指令
		reader.Reset(bytecode, pc)
		opcode := reader.ReadUint8()
		inst := instructions.NewInstruction(opcode)
		inst.FetchOperands(reader)
		frame.SetNextPC(reader.PC())

		//执行指令
		fmt.Printf("pc:%2d inst:%T %v\n", pc, inst, inst)
		inst.Execute(frame)
	}
}
````
因为在jvm中code存放在方法属性中，所以我们需要先从方法属性中读取code属性，然后创建一个Thread实例，创建帧并推入虚拟机栈顶，然后执行方法。

### 测试
````Golang
func startJVM(cmd *Cmd) {
	cp := classpath.Parse(cmd.XjreOption, cmd.cpOption)
	className := strings.Replace(cmd.class, ".", "/", -1)
	cf := loadClass(className, cp)
	mainMethod := getMainMethod(cf)
	if mainMethod != nil {
		interpreter.Interpret(mainMethod)
	} else {
		fmt.Printf("Main method not found in class %s\n", cmd.class)
	}
}

func loadClass(className string, cp *classpath.ClassPath) *classfile.ClassFile {
	classData, _, err := cp.ReadClass(className)
	if err != nil {
		panic(err)
	}

	cf, err := classfile.Parse(classData)
	if err != nil {
		panic(err)
	}

	return cf
}

func getMainMethod(cf *classfile.ClassFile) *classfile.MemberInfo {
	for _, m := range cf.Methods() {
		if m.Name() == "main" && m.Descriptor() == "([Ljava/lang/String;)V" {
			return m
		}
	}
	return nil
}
````
我们先解析class文件，然后获取main方法，解析main方法的字节码，然后查看数据

### 总结
暂时的，我们实现了解释器和大部分指令集的功能，并通过NewInstruction方法，根据不同的指令创建不同的指令实例，这样就可以通过指令实例来执行指令了。
