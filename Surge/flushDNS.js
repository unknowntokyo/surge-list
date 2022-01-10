!(async () => {
    let panel = { title: "Flush DNS" },
        showServer = true,
        module = "DNS over HTTPS",
        moduleState,
        dnsCache;
    if (typeof $argument != "undefined") {
        let arg = Object.fromEntries($argument.split("&").map((item) => item.split("=")));
        if (arg.title) panel.title = arg.title;
        if (arg.icon) panel.icon = arg.icon;
        if (arg.color) panel["icon-color"] = arg.color;
        if (arg.server == "false") showServer = false;
    }
    if (showServer) {
        dnsCache = (await httpAPI("/v1/dns", "GET")).dnsCache;
        dnsCache = [...new Set(dnsCache.map((d) => d.server))].toString().replace(/,/g, "\n");
    }
    if ($trigger == "button") await httpAPI("/v1/dns/flush");
    moduleState = (await httpAPI("/v1/modules")).enabled.includes(module);
        let moduleBody = {};
        moduleBody[module] = moduleState;
        await httpAPI("/v1/modules", "POST", moduleBody);
        await sleep(100);
    let delay = ((await httpAPI("/v1/test/dns_delay")).delay * 1000).toFixed(0);
    panel.content = `延迟：${delay}ms${dnsCache ? `\nserver:\n${dnsCache}` : ""}\n`+`DoH：${moduleState ? "开启" : "关闭"}`;
    $done(panel);
})();

function httpAPI(path = "", method = "POST", body = null) {
    return new Promise((resolve) => {
        $httpAPI(method, path, body, (result) => {
            resolve(result);
        });
    });
}

function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}