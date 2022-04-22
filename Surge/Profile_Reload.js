$httpAPI("POST", "/v1/profiles/reload", {}, data => {
    $done({
        title: "配置重载",
        content: "配置重载成功",
        icon: "terminal",
        "icon-color": "#00B1FF",
     })
    });