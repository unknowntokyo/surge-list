try {
    const obj = JSON.parse($response.body);
    
    const myObj = {
        "IP地址": obj.ip, 
        "名称": obj.as_desc,
        "ASN": "AS" + obj.asn,
        "国家代码": obj.country_code, 
        "城市": obj.city_name
    };

    $done({

        body: JSON.stringify(myObj) 
    });
} catch (e) {
    $done({ body: $response.body });
}