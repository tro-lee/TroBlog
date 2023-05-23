---
title: gin的中间件原理简单实现
date: 2023-05-19 10:07:13
tags: [Go]
---
通过向添加handlers中间件，并按顺序执行，实现中间件
<!-- more -->
## 原理
首先在上下文中添加属性中间件链，记录当前执行到第几个中间件的属性。
````golang
type Context struct {
	// 原生的参数
	Writer  http.ResponseWriter
	Request *http.Request

	// 请求信息
	Path   string
	Method string
	Params map[string]string

	// 响应信息
	StatusCode int

	//中间件
	handlers []HandlerFunc
	// index 用于记录当前执行到第几个中间件
	index int
}
````
然后在Context中添加Next方法，用于执行下一个中间件
````golang
// Next 向下执行中间件
// 当中间件调用Next()的时候，向后执行，然后再回来
func (c *Context) Next() {
	c.index++
	s := len(c.handlers)
	for ; c.index < s; c.index++ {
		c.handlers[c.index](c)
	}
}
````
> 为什么要在Context设置中间件相关的属性?
> 
> 因为Context是每个请求的上下文，每个请求都有自己的处理函数链，所以需要在Context中设置中间件相关的属性

因为在分组中，中间件才能发挥到真正的作用，所以在分组中也添加相关属性
````golang
// routerGroup 分组，提供引擎的基本方法
type routerGroup struct {
	prefix      string        //前缀
	middlewares []HandlerFunc //中间件，用于特殊处理
	parent      *routerGroup  //父组
	engine      *Engine       //所有分组使用同一个引擎
}

// Use 添加中间件
func (group *routerGroup) Use(middlewares ...HandlerFunc) {
	group.middlewares = append(group.middlewares, middlewares...)
}
````
这样，就可以给分组添加中间件啦。
在运行时，我们应该先处理分组中的中间件，然后再运行本身的调用函数，当然这些已经在上下文中实现，
我们只需要给上下文添加调用函数链，然后调用上下文即可。
````golang
// ServeHTTP 用于ListenAndServe调用，实现ServeHTTP接口
func (engine *Engine) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	var middlewares []HandlerFunc
	for _, group := range engine.groups {
		if strings.HasPrefix(req.URL.Path, group.prefix) {
			//装填所有有关的中间件
			middlewares = append(middlewares, group.middlewares...)
		}
	}
	c := newContext(w, req)
	// 赋值，用来调用Next()时，调用中间件，将组和上下文关联起来
	c.handlers = middlewares
	// 调用路由的处理函数
	engine.r.handle(c)
}

// handle 处理请求，根据请求方法+请求路径，从map中取出对应的处理函数，存入Context中
func (r *router) handle(c *Context) {
	n, params := r.getRoute(c.Method, c.Path)
	if n != nil {
		c.Params = params
		key := c.Method + "-" + n.pattern
		c.handlers = append(c.handlers, r.handlers[key])
	} else {
		c.handlers = append(c.handlers, func(context *Context) {
			context.String(404, "404 NOT FOUND: %s\n", context.Path)
		})
	}
	c.Next()
}
````
> 这样，我们就简单的实现了中间件。

> 大致就是这样的：调用路由处理函数时，将分组中的中间件添加到上下文中，然后调用上下文，执行中间件，最后执行路由处理函数。
