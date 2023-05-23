---
title: 学习gin的路由树
date: 2023-05-18 21:15:47
tags: [Go]
---
通过学习和写Gin的路由树，学习路由匹配知识
<!-- more -->
## 提要
通过创建路由节点，匹配子节点，插入与搜索节点，再搭配路由的插入与搜索，来实现路由。

### 首先要创建路由节点，搭建好路由树的操作方法
````Golang
// 路由树节点，主要是树的操作，通过matchChild与matChildren搜索子节点，insert与search完成树基本操作
type node struct {
	pattern  string  //匹配路由
	part     string  //路由中的一部分
	children []*node //子节点
	isWild   bool    //是否精确匹配，part含有:或*时为true
}

// matchChild 匹配子节点，返回第一个匹配成功的节点，用于插入
func (n *node) matchChild(part string) *node {
	for _, child := range n.children {
		//如果子节点的part与要匹配的part相同，或者子节点的part为通配符，则返回该子节点
		if child.part == part || child.isWild {
			return child
		}
	}
	return nil
}

// matchChildren 匹配子节点，返回所有匹配成功的节点，用于查找
func (n *node) matchChildren(part string) []*node {
	nodes := make([]*node, 0)
	for _, child := range n.children {
		//如果子节点的part与要匹配的part相同，或者子节点的part为通配符，则返回该子节点
		if child.part == part || child.isWild {
			nodes = append(nodes, child)
		}
	}
	return nodes
}

// insert 插入节点，height说是第几层就是第几层，遇到没有的就自己填上，遇到有的就继续向下插入
func (n *node) insert(pattern string, parts []string, height int) {
	if len(parts) == height { //递归结束条件
		n.pattern = pattern
		return
	}

	part := parts[height]       //获取当前层级的part
	child := n.matchChild(part) //获取当前层级的part对应的子节点
	if child == nil {
		child = &node{part: part, isWild: part[0] == ':' || part[0] == '*'}
		n.children = append(n.children, child)
	}

	child.insert(pattern, parts, height+1) //递归插入子节点
}

// search 查询，不断匹配part，查询到路径的那个点
func (n *node) search(parts []string, height int) *node {
	//只要出现*，则不再进行后续搜索
	if len(parts) == height || strings.HasPrefix(n.part, "*") { //递归结束条件
		if n.pattern == "" { //如果当前节点的pattern为空，则说明没有匹配到
			return nil
		}
		return n
	}

	part := parts[height]             //获取当前层级的part
	children := n.matchChildren(part) //获取所有对应的子节点，包括*与:

	for _, child := range children {
		result := child.search(parts, height+1)
		if result != nil {
			return result
		}
	}

	return nil
}
````
> 通过matchChild与matchChildren完成基本的子节点搜索
>
> 在插入过程中，直至匹配到响应的层数，就进行插入操作，如果没有匹配到，则新建一个节点，然后继续插入
> 
> 在搜索过程中，不断匹配part，直至匹配到最后一层，或者遇到*，则不再进行后续搜索

### 创建路由树，搭建好路由树的操作方法
````Golang
// Router 路由，用于存储路由信息
type Router struct {
	roots    map[string]*node
	handlers map[string]HandlerFunc
}

// parsePattern 解析路由，辅助函数，将pattern拆分parts
func parsePattern(pattern string) []string {
	vs := strings.Split(pattern, "/")

	//所以不支持/*hi/hihi/hi,没有后续，只能到/*hi
	parts := make([]string, 0)
	for _, item := range vs {
		if item != "" {
			parts = append(parts, item)
			if item[0] == '*' {
				break
			}
		}
	}

	return parts
}

// addRoute 添加路由，存入路由树与handlers方法中
func (router *Router) addRoute(method string, pattern string, handler HandlerFunc) {
	parts := parsePattern(pattern)

	//存入节点，以方法为树的基本节点
	_, ok := router.roots[method]
	if !ok {
		router.roots[method] = &node{}
	}
	router.roots[method].insert(pattern, parts, 0)

	//存入处理函数
	key := method + "-" + pattern
	router.handlers[key] = handler
}

// getRoute 获取路由，查询节点与参数
func (router *Router) getRoute(method string, path string) (*node, map[string]string) {
	searchParts := parsePattern(path)
	params := make(map[string]string)

	root, ok := router.roots[method]
	if !ok {
		return nil, nil
	}

	//查询到这个点
	n := root.search(searchParts, 0)
	if n != nil {
		parts := parsePattern(n.pattern)
		for index, part := range parts {
			//如果为:，则添加到参数
			if part[0] == ':' {
				params[part[1:]] = searchParts[index]
			}
			if part[0] == '*' && len(part) > 1 {
				//如果为*，把路径后续添加到参数
				params[part[1:]] = strings.Join(searchParts[index:], "/")
				break
			}
		}
		return n, params
	}

	return nil, nil
}

// handle 处理请求，根据请求方法+请求路径，从map中取出对应的处理函数，执行
func (router *Router) handle(c *Context) {
	n, params := router.getRoute(c.Method, c.Path)
	if n != nil {
		c.Params = params
		key := c.Method + "-" + n.pattern
		router.handlers[key](c)
	} else {
		c.String(http.StatusNotFound, "404 NOT FOUND: %s\n", c.Path)
	}
}
````
> 在创建路由树的时候，需要将路由树与handlers方法都存起来，路由树用于查询，handlers用于执行。


#### 咳咳，内容较少，代码较多，逻辑还是比较清晰的
