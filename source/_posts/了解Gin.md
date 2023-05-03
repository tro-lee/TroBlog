---
title: 了解Gin
date: 2023-04-27 20:01:15
tags: [语言]
---
Go的框架很多，gin是其中一个，通过研究gin的源代码，来了解gin的实现原理，以及gin的使用方法。
<!-- more -->

> Gin整体流程
> 
> gin.Default
> 
> gin.New
> 
> e.Get
> 
> e.Run
>
> gin为包名，e为实例名

# 1.首先了解Engine与RouterGroup
以下是Engine的结构体定义
````go
type Engine struct {
	RouterGroup
	//是否自动重定向
	RedirectTrailingSlash bool

	//是否支持格式清楚与不区分大小写重定向
	RedirectFixedPath bool

	//判断当前路由是否允许调用其他方法，是否可以返回Method Not Allowed和NotFound Handler
	HandleMethodNotAllowed bool

	//如果开启，尽可能返回真实客户端ip
	ForwardedByClientIP bool

	//当ForwardedByClientIP为true时，同时信任ip，存入X-Forwarded-For和X-Real-IP
	RemoteIPHeaders []string

	// If set to a constant of value gin.Platform*, trusts the headers set by
	// that platform, for example to determine the client IP
	TrustedPlatform string

	// Value of 'maxMemory' param that is given to http.Request's ParseMultipartForm
	// method call.
	MaxMultipartMemory int64

	// RemoveExtraSlash a parameter can be parsed from the URL even with extra slashes.
	// See the PR #1817 and issue #1644
	RemoveExtraSlash bool

	delims           render.Delims
	secureJSONPrefix string
	HTMLRender       render.HTMLRender
	FuncMap          template.FuncMap
	allNoRoute       HandlersChain
	allNoMethod      HandlersChain
	noRoute          HandlersChain
	noMethod         HandlersChain
	pool             sync.Pool
	trees            methodTrees
	maxParams        uint16
	maxSections      uint16
	trustedProxies   []string
	trustedCIDRs     []*net.IPNet
}
````
关键属性为RouterGroup，RouterGroup是一个结构体，定义如下：
````go
type RouterGroup struct {
	Handlers HandlersChain
	basePath string
	engine   *Engine
	root     bool
}
````
通过这两个关键结构体，来对gin进行全局设置

# 2.了解gin.Default与gin.New
由gin.Default方法可知:
````go
func Default() *Engine {
    debugPrintWARNINGDefault() //打印警告信息
    engine := New() //创建一个Engine
    engine.Use(Logger(), Recovery()) //使用Logger和Recovery中间件
    return engine
}
````
gin.Default方法中，调用了gin.New方法，而gin.New对整体的Engine进行了初始化.

> engine.Use(Logger(), Recovery())，把Logger和Recovery中间件添加到了Engine中HandlersChain中


# 3.e.GET
gin的注册方法都使用handle：
````go
// POST is a shortcut for router.Handle("POST", path, handle).
func (group *RouterGroup) POST(relativePath string, handlers ...HandlerFunc) IRoutes {
	return group.handle(http.MethodPost, relativePath, handlers)
}
// GET is a shortcut for router.Handle("GET", path, handle).
func (group *RouterGroup) GET(relativePath string, handlers ...HandlerFunc) IRoutes {
	return group.handle(http.MethodGet, relativePath, handlers)
}
····
````
handler的代码如下：
````go
func (group *RouterGroup) handle(httpMethod, relativePath string, handlers HandlersChain) IRoutes {
	absolutePath := group.calculateAbsolutePath(relativePath)
	handlers = group.combineHandlers(handlers)
	group.engine.addRoute(httpMethod, absolutePath, handlers)
	return group.returnObj()
}
````
首先计算出绝对路径（基础路径+相对路径），然后合并当前的Handler，创建HandlersChain，添加当前注册的路由规则到路由树

> 浅看一下gin的路由树添加规则:
> gin给每一种请求方法都创建了一个路由树，每个路由树都是一个methodTree结构体
> 首先先找到路由树的根，判断这个根是否为空，如果为空，就创建一个根节点，然后将路由规则添加到根节点。

# 4.e.Run
````go
func (engine *Engine) Run(addr ...string) (err error) {
    defer func() { debugPrintError(err) }()

    address := resolveAddress(addr)
    debugPrint("Listening and serving HTTP on %s\n", address)
    err = http.ListenAndServe(address, engine)
    return
}
````
此方法关键是使用了**http.ListenAndServe**方法，将Engine作为参数传入，然后监听端口，等待请求。
由于Engine实现了ServeHTTP方法，所以可以将Engine作为参数传入ListenAndServe方法中。
````go
func (engine *Engine) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	c := engine.pool.Get().(*Context)
	c.writermem.reset(w)
	c.Request = req
	c.reset()

	engine.handleHTTPRequest(c)

	engine.pool.Put(c)
}
````
ServeHTTP方法中，首先从sync.Pool中获取一个Context， 然后将ResponseWriter和Request赋值给Context，
然后调用handleHTTPRequest方法处理外部HTTP请求，最后将Context放回sync.Pool中。

# 总结
gin的使用方法很简单，通过gin.Default()或者gin.New()创建一个Engine，然后通过Engine的GET、POST等方法注册路由规则，最后通过Engine的Run方法监听端口，等待请求。
gin重写了net/http的route，通过ServeHTTP方法，将Engine作为参数传入ListenAndServe方法中，进行监听，通过自身的路由树匹配规则，来实现更快的响应。
