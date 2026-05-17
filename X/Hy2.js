function operator(proxies, targetPlatform) {
    proxies.forEach(proxy => {
        if (targetPlatform === "Surge") {
            proxy.tfo = `${proxy.tfo}, download-bandwidth=120, client-cert=Tesla`;
        } else if (targetPlatform === "Egern") {
            proxy.tfo = `${proxy.tfo}, bandwidth:120`;
        }
    });
    return proxies;
}