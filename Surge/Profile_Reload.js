$httpAPI("POST", "/v1/profiles/reload", {}, data => {
   let now = new Date();
   let hour = now.getHours();
   let minutes = now.getMinutes();
   hour = hour > 9 ? hour : "0" + hour;
   minutes = minutes > 9 ? minutes : "0" + minutes;
    $done({
        title: "配置重载",
        content: "配置重载成功，"+now+" "+hour+":"+minutes,
        icon: "terminal",
        "icon-color": "#00B1FF",
     })
    });