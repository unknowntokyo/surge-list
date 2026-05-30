const CODE_MAP = { HK: 'HKG', TW: 'TWN', SG: 'SGP', JP: 'JPN', KR: 'KOR', US: 'USA', NL: 'NED', DE: 'GER' };

function fetchFraudScore(ip, policy) {
  return new Promise((resolve) => {
    $httpClient.get({
      url: `https://my.ippure.com/v1/info?ip=${ip}`, 
      timeout: 2000, 
      policy: policy
    }, (_, __, data) => {
      try {
        resolve(JSON.parse(data).fraudScore ?? null);
      } catch {
        resolve(null); 
      }
    });
  });
}

export default async function(ctx) {
  const obj = JSON.parse($response.body);
  const { ip, country_code, city_name, asn, as_desc } = obj;

  const risk = await fetchFraudScore(ip, ctx.env.policy);

  const riskTxt = risk === null ? "获取失败" :
                  risk >= 80 ? `极高风险 (${risk})` : 
                  risk >= 70 ? `高风险 (${risk})` : 
                  risk >= 40 ? `中等风险 (${risk})` : `纯净低危 (${risk})`;

  const myObj = {
    "IP地址": ip,
    "地区": CODE_MAP[country_code] || country_code,
    ...(city_name && { "城市": city_name }), 
    "服务提供商": `AS${asn} ${as_desc}`,
    "风险评级": riskTxt
  };

  $done({ body: JSON.stringify(myObj) });
}