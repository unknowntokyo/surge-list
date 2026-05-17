function operator(proxies, targetPlatform) {
    proxies.forEach(proxy => {
        if (targetPlatform === "Surge") {
            proxy.tfo = `${proxy.tfo}, download-bandwidth=120, client-cert=Tesla, port-hopping-interval=30`;
        } else if (targetPlatform === "Egern") {
            proxy.tfo = `${proxy.tfo}, bandwidth:120, port_hopping_interval:30`;
        }
    });
    return proxies;
} 