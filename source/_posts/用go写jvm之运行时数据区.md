---
title: 用go写jvm之运行时数据区
date: 2023-05-26 17:21:36
tags: [Go]
---
在运行Java程序时，Java虚拟机需要使用内存来存放各式各样的数据。Java虚拟机规范把这些内存区域叫做运行时数据区。
<!-- more -->
## 概述
运行时数据区分为：一类是多线程共享的，另一类则是线程私有的。
> 多线程共享的内存区域：
> 主要存放类数据和类实例，对象数据存放在堆Heap，类数据存放在方法区Method Area。
> 堆由垃圾收集器定期清理。
> 类数据包括字段和方法信息、方法的字节码、运行时常量池等。
> 
> 线程私有的运行时数据区：
> 主要用来辅助执行Java字节码。每个线程都有字节的pc寄存器和Java虚拟机栈(JVM Stack)。
> Java虚拟机栈又由栈帧组成，帧中保存方法执行的状态，包括局部变量表和操作数栈等。
> 
> 在任一时刻，某一线程在执行某个方法，这个方法叫做当前方法，执行方法的帧叫做线程的当前帧，声明该方法的类叫做当前类。 

## 实现线程私有运行时数据区
在这里，我们先实现线程私有运行时数据区，大致思路为创建pc和虚拟栈，其中栈帧包含局部变量表和操作数栈。

````Golang
// Thread 线程
// 每个线程都有一个pc寄存器和Java虚拟机栈
type Thread struct {
	pc    int    //pc寄存器
	stack *Stack //Java虚拟机栈的指针
}

// Stack 栈
type Stack struct {
	// 最大容量
	maxSize uint
	// 当前大小
	size uint
	// 栈顶
	_top *Frame
}

type Frame struct {
	lower        *Frame        //下一个栈帧
	localVars    LocalVars     //局部变量表，使用[]Slot实现
	operandStack *OperandStack //操作数栈，也使用[]Slot实现
}
````

### 讨论局部变量表和操作数栈
局部变量表和操作数栈的元素，需要至少表示一个int或引用值，用来存放数据。
如果只用一个int，引用值不能存放，会被垃圾回收清理掉，用[]interface{}表示太过繁琐。
所以，我们使用Slot来表示局部变量表和操作数栈的元素，Slot是一个结构体，包含int和引用值。

````Golang
// Slot 局部变量，用来实现局部变量表
type Slot struct {
	num int32   //存放整数，将基础变量类型转换成int32类型
	ref *Object //存放引用，将引用类型转换成*Object类型
}

// LocalVars 局部变量表
type LocalVars []Slot

// OperandStack 操作数栈
type OperandStack struct {
	size  uint   //栈顶位置
	slots []Slot //栈
}
````
### 相关方法
在这里，我们的局部变量表和操作数栈用来存放数据，根据不同类型，采用不同存放方式。

对于java虚拟栈，我们需要实现push和pop方法，用来入栈和出栈。

代码详见[这里](https://github.com/TRO148/TroJvm/tree/master/go/src/jvmgo/rtda)

### 总结
在这里，我们实现了线程私有的运行时数据区，包括pc寄存器和Java虚拟机栈，其中Java虚拟机栈由栈帧组成，栈帧包含局部变量表和操作数栈。
