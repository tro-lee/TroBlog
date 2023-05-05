---
title: 了解gRPC
date: 2023-05-04 22:28:42
tags: [Go]
---
RPC是一种远程调用的方法，可以在不同的机器上调用函数，但是调用者不需要知道函数在哪个机器上，只需要知道函数名和参数即可。
<!-- more -->
**gRPC是RPC框架，接口描述语言是Protobuf(一种IDL)**

# 1.简略一元RPC方式
+ ### 首先写Proto文件，定义函数名和参数
````proto
syntax = "proto3";

package helloWorld;

option go_package = "./proto";

service Greeter {
  rpc SayHello (HelloRequest) returns (HelloReply) {}
}

message HelloRequest {
  string name = 1;
}

message HelloReply {
  string message = 1;
}
````
本Proto文件首先声明了使用proto3语法，定义了Greeter的RPC服务，
其中RPC的方法为SayHello，入参为消息体HelloRequest，出参为HelloReply，
还定义了这两个消息体。

+ ### Server部分
````go
var port string

func init() {
	flag.StringVar(&port, "port", "8080", "port to listen on")
	flag.Parse()
}

type server struct {
	pb.UnimplementedGreeterServer
}

func (s *server) SayHello(ctx context.Context, r *pb.HelloRequest) (*pb.HelloReply, error) {
	fmt.Println(r.Name)
	return &pb.HelloReply{Message: "Hello " + r.Name}, nil
}

func main() {
	//生成一个grpc服务器
	s := grpc.NewServer()
	//注入实例
	pb.RegisterGreeterServer(s, &server{})

	lis, _ := net.Listen("tcp", ":"+port)
	err := s.Serve(lis)
	if err != nil {
		panic(err)
	}
}
````
- 创建了grpc Server端的抽象对象
- 然后将server（包含服务端接口）注入到s中
- 创建Listen监听TCP
- s.Serve()开启服务

+ ### Client部分
````go
var port string

func init() {
	flag.StringVar(&port, "port", "8080", "port to listen on")
	flag.Parse()
}

func SayHello(client pb.GreeterClient) error {
	resq, _ := client.SayHello(context.TODO(), &pb.HelloRequest{Name: "world"})
	fmt.Println(resq.Message)
	return nil
}

func main() {
	//创建与服务端的连接句柄
	conn, _ := grpc.Dial("127.0.0.1:8080", grpc.WithTransportCredentials(insecure.NewCredentials()))
	defer conn.Close()
	//创建客户端对象
	client := pb.NewGreeterClient(conn)
	//发出请求
	_ = SayHello(client)
}
````
- 创建与服务端的连接句柄
- 创建客户端对象
- 发出请求

> 这样一元RPC就完成啦，分别配置好server（创建服务器，注入接口，启动监听开启服务器），client（连接句柄，创建客户端对象，发出请求）

# 2.流式RPC方式
> 由于一元rpc可能会出现数据包过大造成瞬时压力，需要等待所有数据报接受成功才响应的问题，出现流式rpc
> 
> 流式RPC使用stream关键字，分为客户端流式和服务端流式，还有双向流式

直接说双向流式
+ ### 首先写Proto文件，定义函数名和参数
````proto
rpc SayRoute (stream HelloRequest) returns (stream HelloReply) {}
````
+ ### Server部分
````go
func (s *server) SayRoute(stream pb.Greeter_SayRouteServer) error {
	n := 0
	for {
		_ = stream.Send(&pb.HelloReply{Message: "hi Route"})
		r, err := stream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
		n++
		println(r.Name, n)
	}
}
````
+ ### Client部分
````go
func SayRoute(client pb.GreeterClient, r *pb.HelloRequest) error {
	stream, _ := client.SayRoute(context.Background())
	for i := 0; i < 10; i++ {
		_ = stream.Send(r)

		fmt.Println("1")
		resp, err := stream.Recv()

		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		fmt.Println(resp.Message)
	}
	return nil
}
````
> stream.Send()和stream.Recv()分别是发送和接受数据，这里的消息体是HelloRequest和HelloReply。
> stream.Send()和stream.Recv()是阻塞的，所以需要在另一个goroutine中执行

服务端流式类似，服务器使用stream.Send()发送数据，客户端使用stream.Recv()接受数据

客户端流式，客户端不断使用stream.Send()最后使用stream.CloseAndRecv(),服务器使用Recv()和SendAndRecv()

> gRPC暂时先写到这啦，现在对rpc没有什么需求，大致了解一下
