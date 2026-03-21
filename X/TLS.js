function operator(proxies, targetPlatform) {
    const alpn = "02683208687474702f312e31";
    proxies.forEach(proxy => {
        if (targetPlatform === "QX") {
            proxy.tfo = `${proxy.tfo}, tls13=true, tls-alpn=${alpn}, tls-no-session-ticket=true`;
        }
    });
    return proxies;
}
