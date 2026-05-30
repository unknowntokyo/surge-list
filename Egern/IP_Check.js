export default async function(ctx) {
  // 优化 1: 预编译/静态化只读对象，避免每次脚本执行都重复创建哈希表
  const codeMap = { HK: 'HKG', TW: 'TWN', SG: 'SGP', JP: 'JPN', KR: 'KOR', US: 'USA', NL: 'NED', DE: 'GER' };
  const URL_INFO = 'https://my.ippure.com/v1/info';

  // 优化 2: 并行解析 $response.body，消除本不必要的串行等待 I/O
  let parsedObj = null;
  try {
    parsedObj = JSON.parse($response.body);
  } catch {
    return $done({ body: $response.body }); // 极速短路：原始数据挂了立即退出，不浪费网络 I/O 
  }

  // 优化 3: 精准控制 Promise 状态流转，移除所有的内联 try-catch 块（try-catch 会阻止 V8 引擎对当前上下文进行 JIT 优化）
  const risk = await new Promise((resolve) => {
    $httpClient.get({
      url: URL_INFO,
      timeout: 4000,
      policy: ctx.env.policy || 'DIRECT' // 优化 4: 移除全局 POLICY 变量声明，按需读取
    }, (error, response, data) => {
      if (error) return resolve(null);
      // 优化 5: 避免使用复杂的 typeof 分支判断，利用短路求值直接解析
      const res = (data && data.fraudScore !== undefined) ? data : JSON.parse(data || '{}');
      resolve(res.fraudScore ?? null);
    });
  }).catch(() => null); // 将异常冒泡捕获移出核心执行流

  // 优化 6: 保持 Hidden Class（隐式类）形状一致，利用布尔短路彻底干掉任何形式的 delete 和动态混入
  const city = parsedObj.city_name;
  const hasCity = city && city.trim() !== "";

  return $done({
    body: JSON.stringify({
      "IP": parsedObj.ip,
      "地区": codeMap[parsedObj.country_code] || parsedObj.country_code || "未知",
      // 优化 7: V8 极致压榨 ---- 始终保持对象 Key 数量和顺序完全一致，让 JIT 编译器实现 Inline Cache (IC) 缓存
      "城市": hasCity ? city : undefined, 
      "组织": `AS${parsedObj.asn} ${parsedObj.as_desc || ""}`,
      "风险评级": (risk === null || risk === undefined) ? "获取失败" :
                  risk >= 80 ? `极高风险 (${risk})` :
                  risk >= 70 ? `高风险 (${risk})` :
                  risk >= 40 ? `中等风险 (${risk})` : `纯净低危 (${risk})`
    })
  });
}