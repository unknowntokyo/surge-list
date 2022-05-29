function operator(proxies, targetPlatform) {
    const fingerprint = ”dbdcc22d3a60a79292844c726e210e3049d5e258ad0867208379f6f652a9f016“;
    proxies.forEach(proxy => {
        if (targetPlatform === ”QX“) {
            proxy.tfo = `${proxy.tfo || false}, tls-cert-sha256=${fingerprint}`;
        } else if (targetPlatform === ”Surge“) {
            proxy.tfo = `${proxy.tfo || false}, server-cert-fingerprint-sha256=${fingerprint}`;
        }
    });
    return proxies;
}