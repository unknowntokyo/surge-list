    const codeMap = { HK: 'HKG', TW: 'TWN', SG: 'SGP', JP: 'JPN', KR: 'KOR', US: 'USA', NL: 'NED', DE: 'GER' };
try {
    const obj = JSON.parse($response.body);
    let countryCode = codeMap[obj.country_code] || obj.country_code;

    const myObj = {
        "IP地址": obj.ip,
        "地区": countryCode,
        ...(obj.city_name ? { "城市": obj.city_name } : {}),
        "服务提供商": `AS${obj.asn} ${obj.as_desc}`, 
        "用户代理": obj.user_agent
    };

    $done({
        body: JSON.stringify(myObj)
    });
} catch (e) {
    $done({ body: $response.body });
}