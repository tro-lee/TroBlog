---
title: MongoDB学习笔记
date: 2023-03-05 22:29:54
tags: [技术]
---
NoSql，先研究用来存图片
<!-- more -->
概念
-
MongoDB属于Nosql，将数据存储为文档。
它有诸多概念：数据库，集合，文档，字段。 
> 集合类似RDBMS（关系数据库）的表，但没有固定的结构，可以插入不同格式和类型数据
> 文档类似RDBMS的键值对。

数据库操作
-
+ use xxx使用/创建某个数据库
+ show dbs展示数据库
+ db.dropDatabase()删库跑路

集合操作
-
+ db.creatCollections("name", options可选)创建集合
+ show collections展示集合
+ db.xxxx.drop()删除某个集合

文档操作
-
+ db.xxxx.insert()插入一个文档，也可以直接插入一个变量
+ db.xxxx.insertOne()插入一个新文档
+ db.xxxx.insertMany([], {ordered: true按顺序插入})插入多个文档
+ db.xx.update(<query>,<update>)更新文档
+ db.xx.deletedMany(<query>)删除多个文档
+ db.xx.deleteOne(<query>)删除文档
+ db.xx.find(<query>)查询文档
+ .pretty()易读模式
+ .limit()限制数量
+ .skip()跳过多少个数据
+ .sort()排序
+ .createIndex()可以添加方法
````
查询的query:
{<key>:<value>}为相等
{<key>:{$lt:<value>}}小于
{<key>:{$lte:<value>}}小于等于
{<key>:{$gt:<value>}}大于
{<key>:{$gte:<value>}}大于等于
{<key>:{$ne:<value>}}不等于
{<key>:{$lt:<value>},$or: [{<value>},{<value>}]}
````

聚合aggregate (复杂先🕊了)
--
aggregate([ 操作 ])
[教程位置](https://www.runoob.com/mongodb/mongodb-aggregate.html)
