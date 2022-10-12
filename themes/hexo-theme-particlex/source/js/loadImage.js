!function (){
    function loadImage(obj, url, callback) {
        var img = new Image();
        img.src = url;

        // 判断图片是否在缓存中
        if (img.complete) {
            callback.call(img, obj);
            return;
        }

        // 图片加载到浏览器的缓存中回调函数
        img.onload = function () {
            callback.call(img, obj);
        }
    }

    function showImage(obj) {
        obj.src = this.src;
    }

    var imgs = document.querySelectorAll('img');

    for (var i = 0; i < imgs.length; i++) {
        console.log(1)
        var url = imgs[i].dataset.src;
        loadImage(imgs[i], url, showImage);
    }
} ()
