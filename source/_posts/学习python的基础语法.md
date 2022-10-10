---
title: 学习python的基础语法
date: 2022-10-08 19:42:14
tags: python 语言
---
> 因之前学习过部分语言，所以就光说些不同的大方面啦
<!-- more -->
1.背景
--
python是解释型语言，在执行时一行一行翻译成CPU能看懂的语言。
python的解释器有多种，也可以在不同平台相应解释器下运行。

2.基础
--

+ Python采用**Tab来区分代码块**，相当于{}，记住**Tab!=4个空格**。
+ 基础数据类型有整数（无限大），浮点数（无限大），字符串，布尔值，空值，变量。
+ list[],是可变的。tuple()，是不变的。
+ **dic为{a:1}进行字典查询, set为set([])作为集合存放元素，创建应填写list类型**
+ 条件判断:
````python
a = 1
if True:
print("nihao%s" % a)
elif a == 1:
print("你好")
````
+ 循环:
````python
//forin循环
for a in b:
    print(a)
//while循环
while Ture:
    break
````

3.函数
--
+ 使用def定义函数，如：
````python
def Hello_World():
    print("你好")
````
+ pass表示空函数，可以表示暂时没想好写什么的内容
+ *可以把list的数值拆分为多个参数
+ 函数传入的参数类型：
````python
def a(c, d): //顺序参数
def a(c, d=[]): //默认参数，只有第一次才会运行
def a(*c): //可变参数，传入tuple
def a(**c): //关键字参数，传入dict
def a(a, *, d): //在*之后，d为关键字传入a(1, d=1)
````

4.高级特性
--
+ 切片: [x:y]，list切出x到y的list
````python
L[:10]前10个
L[:10:2]前10个，隔两个取一次
L[-10:]后10个
L[1:-1]第一个到倒数第一个
````
+ 列表生成式: [x for ····]，生成元素为x的列表
````python
[x * x for x in range(1, 11) if x % 2 == 0]
结果为[4, 16, 36, 64, 100]
[m + n for m in 'ABC' for n in 'XYZ']
结果为['AX', 'AY', 'AZ', 'BX', 'BY', 'BZ', 'CX', 'CY', 'CZ']
````
+ 生成器: (x for ····)，不生成列表，生成一个generator，占空间小，自动计算
````python
g = (x * x for x in range(10))
for a in g
    print(a)
````

5.高级函数
--
+ map/reduce,map(f, [])可以让f函数作用于[],reduce(f, [])可以累计作用
````python
def f (x):
    return x * x
r = map(f, [1, 2, 3])
[1, 4, 9]
def p (x, y):
    return x * y
k = reduce(f, [1, 2, 3])
[6]
````
+ filter(b, [])，传入判断是否去留的函数与列表
