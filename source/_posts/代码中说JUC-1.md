---
title: 代码中说JUC-1
date: 2023-06-23 21:08:40
tags: 
  - Java
  - JUC
---
本系列是写在代码里的记录，用来记录juc的学习过程
<!-- more -->
具体代码在github里嗷~
````Java
/*
  线程常用方法
  @author trotro
 */
@Slf4j(topic = "n2")
public class n2 {
    /*
      创建线程
      列举主要三种模式
     */
    @Test
    public void creatThread() {
        // 第一种创建线程方法
        // 直接使用Thread类，写一个匿名内部类，同时重写run方法
        Thread thread = new Thread("innerClass") {
            //重写run
            @Override
            public void run() {
                log.debug("running");
            }
        };
        thread.start();

        // 第二种使用Runnable配合Thread
        // 实现Runnable方法
        Runnable running2 = new Runnable() {
            @Override
            public void run() {
                log.debug("running2");
            }
        };
        Thread thread1 = new Thread(running2, "Runnable");
        thread1.start();

        // 第二点五种使用Lambda配合Thread
        // 比较常用嗷
        Thread thread2 = new Thread(() -> log.debug("running3"), "lambda");
        thread2.start();

        // 第三种使用FutureTask配合Thread
        // FutureTask能够接受返回值

        FutureTask<Integer> task = new FutureTask<>(() -> {
            log.debug("task");
            return 100;
        });
        Thread thread3 = new Thread(task, "Future");
        thread3.start();
        try {
            log.debug("出现结果:{}", task.get());
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        } catch (ExecutionException e) {
            throw new RuntimeException(e);
        }


        log.debug("main");
    }


    /*
      观察线程
      看到线程交替运行
      1.使用window(tasklist)或linux(ps)(top -H -p pid查看这个pid的所有进程实时)提供的查看方式
      2.jps 查看所有java的进程，和pid
      3.jstack pid 查看该pid的所有进程
      4.jconsole pid 图形化查看pid
     */
    @Test
    public void watch() throws InterruptedException {
        new Thread(() -> {
            while (true) {
                log.debug("running");
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    throw new RuntimeException(e);
                }
            }
        }, "t1").start();

