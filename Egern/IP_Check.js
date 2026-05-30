const CONFIG = {
  URL: 'https://my.ippure.com/v1/info',
  TIMEOUT: 3000,
  TTL: 7200000,     // 缓存 2 小时
  LOCK_TTL: 10000,  // 10 秒防并发锁
  MAP: { HK: 'HKG', TW: 'TWN', SG: 'SGP', JP: 'JPN', KR: 'KOR', US: 'USA', NL: 'NED', DE: 'GER' }
};

function BG_FetchRisk(ip, policy, currentCache) {
  const now = Date.now();
  if (currentCache?.isLocked && (now - currentCache.ts < CONFIG.LOCK_TTL)) return;

  // 核心优化：高并发下的分布式防击穿
  // 利用 IP 的哈希或随机加盐（Jitter），防止多个并发沙盒由于执行时间完全一致而同时冲破 write 锁机制
  if (Math.random() < 0.1 && currentCache) return; 

  const lockState = { score: currentCache?.score ?? null, ts: now, isLocked: true };
  $persistentStore.write(JSON.stringify(lockState), `eg_risk_${ip}`);

  $httpClient.get({ url: CONFIG.URL, timeout: CONFIG.TIMEOUT, policy: policy }, (err, _, data) => {
    if (err || !data) {
      const rollback = { score: currentCache?.score ?? null, ts: currentCache?.ts || 0, isLocked: false };
      $persistentStore.write(JSON.stringify(rollback), `eg_risk_${ip}`);
      return;
    }
    try {
      const resObj = typeof data === 'object' ? data : JSON.parse(data);
      if (resObj?.fraudScore !== undefined) {
        // 强制转换为 Number 类型，杜绝任何弱类型带来的数据隐患
        const safeScore = Number(resObj.fraudScore);
        $persistentStore.write(JSON.stringify({ score: safeScore, ts: Date.now(), isLocked: false }), `eg_risk_${ip}`);
      }
    } catch (_) {}
  });
}

export default function(ctx) {
  const POLICY = ctx.env.policy || 'DIRECT';

  try {
    const obj = JSON.parse($response.body);
    const ip = obj?.ip?.trim();
    if (!ip) return $done({ body: $response.body });

    let riskTxt = "查询中...";
    const cached = $persistentStore.read(`eg_risk_${ip}`);
    
    if (cached) {
      try {
        const parsedCache = JSON.parse(cached);
        const { score, ts, isLocked } = parsedCache;
        
        if (Date.now() - ts > CONFIG.TTL && !isLocked) {
          BG_FetchRisk(ip, POLICY, parsedCache);
        }
        
        // 核心优化：用更现代、严谨的类型判定和可选链，精简分支代码
        if (typeof score === 'number') {
          if (score >= 80) riskTxt = `极高风险 (${score})`;
          else if (score >= 70) riskTxt = `高风险 (${score})`;
          else if (score >= 40) riskTxt = `中等风险 (${score})`;
          else riskTxt = `纯净低危 (${score})`;
        } else if (isLocked) {
          riskTxt = "更新中...";
        }
      } catch (_) { riskTxt = "获取失败"; }
    } else {
      BG_FetchRisk(ip, POLICY, null);
    }

    const myObj = {
        "IP": ip,
        "地区": CONFIG.MAP[obj.country_code] || obj.country_code || "未知",
        "组织": `AS${obj.asn ?? ''} ${obj.as_desc || ""}`,
        "风险评级": riskTxt
    };

    if (typeof obj.city_name === 'string' && obj.city_name.trim()) {
        myObj["城市"] = obj.city_name.trim();
    }
    
    $done({ body: JSON.stringify(myObj) });
  } catch (e) {
    $done({ body: $response.body });
  }
}