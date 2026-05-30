// 1. 静态常量外提：避免高频执行时频繁进行内存分配与 GC（垃圾回收）
const CODE_MAP = { HK: 'HKG', TW: 'TWN', SG: 'SGP', JP: 'JPN', KR: 'KOR', US: 'USA', NL: 'NED', DE: 'GER' };

export default async function(ctx) {
  // 2. 核心性能优化：并发异步（Non-blocking IO）
  // 立即发起网络请求，让其在网络栈后台传输，绝不阻塞下方同步 CPU 代码的执行
  const scorePromise = new Promise((resolve) => {
    $httpClient.get({
      url: 'https://my.ippure.com/v1/info',
      timeout: 4000,
      policy: ctx?.env?.policy || 'DIRECT'
    }, (err, _, data) => {
      if (err) return resolve(null);
      try {
        const res = typeof data === 'object' ? data : JSON.parse(data);
        resolve(res?.fraudScore ?? null);
      } catch { resolve(null); }
    });
  });

  // 3. 快速失败（Fail-Fast）：在网络传输空档，立即解析本地数据
  let obj;
  try {
    obj = JSON.parse(ctx?.response?.body || $response.body);
  } catch {
    // 如果原始数据本就是坏的，直接终止，停止浪费 CPU 和等待网络
    return $done({ body: $response?.body });
  }

  // 4. 此时 await 最多只需等待网络剩余的耗时（消除原代码的串行死等）
  const risk = await scorePromise;
  
  // 5. 极致分支优化：用三元运算符代替 if-else，扁平化单行逻辑
  const riskTxt = risk === null ? "获取失败" :
                  risk >= 80 ? `极高风险 (${risk})` :
                  risk >= 70 ? `高风险 (${risk})` :
                  risk >= 40 ? `中等风险 (${risk})` : `纯净低危 (${risk})`;

  const cityName = obj.city_name?.trim();

  // 6. V8 引擎优化：禁止使用 delete！
  // delete 会破坏对象的 Hidden Class（隐藏类），使对象降级为慢速的字典模式
  // 采用属性条件展开（Conditional Spread），确保对象在初始化时就定型
  $done({
    body: JSON.stringify({
      "IP": obj.ip,
      "地区": CODE_MAP[obj.country_code] || obj.country_code || "未知",
      ...(cityName ? { "城市": cityName } : {}),
      "组织": `AS${obj.asn || ''} ${obj.as_desc || ""}`.trim(),
      "风险评级": riskTxt
    })
  });
}
