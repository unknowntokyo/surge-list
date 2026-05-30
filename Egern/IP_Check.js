export default async function(ctx) {
  const rawBody = $response.body; 
  let parsedObj;
  
  try {
    parsedObj = JSON.parse(rawBody);
  } catch {
    return $done({ body: rawBody });
  }

  const risk = await new Promise((resolve) => {
    $httpClient.get({
      url: 'https://my.ippure.com/v1/info',
      timeout: 4000,
      policy: ctx.env.policy || 'DIRECT'
    }, (error, response, data) => {
      if (error) return resolve(null);
      resolve((typeof data === 'string' ? JSON.parse(data) : data).fraudScore);
    });
  });

  const city = parsedObj.city_name;
  const codeMap = { HK: 'HKG', TW: 'TWN', SG: 'SGP', JP: 'JPN', KR: 'KOR', US: 'USA', NL: 'NED', DE: 'GER' };

  return $done({
    body: JSON.stringify({
      "IP": parsedObj.ip,
      "地区": codeMap[parsedObj.country_code] || parsedObj.country_code || "未知",
      "城市": (city && city.trim() !== "") ? city : undefined, 
      "组织": `AS${parsedObj.asn} ${parsedObj.as_desc || ""}`,
      "风险评级": (risk === null || risk === undefined) ? "获取失败" :
                  risk >= 80 ? `极高风险 (${risk})` :
                  risk >= 70 ? `高风险 (${risk})` :
                  risk >= 40 ? `中等风险 (${risk})` : `纯净低危 (${risk})`
    })
  });
}