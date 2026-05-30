    const codeMap = { HK: 'HKG', TW: 'TWN', SG: 'SGP', JP: 'JPN', KR: 'KOR', US: 'USA', NL: 'NED', DE: 'GER' };
try {
    const obj = JSON.parse($response.body);
    let countryCode = codeMap[obj.country_code] || obj.country_code;

    const cityName = obj.city_name?.trim(); 

    const myObj = {
        "IP": obj.ip,
        "地区": countryCode,
        ...(cityName ? { "城市": cityName } : {}),
        "组织": `AS${obj.asn} ${obj.as_desc}`,
        "用户代理": obj.user_agent
    };

    $done({
        body: JSON.stringify(myObj) 
    });
} catch (e) {
    $done({ body: $response.body });
}