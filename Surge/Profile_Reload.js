$httpAPI("POST", "/v1/profiles/reload", {}, data => {
   var now = new Date();
   var month = now.getMonth()+1;
   var date = now.getDate();
   var hour = now.getHours();
   var minutes = now.getMinutes();
   var monthArray=new Array("Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec");
   hour = hour > 9 ? hour : "0" + hour;
   minutes = minutes > 9 ? minutes : "0" + minutes;
    $done({
        title: "配置重载",
        content: "Last runtime:  "+monthArray[month]+" "+date+", "+hour+":"+minutes,
        icon: "terminal",
        "icon-color": "#00B1FF",
     })
    }); 