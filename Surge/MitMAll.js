!(async () => {
    let panel = { title: "Modole On-Off", icon: "cube.box.fill" },
        module = "MitM All Hostnames",
        moduleState,
        hostname,
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
        await sleep(100);
    }
    moduleState = (await httpAPI("/v1/modules")).enabled.includes(module);
    hostname = /hostname\s?=\s?(.*)/.exec(
            (await httpAPI("/v1/profiles/current?sensitive=0")).profile
        )[1];
    if (moduleState) panel["icon-color"] = color2 ? color2 : "#ff0000";
    else color1 ? (panel["icon-color"] = color1) : "";
    panel.content = `状态: ${moduleState ? "开启" : "关闭"}\n` + (hostname ? `\nhostname: ${hostname}` : "");
    $done(panel);
})();

function httpAPI(path = "", method = "GET", body = null) {
    return new Promise((resolve) => {
        $httpAPI(method, path, body, (result) => {
            resolve(result);
        });
    });
}

function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}