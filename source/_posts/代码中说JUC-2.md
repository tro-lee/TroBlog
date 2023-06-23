---
title: 代码中说JUC-2
date: 2023-06-23 21:14:10
tags:
    - JAVA
    - JUC
---
本系列是写在代码里的记录，用来记录juc的学习过程
<!-- more -->
具体代码在github里嗷~
````JAVA
/*
本章是对并发的共享模型的学习
 */
@Slf4j(topic = "n3")
public class n3 {

    /*
    首先尝试，两个线程同时对一个静态变量进行操作，会不会出问题
     */
    static int res = 0;

    @Test
    public void problem5000() throws InterruptedException {
        // 一个线程+，一个线程-，看看数据有没有变化
        // 首先定义好两个线程
        Thread add = new Thread(() -> {
            for (int i = 0; i < 5000; i++) {
                res++;
            }
        });

        Thread sub = new Thread(() -> {
            for (int i = 0; i < 5000; i++) {
                res--;
            }
        });
        add.start();
        sub.start();
        add.join();
        sub.join();

        log.debug(String.valueOf(res)); // 可能==0，可能!=0

        /*
        最后可以看到结果并不是0，由于分时系统，导致可能并没有写进数据，而时间片用完被收回
        为什么没有写进去呢？

        查看字节码(--)可以知道，静态变量的处理是四个操作指令。 ++类似
        getstatic #29 <ln/n3/n3.res : I> 把常量池索引为29的静态字段的值放到操作栈上
        >> 0
        iconst_1 把1推到操作栈上
        >> 0->1
        isub 执行减操作
        >> -1
        putstatic #29 <ln/n3/n3.res : I> 把操作栈的数放到索引为29的静态字段上
        >>

        上面是正常情况下，单线程的读写操作，那多线程呢？
        getstatic
        >> 0
        iconst_1
        >> 0->1
        isub
        >> -1
                       |getstatic
                       >> 0
                       iconst_1
                       >> 0->1
                       iadd
                       >> 1
                       putstatic
                       >>   写入静态变量1
         putstatic
         >>    写入静态变量-1
         这时原本好端端的0，就被迟来的指令改变了，成为了-1
         */
    }

    /*
    可以使用互斥锁，将对象锁住进行操作
     */
    static Object lock = new Object();
    static Integer i = 0;

    @Test
    public void testSys() throws InterruptedException {
        Thread thread1 = new Thread(() -> {
            synchronized (lock) { //保证i++线程走完
                for (int i1 = 0; i1 < 500; i1++) {
                    i++;
                }
            }
        });
        Thread thread2 = new Thread(() -> {
            synchronized (lock) { // 保证循环内所有代码走完
                for (int i1 = 0; i1 < 500; i1++) {
                    i--;
                }
            }
        });

        thread1.start();
        thread2.start();

        thread1.join();
        thread2.join();

        log.debug("结果为：{}", i);

        /*
        类似分析
        线程1             |线程2              |锁对象
        ------------------------------------->获取锁
        getstati
        >> 0
        iconst_1
        >> 0->1
        isub
        >> -1
        时间片切换          |
                          -------------------->获取锁，获取失败，进入block阻塞状态，切换时间片
        putstatic
         >>写入静态变量-1
        ------------------------------------->释放锁，并唤醒所有阻塞状态线程
                           -------------------->获取锁
                           getstati
                           >> -1
                           iconst_1
                           >> -1->1
                           isub
                           >> 0
                           putstatic
                           >>写入静态变量0
                           -------------------->释放锁，并唤醒所有阻塞状态线程
         */

    }

    /*
    改进上面的方式，使用对象的方式进行保护
     */
    private static class Room {
        public int val = 0;

        public int getVal() {
            return val;
        }

        // 可以加在方法上面，相当于锁住了方法
        public synchronized void setVal(int val) {
            this.val = val;
        }

        public void addVal() {
            synchronized (this) {
                this.val++;
            }
        }

        public void subVal() {
            synchronized (this) {
                this.val--;
            }
        }
    }

    @Test
    public void testSysObject() throws InterruptedException {
        // 只需要调用方法即可，对象自身方法实现了对象锁
        Room room = new Room();
        Thread thread = new Thread(() -> {
            for (int i1 = 0; i1 < 500; i1++) {
                room.addVal();
            }
        });
        Thread thread1 = new Thread(() -> {
            for (int i1 = 0; i1 < 500; i1++) {
                room.subVal();
            }
        });
        thread.start();
        thread1.start();

        thread.join();
        thread1.join();

        log.debug("结果为：{}", room.getVal());
    }

    /*
    分析线程不安全的情况：
    1.  成员变量和静态变量分析，静态变量在方法区中，成员变量在堆（对象里）中
    它们如果是非共享的，没有安全问题
    如果是共享的，如果有临界区，则有安全问题
    2.  局部变量是否线程安全，局部变量在方法里，是线程安全的，但是局部变量引用的对象，安全问题
     */

