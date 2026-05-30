// 优化 1：移至全局作用域。只在脚本首次加载时初始化一次，后续万次调用零内存开销
const CODE_MAP = { HK: 'HKG', TW: 'TWN', SG: 'SGP', JP: 'JPN', KR: 'KOR', US: 'USA', NL: 'NED', DE: 'GER' };

export default async function(ctx) {
  const rawBody = $response.body; 
  
  // 优化 2：利用立即执行函数 (IIFE) 配合 const 瞬间原子化锁死对象引用
  const parsedObj = (() => {
    try { 
      return JSON.parse(rawBody); 
    } catch { 
      return null; 
    }
  })();

  // 优化 3：如果解析失败，直接返回空对象，大文件下载时绝不复制内存，彻底杜绝闪退断网
  if (!parsedObj) return $done({}); 

  const risk = await new Promise((resolve) => {
    $httpClient.get({
      url: 'https://my.ippure.com/v1/info',
      // 优化 4：超时时间缩短至 3000ms。必须保证在 Surge 宿主强杀脚本之前，由我们代码内部的主动超时机制接管
      timeout: 3000,
      policy: ctx.env.policy || 'DIRECT'
    }, (error, response, data) => {
      // 核心容错：确保任何网络脏数据、HTML 报错页面都能安全捕获
      try {
        resolve(JSON.parse(data).fraudScore);
      } catch {
        resolve(null);
      }
    });
  });

  return $done({
    body: JSON.stringify({
      "IP": parsedObj.ip,
      "地区": CODE_MAP[parsedObj.country_code] || parsedObj.country_code || "未知",
      // 保持 V8 最佳隐藏类形状，城市为空时自动不显示
      "城市": (parsedObj.city_name && parsedObj.city_name.trim() !== "") ? parsedObj.city_name : undefined, 
      "组织": `AS${parsedObj.asn} ${parsedObj.as_desc}`, 
      // 当 3秒 超时触发后，risk 拿到 null，这里将 100% 稳定、优雅地输出 "获取失败"
      "风险评级": (risk !== null && risk !== undefined) ? (
                    risk >= 80 ? `极高风险 (${risk})` :
                    risk >= 70 ? `高风险 (${risk})` :
                    risk >= 40 ? `中等风险 (${risk})` : `纯净低危 (${risk})`
                  ) : "获取失败"
    })
  });
}