        new Thread(() -> {
            while (true) {
                log.debug("2Running");
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    throw new RuntimeException(e);
                }
            }
        }, "t2").start();

        TimeUnit.SECONDS.sleep(2);
    }

    /*
     使用Debug 观察栈帧，可以看到线程是在操作中可以随时创建的
     上下文切换：
     触发线程的被动方法，例如时间片用完（任务调度器在时钟提醒后，会进行任务调度切换线程）、
     垃圾回收（在垃圾回收的时候，会切换线程到垃圾回收的线程）、有更高的优先级线程调用

     触发上下文切换的主动方法，
     线程内部使用{Thread.sleep()}将对cpu的使用放弃xx秒
     {Thread.yield}主动放弃对cpu的使用，优先让其他线程使用
     {thread.wait()}（不建议直接使用wait）让当前线程等待直到它被唤醒，通常是通过通知或中断
     {thread.join()}同上
     {park synchronized lock}同样也会触发上下文切换
     */
    @Test
    public void frames() {
        Thread thread = new Thread(() -> {
            try {
                Thread.sleep(1000);
                log.debug("hihi");
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
        });
        thread.start();
        new Thread(() -> {
            try {
                Thread.sleep(1000);
                log.debug("hihi");
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
        }).start();

        log.debug(String.valueOf(System.nanoTime()));
    }

    /*
      常用方法：
      start与run
     */
    @Test
    public void methods() {
        // 运行可以看到线程名字为main，所以run只是单纯调用关系
        Thread thread = new Thread(() -> {
            log.debug(Thread.currentThread().getName());
        });
        thread.start();
        thread.run();
        log.debug("start");

        log.debug(">>>>>>>>");
        // 打断
        Thread thread1 = new Thread(() -> {
            synchronized (Thread.class) {
                log.debug("sleep");
                try {
                    TimeUnit.SECONDS.sleep(1);
                    TimeUnit.MILLISECONDS.sleep(2);
                } catch (InterruptedException e) {
                    log.debug("wake up!");
                    throw new RuntimeException(e);
                }
            }
        });
        thread1.start();
        try {
            Thread.sleep(1000);
            thread1.interrupt();
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }
    }

    /*
      优先级和yield
     */
    @Test
    public void yieldP() throws ExecutionException, InterruptedException {
        // 定义方法变量
        AtomicInteger res0 = new AtomicInteger();
        AtomicInteger res1 = new AtomicInteger();
        Thread thread = new Thread(() -> {
            while (true) {
                if (Thread.currentThread().isInterrupted()) {
                    break;
                }

                res0.getAndIncrement(); // +1
            }
        });
        Thread thread1 = new Thread(() -> {
            while (true) {
                if (Thread.currentThread().isInterrupted()) {
                    break;
                }

                try {
//                    Thread.yield();
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
                res1.getAndIncrement(); // +1
            }
        });

//        thread.setPriority(Thread.MAX_PRIORITY);
//        thread1.setPriority(Thread.MIN_PRIORITY);


        // 启动线程
        thread.start();
        thread1.start();

        TimeUnit.SECONDS.sleep(2);
        thread.interrupt();
        thread1.interrupt();

        // 查看结果
        log.debug("thread0:{}", res0.get());
        log.debug("thread1:{}", res1.get());

        /*
        可以看到，yield()对线程的影响还是十分大的。
        向调度程序提示当前线程愿意放弃其当前对处理器的使用。调度程序可以随意忽略此提示。
        Yield 是一种启发式尝试，旨在改善线程之间的相对进度，否则会过度使用 CPU。它的使用应与详细的分析和基准测试相结合，以确保它确实具有预期的效果。
        使用这种方法很少是合适的。它可能对调试或测试有用，因为它可能有助于重现由于竞争条件导致的错误。在设计并发控制结构（如java.util.concurrent.locks包中的结构）时，它也可能很有用。
         */
    }

    /*
     join的使用场景
     */
    @Test
    public void testJoin() {
        Thread thread = new Thread(() -> {
            try {
                TimeUnit.SECONDS.sleep(2);
                log.debug("yeyeyeyey");
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
        });
        thread.start();
        log.debug("不使用join");
        log.debug("线程状态：{}", thread.getState());

        log.debug(">>>>>>>");
        try {
            thread.join();
            log.debug("线程状态：{}", thread.getState());
            log.debug("使用join");
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }
    }

    /*
    打断标记
     */
    @Test
    public void interruptFlag(){
        // 1.在正常情况下（非sleep，wait，join阻塞状态时候）进行打断，会标记上打断标记
        // 注意，这种情况下不会停止线程运行
        Thread thread = new Thread(() -> {
            while (true) {
//                可以用来手动停止线程运行
//                if (Thread.currentThread().isInterrupted()) {
//                    break;
//                }
            }
        });

        // 开始
        log.debug("start");
        thread.start();
        try {
            TimeUnit.SECONDS.sleep(2);
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }

        //两秒后打断
        log.debug("interrupt");
        thread.interrupt();

        //查看状态
        log.debug("打断标记：{}", thread.isInterrupted());
        log.debug("线程状态:{}", thread.getState()); //仍然运行
        try {
            TimeUnit.SECONDS.sleep(5);
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }



        log.debug(">>>>>>>>>>>>.");



        // 2.在sleep,或者wait、join的时候打断，会是false，因为trycatch直接捕获了异常
        Thread interruptSleep = new Thread(() -> {
            try {
                TimeUnit.SECONDS.sleep(2);
            } catch (InterruptedException e) {
                log.warn(e.toString());
            }
        });

        // 开始
        interruptSleep.start();
        try {
            TimeUnit.SECONDS.sleep(1);
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }

        //一秒后打断
        interruptSleep.interrupt();
        log.debug("打断标记为:{}", interruptSleep.isInterrupted());
        log.debug("线程状态:{}", interruptSleep.getState()); //TERMINATED 终止
    }

    /*
    打断标记interrupted和park
     */
    @Test
    public void interruptAndPark() throws InterruptedException {
        Thread thread = new Thread(() -> {
            // park是locks的方法，用来让线程处阻塞状态
            log.debug("park");
            LockSupport.park();
            log.debug("unpark，打断标记为：{}", Thread.currentThread().isInterrupted());

            LockSupport.park();
            log.debug("由于打断标记为true，park无用");
        });

        thread.start();

        // 1秒后打断
        TimeUnit.SECONDS.sleep(1);
        thread.interrupt();

        thread.join();

//        >>>>>>
        Thread thread1 = new Thread(() -> {
            log.debug("park");
            LockSupport.park();
            log.debug("unpark, 打断标记为:{}，顺便清楚打断标记", Thread.interrupted());

            LockSupport.park();
            log.debug("unpark，看不见嗷");
        });

        thread1.start();

        // 1秒后打断
        TimeUnit.SECONDS.sleep(1);
        thread1.interrupt();

        thread1.join();
    }

    @Test
    public void testThread() throws InterruptedException {
        Thread thread = new Thread(() -> {
            while(true) {
                if (Thread.currentThread().isInterrupted()) {
                    break;
                }
            }
            log.debug("结束了");
        }, "t1");

        thread.start();

        TimeUnit.SECONDS.sleep(2);

        log.debug("我go啦");
    }
}
````
