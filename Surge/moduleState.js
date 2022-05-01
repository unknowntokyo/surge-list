!(async () => {
    let panel = { title: "Module Switch", icon: "puzzlepiece.extension" },
        module = "router.com",
        moduleState,
        color1,
        color2;
    if (typeof $argument != "undefined") {
        let arg = Object.fromEntries($argument.split("&").map((item) => item.split("=")));
        if (arg.module) module = panel.title = arg.module;
        if (arg.title) panel.title = arg.title;
        if (arg.icon) panel.icon = arg.icon;
        if (arg.color1) color1 = arg.color1;
        if (arg.color2) color2 = arg.color2;
    }
    if ($trigger == "button") {
        moduleState = (await httpAPI("/v1/modules")).enabled.includes(module);
        let moduleBody = {};
        moduleBody[module] = !moduleState;
        await httpAPI("/v1/modules", "POST", moduleBody);
    }
    moduleState = (await httpAPI("/v1/modules")).enabled.includes(module);
    if (moduleState) panel["icon-color"] = color2 ? color2 : "#E94335";
    else color1 ? (panel["icon-color"] = color1) : "#00B1FF";
    panel.content = `状态: ${moduleState ? "开启" : "关闭"}`;
    $done(panel);
})();

function httpAPI(path = "", method = "GET", body = null) {
    return new Promise((resolve) => {
        $httpAPI(method, path, body, (result) => {
            resolve(result);
        });
    });
}