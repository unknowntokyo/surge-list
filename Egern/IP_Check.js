try {
    const obj = JSON.parse($response.body);
    $done({
        body: JSON.stringify({
            "名称": obj.as_desc,
            "ASN": obj.asn,
            "城市": obj.city_name,
            "国家代码": obj.country_code,
            "国家": obj.country_name,
            "IP地址": obj.ip,
            "User-Agent": obj.user_agent
        })
    });
} catch (e) {
    $done({});
}