    @Test
    public void threadUnsafe() {
        /*
         让多线程共享变量操作出现问题，因为list为共享变量，同时add实际会调用容量++，但容量++前面分析了，
         在写入的时候，时间片用完，无法写入，后续再进行写入，数据不齐，导致临界区发送竞态条件
         */
        // 定义一个内部类
        class tUnsafe {
            ArrayList<Integer> list = new ArrayList<>();

            public void add() {
                this.list.add(1);
            }

            public void remove() {
                this.list.remove(0);
            }
        }

        tUnsafe tu = new tUnsafe();
        // 不断操作tUnsafe对象
        for (int i1 = 0; i1 < 1000; i1++) {
            new Thread(() -> {
                for (; true; ) {
                    // 临界区
                    // 发生了竞态条件
                    tu.add();
                    tu.remove();
                }
            }, String.valueOf(i1)).start();
        }
    }

    @Test
    public void threadSafe() throws InterruptedException {
        /*
         在这里，list为局部变量，仅在一个方法中，不同方法的list不同，不干扰
         */
        // 定义一个内部类
        class tSafe {
            public void m1() {
                ArrayList<Integer> list = new ArrayList<>();
                add(list);
                remove(list);
            }

            public void add(ArrayList<Integer> list) {
                list.add(1);
            }

            public void remove(ArrayList<Integer> list) {
                list.remove(0);
            }
        }

        tSafe ts = new tSafe();

        // 由于线程正常，则定个计时器
        Thread thread = new Thread(() -> {
            while (true) {
            }
        });
        thread.start();
        // 不断操作tSafe对象
        for (int i1 = 0; i1 < 1000; i1++) {
            new Thread(() -> {
                for (; true; ) {
                    ts.m1();
                }
            }, String.valueOf(i1)).start();
        }
        thread.join(100);
    }

    // 局部变量如果被暴露在外面，则还是会出现临界区
    @Test
    public void threadExpose() throws InterruptedException {
        class t {
            public void m1() {
                // 可以看到，即使只操作一遍，但是由于多个线程共同操作共享变量，也会出现竞态条件
                ArrayList<Integer> list = new ArrayList<>();
                System.out.println(System.identityHashCode(list));
                add(list);
                remove(list);
            }

            public void add(ArrayList<Integer> list) {
                list.add(1);
            }

            public void remove(ArrayList<Integer> list) {
                list.remove(0);
            }
        }

        // 这里继承重写方法，相当于多开了线程
        class t1 extends t {
            @Override
            public void add(ArrayList<Integer> list) {
                new Thread(() -> {
                    list.add(1);
                }).start();
            }

            @Override
            public void remove(ArrayList<Integer> list) {
                new Thread(() -> {
                    list.remove(0);
                }).start();
            }
        }

        t1 t1 = new t1();

        Thread thread = new Thread(() -> {
            for (; true; ) {
                t1.m1();
            }
        });

        thread.start();
        thread.join();
    }

    /*
    String 和 Integer为不可变类，保证线程安全，因为它不可变
     */
    @Test
    public void testNo() {
        String a = "12345";
        System.out.println(System.identityHashCode(a));
        a = "2";
        System.out.println(System.identityHashCode(a));
        System.out.println(System.identityHashCode("2"));

        Integer b = 129;
        System.out.println(System.identityHashCode(b));
        b = 130;
        System.out.println(System.identityHashCode(b));
        System.out.println(System.identityHashCode(130));

        // 顺便说明在java中Integer，若取值在-127~127之间，则对象相同，
        // 因为：
        for (int i1 = 0; i1 < 300; i1++) {
            Integer c = i1;
            if (System.identityHashCode(c) != System.identityHashCode(i1)) {
                System.out.println(i1);
                break;
            }
        }
    }

    /*
    探索轻量级锁
    先加轻量级锁，在java虚拟机栈里存有栈帧lockRecord
     */
    @Test
    public void lightLock() {
        final Object o = new Object();
        // 首先Object对象头MonitorWord和主线程的lockRecord的MonitorWord相似的部分交换,
        // 使得还没上锁的o，状态从01变成了monitorWord的00，同时记录相应的lockRecord信息
        synchronized (o) {
            // 查看如果是在本线程，就是只增加一个栈帧lockRecord，然后记录信息为null
            synchronized (o) {
                log.debug("hi");
            }
        }

        // 这是简单且理想状态下：
        /*
         1.有线程已经拥有对象，则进入锁膨胀阶段
         锁膨胀流程：
         首先把原先的00，换成10，前面那两位（XX 10 MonitorWord4个字节）指向一个monitor对象
         type monitor {
            Thread owner;
            Thread[] waitSet;
            Thread[] entitySet;
         }
         entitySet把要申请锁的线程添加，并变成阻塞状态。

         在解锁的时候，原先线程先尝试轻量级解锁方式，就是简单的交换monitorWord，如果行不通，则变成重量级锁解锁方式
         2.自己线程已经拥有对象，则空加lockRecord
         */
    }

