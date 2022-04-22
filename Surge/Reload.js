$httpAPI("POST", "/v1/profiles/reload", {}, data => {
    $notification.post("配置重载","配置重载成功","")
    $done({
        title: "配置重载",
        content: "配置重载成功",
        icon: "terminal",
        "icon-color": "#5AC8FA",
     })
    });