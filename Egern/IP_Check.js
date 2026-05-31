    const codeMap = { HK: '🇭🇰 香港', TW: '🇼🇸 台湾', SG: '🇸🇬 新加坡', JP: '🇯🇵 日本', KR: '🇰🇷 韩国', US: '🇺🇸 美国', NL: '🇳🇱 荷兰', DE: '🇩🇪 德国', UK: '🇬🇧 英国', TR: '🇹🇷 土耳其', FR: '🇫🇷 法国' };
try {
    const obj = JSON.parse($response.body);
    let countryCode = codeMap[obj.country_code] || obj.country_code;

    const myObj = {
        "IP地址": obj.ip,
        "地区": countryCode,
        ...(obj.city_name ? { "城市": obj.city_name } : {}),
        "互联网服务提供商": `AS${obj.asn} ${obj.as_desc}`, 
        "客户端": obj.user_agent.replace(/^egern/, 'Egern')
    };

    $done({
        body: JSON.stringify(myObj)
    });
} catch (e) {
    $done({ body: $response.body });
}