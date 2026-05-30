export default async function(ctx) {
  let obj;
  try {
    obj = JSON.parse($response.body);
  } catch (e) {
    return $done({ body: $response.body });
  }

  const POLICY = ctx.env.policy || 'DIRECT';

  const getFraudScore = () => {
    return new Promise((resolve) => {
      $httpClient.get({
        url: 'https://my.ippure.com/v1/info',
        timeout: 4000,
        policy: POLICY
      }, (error, response, data) => {
        if (error) return resolve(null);
        try {
          resolve(JSON.parse(data).fraudScore ?? null);
        } catch (e) {
          resolve(null);
        }
      });
    });
  };

  const risk = await getFraudScore();
  
  let riskTxt = "获取失败";
  if (risk !== null) {
    if (risk >= 80) riskTxt = `极高风险 (${risk})`;
    else if (risk >= 70) riskTxt = `高风险 (${risk})`;
    else if (risk >= 40) riskTxt = `中等风险 (${risk})`;
    else riskTxt = `纯净低危 (${risk})`;
  }
  
  const codeMap = { HK: 'HKG', TW: 'TWN', SG: 'SGP', JP: 'JPN', KR: 'KOR', US: 'USA', NL: 'NED', DE: 'GER' };
  
  const myObj = {
    "IP": obj.ip,
    "地区": codeMap[obj.country_code] || obj.country_code || "未知",
    ...(obj.city_name?.trim() ? { "城市": obj.city_name } : {}),
    "组织": `AS${obj.asn || ''} ${obj.as_desc || ''}`.trim() || "未知",
    "风险评级": riskTxt
  };

  $done({ body: JSON.stringify(myObj) });
}