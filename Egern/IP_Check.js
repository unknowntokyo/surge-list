try {
    const obj = JSON.parse($response.body);
    
    const myObj = {
        "IP地址": obj.ip, 
        "名称": obj.as_desc,
        "ASN": obj.asn,
        "国家代码": obj.country_code, 
        "城市": obj.city_name,
        "User-Agent": obj.user_agent
    };

    const keyOrder = ["IP地址", "名称", "ASN", "国家代码", "城市", "User-Agent"];

    $done({
        body: JSON.stringify(myObj, keyOrder)
    });
} catch (e) {
    $done({});
}