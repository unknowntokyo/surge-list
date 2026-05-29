let body = $response.body;
if (body) {
    try {
        let obj = JSON.parse(body);
        let newObj = {
            "ip": obj.ip,
            "国家": obj.country_code,
            "country_name": obj.country_name,
            "城市": obj.city_name,
            "asn": obj.asn,
            "as_desc": obj.as_desc,
            "user_agent": obj.user_agent
        };

        $done({ body: JSON.stringify(newObj, null, 2) });
    } catch (e) {
        $done({});
    }
} else {
    $done({});
}