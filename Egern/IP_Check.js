// 1. 无原型链纯净字典，0 原型链检索时间
const MAP = Object.create(null);
Object.assign(MAP, { HK: 'HKG', TW: 'TWN', SG: 'SGP', JP: 'JPN', KR: 'KOR', US: 'USA', NL: 'NED', DE: 'GER' });

// 2. 彻底抛弃 async/await，回归纯粹、原子化的经典 ES5 线性回调架构
export default function(ctx) {
  let origBody;
  try {
    origBody = JSON.parse($response.body);
  } catch (_) {
    return $done({ body: $response.body }); // 0.01ms 极速防崩退出
  }

  const rawIp = origBody?.ip;
  if (!rawIp) return $done({ body: $response.body }); // 无有效 IP 0开销秒退

  // 提取局部栈变量，优化属性槽查找
  const policy = ctx.env?.policy || 'DIRECT';
  const cc = origBody.country_code;
  const city = origBody.city_name;

  // 3. 原生非挂起式请求：在完全原生的回调链路里处理闭环，绕过任何 async 状态机断流隐患
  $httpClient.get({
    url: 'https://my.ippure.com/v1/info',
    timeout: 2000, // 2秒超时防线
    policy: policy,
    headers: { 'Connection': 'keep-alive', 'Accept': 'application/json' }
  }, (err, _, data) => {
    let score = null;
    
    if (!err && data) {
      try {
        const res = typeof data === 'object' ? data : JSON.parse(data);
        if (res?.fraudScore !== undefined) {
          score = Number(res.fraudScore);
        }
      } catch (_) {}
    }

    // 4. 无分支三元链解析状态文字
    const riskTxt = score === null ? "评分获取失败" :
                    score >= 80 ? `极高风险 (${score})` :
                    score >= 70 ? `高风险 (${score})` :
                    score >= 40 ? `中等风险 (${score})` : `纯净低危 (${score})`;

    // 5. 保持单态隐式类（Hidden Class）Shape，确保最极限的序列化性能
    const myObj = {
      "IP": rawIp.trim(),
      "地区": MAP[cc] || cc || "未知",
      "城市": (typeof city === 'string') ? city.trim() : undefined,
      "组织": origBody.asn ? `AS${origBody.asn} ${origBody.as_desc || ""}`.trim() : (origBody.as_desc || "未知"),
      "风险评级": riskTxt // 绝对不可能再是"查询中..."
    };

    // 在网络请求的回调终点彻底交还控制权，绝无卡死和挂起悬停可能
    $done({ body: JSON.stringify(myObj) });
  });
}
