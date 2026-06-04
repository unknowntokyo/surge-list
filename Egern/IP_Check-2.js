const codeMap = { HK: '🇭🇰 香港', TW: '🇼🇸 台湾', SG: '🇸🇬 新加坡', JP: '🇯🇵 日本', KR: '🇰🇷 韩国', US: '🇺🇸 美国', NL: '🇳🇱 荷兰', DE: '🇩🇪 德国', GB: '🇬🇧 英国', TR: '🇹🇷 土耳其', FR: '🇫🇷 法国', CN: '🇨🇳 中国' /* 后续国家保持不变 */ };

export default async function(ctx) {
  const MB = 2;
  const BYTES = MB * 1024 * 1024;
  const SPEED_TEST_URL = `https://speed.cloudflare.com/__down?bytes=${BYTES}`;

  // 1. 同时创建两个异步任务的 Promise（此时两个任务已经并发启动）
  const jsonPromise = ctx.response.json().catch(() => ({})); 
  
  let speedMbps = "⚠️ 测速失败";
  const startTime = Date.now();
  
  const speedPromise = ctx.http.get(SPEED_TEST_URL, {
    headers: { 'Cache-Control': 'no-cache' },
    timeout: 3000 // 保持 3 秒超时
  }).then(() => {
    const duration = (Date.now() - startTime) / 1000;
    if (duration > 0) {
      const speedMbpsVal = (BYTES * 8) / (duration * 1000000);
      speedMbps = `${speedMbpsVal.toFixed(1)} Mbps`;
    }
  }).catch(() => {
    speedMbps = "⚠️ 超时/失败";
  });

  // 2. 【核心加速点】并发等待：两个任务同时在后台跑，这里一并接收结果
  const [obj] = await Promise.all([jsonPromise, speedPromise]);

  // 3. 组装返回
  return {
    body: {
      "IP地址": obj.ip || "未知",
      "地区": codeMap[obj.country_code] || obj.country_code || "未知",
      ...(obj.city_name ? { "城市": obj.city_name } : {}),
      "互联网服务 provide": obj.asn ? `AS${obj.asn} ${obj.as_desc || ''}` : "未知",
      "下载带宽": speedMbps,
      "客户端": obj.user_agent ? obj.user_agent.replace(/^egern/i, 'Egern') : "Egern"
    }
  };
}
