---
title: Huffman树研究
date: 2022-10-18 19:16:10
tags: [数据结构]
---
记录研究Huffman树的实现
<!-- more -->
*大致思路为，Huffman树使用最优二叉树方式存储*

1.创建节点
-
````C
typedef struct HuffmanTNode {
    ElemType data;
    struct HuffmanTNode *left;
    struct HuffmanTNode *right;
    struct HuffmanTNode *parent;
} HuffmanTNode;
````
2.创建树
-
````C
class Compare {
public:
    bool operator()(HuffmanTNode *a, HuffmanTNode *b) {
        return a->data > b->data;
    }
}

HuffmanTNode * CreateHuffmanTNode() {
    priority_queue<HuffmanTNode *, vector<HuffmanTNode *>, Compare> nodes;
    //先给nodes中输入数据，输入0则停止
    while ( true ) {
        ElemType a;
        cin >> a;
        if ( a == 0 ) break;
        HuffmanTNode* T = new HuffmanTNode;
        T->data = a;
        T->left = nullptr;
        T->right = nullptr;
        T->parent = nullptr;
        nodes.push(T);
    }

    while ( nodes.size() > 1 ) {
        HuffmanTNode* a = nodes.top();
        nodes.pop();
        HuffmanTNode* b = nodes.top();
        nodes.pop();
        HuffmanTNode* cur = new HuffmanTNode;
        cur->data = a->data + b->data;
        cur->left = a;
        cur->right = b;
        a->parent = cur;
        b->parent = cur;

        nodes.push(cur);
    }

    return nodes.top();
}
````
创建一个优先队列，使其从小到大排序，输入数值后，通过不断合并前两项，建立Huffman树
