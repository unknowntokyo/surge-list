function operator(proxies, targetPlatform) {
    proxies.forEach(proxy => {
        if (targetPlatform === "Surge") {
            proxy.tfo = `${proxy.tfo}, client-cert=Tesla, port-hopping-interval=30`;
        }
    });
    return proxies;
}