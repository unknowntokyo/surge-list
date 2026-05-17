function operator(proxies, targetPlatform) {
    proxies.forEach(proxy => {
        if (targetPlatform === "Surge") {
            proxy.tfo = `${proxy.tfo}, client-cert=Tesla`;
        }
    });
    return proxies;
}