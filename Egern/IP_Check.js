// 优化 1：移至全局作用域。只在脚本首次加载时初始化一次，后续万次调用零内存开销
const CODE_MAP = { HK: 'HKG', TW: 'TWN', SG: 'SGP', JP: 'JPN', KR: 'KOR', US: 'USA', NL: 'NED', DE: 'GER' };

export default async function(ctx) {
  const rawBody = $response.body; 
  let parsedObj;
  
  // 优化 2：彻底消灭匿名的立即执行函数，改用最直接的平铺 try-catch，消除闭包内存开销
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
      resolve(JSON.parse(data || '{}').fraudScore);
    });
  });

  return $done({
    body: JSON.stringify({
      "IP": parsedObj.ip,
      "地区": CODE_MAP[parsedObj.country_code] || parsedObj.country_code || "未知",
      // 保持 V8 最佳隐藏类形状，城市为空时自动不显示
      "城市": (parsedObj.city_name && parsedObj.city_name.trim() !== "") ? parsedObj.city_name : undefined, 
      "组织": `AS${parsedObj.asn} ${parsedObj.as_desc}`, 
      // 完美拦截网络失败/超时的 undefined 情况，确保风控逻辑不越权
      "风险评级": risk ?? null ? (
                    risk >= 80 ? `极高风险 (${risk})` :
                    risk >= 70 ? `高风险 (${risk})` :
                    risk >= 40 ? `中等风险 (${risk})` : `纯净低危 (${risk})`
                  ) : "获取失败"
    })
  });
}