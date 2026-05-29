try {
    const obj = JSON.parse($response.body);
    
    const myObj = {
        "IP地址": obj.ip, 
        "名称": obj.as_desc,
        "ASN": "AS" + obj.asn,
        "国家代码": obj.country_code, 
        "城市": obj.city_name
    };

    const keyOrder = ["IP地址", "名称", "ASN", "国家代码", "城市"];

    $done({
        body: JSON.stringify(myObj, keyOrder, 2)
    });
} catch (e) {
    $done({ body: $response.body });
}
