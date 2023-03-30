---
title: springboot集成websocket
date: 2023-03-22 15:58:36
tags: [技术]
---
WebSocket协议，它实现了浏览器与服务器全叆工通信，允许服务端主动向客户端推送信息。这使得得到服务器数据的传送变得更加简单，更加实时。
<!-- more -->

依赖
-
````
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>
````
启用WebSocket
-
````Kotlin
@Configuration
class WebSocketStompConfig {
    //扫描注解成websocket
    @Bean
    fun serverEndpointExporter(): ServerEndpointExporter {
        return ServerEndpointExporter()
    }
}
````
配置WebSocket服务
-
````Kotlin

