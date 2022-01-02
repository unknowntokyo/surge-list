!(async () => {
    let module = "MitM All",
    let module1 = "Rewrite & Script",
        panel = { title: "Capture Mode", icon: "tray.and.arrow.down.fill" },
        showHostname = true,
        capture,
        mitmall,
        mitmall1,
        hostname,
        hostname1,
        color1,
        color2,
        color3;
    if (typeof $argument != "undefined") {
        let arg = Object.fromEntries($argument.split("&").map((item) => item.split("=")));
        if (arg.module) module = panel.title = arg.module;
        if (arg.title) panel.title = arg.title;
        if (arg.icon) panel.icon = arg.icon;
        if (arg.color1) color1 = arg.color1;
        if (arg.color2) color2 = arg.color2;
        if (arg.color3) color3 = arg.color3;
        if (arg.showHostname == "false") showHostname = false;
    }
    if ($trigger == "button") {
        capture = (await httpAPI("/v1/features/capture")).enabled;
        mitmall = (await httpAPI("/v1/modules")).enabled.includes(module);
        if (capture == mitmall)
            await httpAPI("/v1/features/capture", "POST", { enabled: !capture });
        let moduleBody = {};
        moduleBody[module] = !mitmall;
        await httpAPI("/v1/modules", "POST", moduleBody);
        await sleep(100);
    }
    capture = (await httpAPI("/v1/features/capture")).enabled;
    mitmall = (await httpAPI("/v1/modules")).enabled.includes(module);
    if (showHostname && mitmall) {
        hostname = /hostname\s?=\s?(.*)/.exec(
            (await httpAPI("/v1/profiles/current?sensitive=0")).profile
        )[1];
    }
    if (capture && mitmall) panel["icon-color"] = color3 ? color3 : "#E94335";
    else if (capture || mitmall) panel["icon-color"] = color2 ? color2 : "#FCB515";
    else color1 ? (panel["icon-color"] = color1) : "#00B1FF";
    mitmall1 = (await httpAPI("/v1/modules1")).enabled.includes(module1);
    if (showHostname && mitmall1) {
        hostname1 = /hostname\s?=\s?(.*)/.exec(
            (await httpAPI("/v1/profiles/current?sensitive=0")).profile
        )[1];
    if (mitmall) {
      panel.content =
    `${module}：${mitmall ? "开启" : "关闭"}\n` + `抓取流量：${capture ? "开启" : "关闭"}\n` + (hostname ? `hostname：${hostname}` : "");
    } else if (capture && mitmall) {
    panel.content =
    `${module}：${mitmall ? "开启" : "关闭"}\n` + `抓取流量：${capture ? "开启" : "关闭"}\n` + `hostname：${hostname1}`;
    } else {
    panel.content =
    `${module}：${mitmall ? "开启" : "关闭"}\n` + `抓取流量：${capture ? "开启" : "关闭"}`;   
    }
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