    // 探索偏向锁 Biased
    // 在这里用了新的jar包，jol
    // 记得vm参数有开启偏向锁
    @Test
    public void biasedLock() {
        // 在这里先随便创建一个对象
        ArrayList<Integer> o = new ArrayList<>();

        // 先打印一下，看到
        // 0 8 (object header: mark) 0x0000000000000005 (biasable; age: 0)
        // 说明上锁
        log.debug(ClassLayout.parseInstance(o).toPrintable());

        // 使用锁
        synchronized (o) {
            // 打印
            // 说明上锁，并标记线程为···
            // 例如：0   8 (object header: mark) 0x000002d4e42bc005 (biased: 0x00000000b5390af0; epoch: 0; age: 0)
            log.debug(ClassLayout.parseInstance(o).toPrintable());
        }

        // 线程直接使用锁
        log.debug(ClassLayout.parseInstance(o).toPrintable());

        // 换个线程使用
        // 切换轻量级锁
        Thread thread = new Thread(() -> {
            synchronized (o) {
                log.debug(ClassLayout.parseInstance(o).toPrintable());
            }
        });

        thread.start();

        // 最后检查，发现最后回到01，无锁
        try {
            thread.join();
            log.debug(ClassLayout.parseInstance(o).toPrintable());
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }
    }

    // 小贴士：用hashCode会禁用偏向锁
    @Test
    public void hashCodeMagic() {
        Object o = new Object();
        o.hashCode();

        // 例如：
        // 0   8        (object header: mark)     0x000000146ba0ac01 (hash: 0x146ba0ac; age: 0)
        log.debug(ClassLayout.parseInstance(o).toPrintable());
        // 因为0 01状态（无锁）下，存储31位hashcode，
        // 但是在1 01状态（偏向锁）下，不能存储hashcode，所以在调用hashCode后，不会给hashCode

        // 那为什么不是偏向锁，轻量级锁和重量级锁没有hashcode，却能查询呢？
        // 因为追起溯源，其实是markWord是交换过来的信息，也就是说线程存储之前交换的信息，可以用它找到hashCode
        // 准确来说，轻量级锁存在线程栈帧里
        // 重量级锁存在monitor对象里
        // 而用偏向锁的话，直接是覆盖掉了，不是交换过去还存在
        synchronized (o) {
            o.hashCode();
            log.debug(ClassLayout.parseInstance(o).toPrintable());
        }
    }

    /*
    偏向锁撤销：
    1.使用hashCode
    2.使用wait notify (只有重量级锁才有)
    3.使用过一次其他的锁
    4.批量撤销了，在之后类新建的对象也不会上偏向锁了
     */
    @Test
    public void testBatch() {
        class Dog {
        }

        LinkedList<Dog> dogs = new LinkedList<>();

        // 首先测试批量重偏向
        Thread thread1 = new Thread(() -> {
            for (int i1 = 0; i1 < 50; i1++) {
                Dog dog = new Dog();
                synchronized (dog) {
                    dogs.add(dog);
                }
            }

            synchronized (dogs) {
                dogs.notify();
            }
        }, "t0");

        Thread thread2 = new Thread(() -> {
            // 等待和打印
            synchronized (dogs) {
                try {
                    dogs.wait();
                } catch (InterruptedException e) {
                    throw new RuntimeException(e);
                }
            }
            log.debug(ClassLayout.parseInstance(dogs.get(0)).toPrintable()); // 看第一个和最后一个是否上偏向锁d
            log.debug(ClassLayout.parseInstance(dogs.get(dogs.size() - 1)).toPrintable());

            for (Dog dog : dogs) {
                synchronized (dog) {
                }
            }

            log.debug(ClassLayout.parseInstance(dogs.get(0)).toPrintable()); // 看第一个和最后一个是否上偏向锁d
            log.debug(ClassLayout.parseInstance(dogs.get(dogs.size() - 1)).toPrintable());
        }, "t1");

        thread1.start();
        thread2.start();

        try {
            thread1.join();
            thread2.join();
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }

        // 因为之前是达到20次，就重偏向2了，所以需要再来20次
        for (Dog dog : dogs) {
            synchronized (dog) {
            }
        }
        log.debug(ClassLayout.parseInstance(dogs.get(0)).toPrintable()); // 看第一个和最后一个是否上偏向锁d
        log.debug(ClassLayout.parseInstance(dogs.get(dogs.size() - 1)).toPrintable());

        // 达到40次后，再无重偏向了
        log.debug(ClassLayout.parseInstance(new Dog()).toPrintable());
    }

}
````
