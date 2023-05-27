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
<!-- more -->
