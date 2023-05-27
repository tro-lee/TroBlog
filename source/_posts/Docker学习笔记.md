---
title: Docker学习笔记
date: 2023-03-05 23:34:33
tags:
    - Docker
    - 云
---
Docker 是一个用于开发，交付和运行应用程序的开放平台。
<!-- more -->
*Docker 是一个开源的应用容器引擎，基于 Go 语言 并遵从 Apache2.0 协议开源。
Docker 可以让开发者打包他们的应用以及依赖包到一个轻量级、可移植的容器中，然后发布到任何流行的 Linux 机器上，也可以实现虚拟化。
容器是完全使用沙箱机制，相互之间不会有任何接口（类似 iPhone 的 app）,更重要的是容器性能开销极低。*

Docker容器使用
-
理解容器，它是从镜像中生成的一个容器，在这个容器之中，我们可以运行其中的项目
+ 启动容器 docker run xxxx
+ 启动一个已停止的容器 docker start XXX
+ 进入容器 docker attach xxx(退出容器会导致容器停止)/docker exec xxx(退出容器不会导致容器停止)
+ 退出容器 docker stop xxx
+ 导出与导入容器 docker export xxx > xxx / docker import xxxx
+ 删除容器docker rm -f xxx
Docker容器与宿主机的文件共享，可以使用-v参数，将宿主机的文件夹挂载到容器中，这样就可以实现容器与宿主机的文件共享，
也可以使用存储卷，将数据保存在本地，也可以保存在远程服务器上。

Docker镜像使用
-
容器都是根据镜像产生的，可以从镜像仓库下载产生，也可以自己生成，镜像的使用可以提供一个完整的环境。
+ docker images可以列出镜像
+ docker pull xxx获取新镜像
+ docker search 网络查找镜像
+ docker rmi xxx删除镜像
+ 在某容器里使用apt-get update更新，在外docker commit -m 描述 -a 作者 容器id 目标镜像
+ docker tag可以给镜像上标签

Docker网络
-
实现容器互联，类似创造了一个网络，容器通过端口实现通信
+ docker network create -d bridge网络类型 xxx 创造一个网络
+ docker network ls 展示所有网络
+ 在运行容器的时候,--network xxx作为参数设置网络

Docker Compose使用
-
通过Docker Compose方便管理Docker容器，准备好Docker-compose.yml
> yml配置参数为:
> version版本
> service：
>   build：指定为构建镜像上下文路径或者对象（Dockerfile路径）
>   其他参数看[这里](https://www.runoob.com/docker/docker-compose.html)

**当然直接用portainer也可以嗷**
*Partainer只需要安装一次即可，因为Partainer直接与Docker引擎交互，能够全局监控Docker的所有容器。*

Docker Volume
-
docker存储卷，由于容器的生命周期是短暂的，容器内的数据也会随之消失，所以需要使用存储卷，可以将数据保存在本地，也可以保存在远程服务器上。
+ docker volume create xxx创建存储卷
+ docker volume ls查看存储卷
+ docker volume inspect xxx查看存储卷信息
+ docker volume rm xxx删除存储卷

Docker修改日志大小
-
docker默认日志大小为100M，可以通过修改配置文件来修改日志大小
````
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
````
