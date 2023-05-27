---
title: 学习python的笔记本2
date: 2022-10-12 23:38:06
tags: [python]
---
>包含面向对象编程，面向对象高级编程
<!-- more -->
1.面向对象编程
-
+ 使用class定义类，__init__为构造函数，self表示，用__开头标记为私有变量
````python
class Student(object):

    def __init__(self, a, b):
        self.__name = a
        self.__sex = b
        
    def print_all():
        print(__name, __sex)
````
+ 继承，class a(b)，a继承b，同时所有类继承object
+ 动态语言，拥有相应类型的方法，就可以被看作相应类型
+ 获取对象信息，方法有：dir(列出全部信息),isinstance(判断什么类型)

2.面向对象高级编程
-
+ __slots__可以限制对象动态绑定属性
+ @property装饰器，把一个方法变成属性调用，可以监控相关属性，类似
````python
class Student(object):

    @property
    def birth(self):
        return self._birth

    @birth.setter
    def birth(self, value):
        self._birth = value

    @property
    def age(self):
        return 2015 - self._birth
````

3.异常处理、内建模块
-
+ 标准try expect finally处理异常，通过raise抛出异常Error
+ 内建模块有多种，根据需求来import
