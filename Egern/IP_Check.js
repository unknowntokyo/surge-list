try {
    const obj = JSON.parse($response.body);
    const codeMap = { HK: 'HKG', TW: 'TWN', SG: 'SGP', JP: 'JPN', KR: 'KOR', US: 'USA', NL: 'NED', DE: 'GER' };
    let countryCode = codeMap[obj.country_code] || obj.country_code;
    const myObj = {
        "IP": obj.ip, 
        "服务提供商": "AS" + obj.asn + " " + obj.as_desc,
        "地区": countryCode,
        "城市": obj.city_name
    };

    if (!obj.city_name || obj.city_name.trim() === "") {
        delete myObj["城市"];
    }
    
    $done({
        body: JSON.stringify(myObj) 
    });
} catch (e) {
    $done({ body: $response.body });
}