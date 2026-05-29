try {
    const obj = JSON.parse($response.body);
    const codeMap = { HK: 'HKG', TW: ' TWN', SG: 'SGP', JP: 'JPN', KR: 'KOR', US: 'USA', NL: 'NED', DE: 'GER' };
    let countryCode = codeMap[obj.country_code] || obj.country_code;
    const myObj = {
        "IP地址": obj.ip, 
        "互联网服务提供商": "AS" + obj.asn + " " + obj.as_desc,
        "国家代码": countryCode,
        "城市": obj.city_name
    };

    $done({

        body: JSON.stringify(myObj) 
    });
} catch (e) {
    $done({ body: $response.body });
}