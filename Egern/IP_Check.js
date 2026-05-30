// 优化 1：将静态映射移到全局，避免重复创建销毁
const CODE_MAP = { HK: 'HKG', TW: 'TWN', SG: 'SGP', JP: 'JPN', KR: 'KOR', US: 'USA', NL: 'NED', DE: 'GER' };

export default async function(ctx) {
  let obj;
  try {
    obj = JSON.parse($response.body);
  } catch (e) {
    return $done({ body: $response.body });
  }

  const POLICY = ctx.env.policy || 'DIRECT';

  // 优化 2：封装请求，缩短超时时间至 2000ms
  const getFraudScore = () => {
    return new Promise((resolve) => {
      $httpClient.get({
        url: 'https://my.ippure.com/v1/info', // 如果需要查指定IP，记得改成 'https://my.ippure.com/v1/info?ip=' + obj.ip
        timeout: 2000, 
        policy: POLICY
      }, (error, response, data) => {
        if (error || !data) return resolve(null);
        try {
          resolve(JSON.parse(data).fraudScore ?? null);
        } catch (e) {
          resolve(null);
        }
      });
    });
  };

  const risk = await getFraudScore();
  
  // 优化 3：精简条件判断
  let riskTxt = "获取失败";
  if (risk !== null) {
    if (risk >= 80) riskTxt = `极高风险 (${risk})`;
    else if (risk >= 70) riskTxt = `高风险 (${risk})`;
    else if (risk >= 40) riskTxt = `中等风险 (${risk})`;
    else riskTxt = `纯净低危 (${risk})`;
  }
  
  // 优化 4：对象解构，减少属性查找开销，增强可读性
  const { ip, country_code, city_name, asn, as_desc } = obj;
  const trimmedCity = city_name?.trim();
  
  const myObj = {
    "IP": ip || "未知",
    "地区": CODE_MAP[country_code] || country_code || "未知",
    ...(trimmedCity ? { "城市": trimmedCity } : {}),
    "组织": `AS${asn || ''} ${as_desc || ''}`.trim() || "未知",
    "风险评级": riskTxt
  };

  $done({ body: JSON.stringify(myObj) });
}
