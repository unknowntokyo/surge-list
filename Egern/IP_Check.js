try {
    const o = JSON.parse($response.body);
    const map = { "IP地址": o.ip, "名称": o.as_desc, "ASN": o.asn, "国家代码": o.country_code, "城市": o.city_name, "User-Agent": o.user_agent };
    
    // 带换行缩进的物理拼接，同样 100% 锁死顺序
    const body = "{\n" + Object.entries(map).map(([k, v]) => `  "${k}": "${v}"`).join(",\n") + "\n}";
    $done({ body });
} catch (e) {
    $done({ body: $response.body });
}
