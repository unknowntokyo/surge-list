export default async function(ctx) {
  if (!ctx.response || !ctx.response.body) return;

  const codeMap = { 
    HK: '🇭🇰 香港', TW: '🇼🇸 台湾', SG: '🇸🇬 新加坡', JP: '🇯🇵 日本', 
    KR: '🇰🇷 韩国', US: '🇺🇸 美国', NL: '🇳🇱 荷兰', DE: '🇩🇪 德国', 
    UK: '🇬🇧 英国', TR: '🇹🇷 土耳其', FR: '🇫🇷 法国' 
  };

  try {
    const obj = JSON.parse(ctx.response.body);
    const ip = obj.ip;
    
    const CACHE_KEY = `speed_cache_${ip}`;
    const CACHE_TTL = 10 * 60 * 1000;
    
    let speedMbps = ""; 
    let backupSpeed = "";

    try {
      const cachedStr = ctx.storage.get(CACHE_KEY);
      if (cachedStr) {
        const cacheData = JSON.parse(cachedStr);
        backupSpeed = cacheData.speed + " (旧)";
        
        if (Date.now() - cacheData.timestamp < CACHE_TTL) {
          speedMbps = cacheData.speed;
        }
      }
    } catch (e) {}

    if (!speedMbps) {
      const MB = 5; 
      const SPEED_TEST_URL = `https://speed.cloudflare.com/__down?bytes=${MB * 1024 * 1024}`;
      
      try {
        const startTime = Date.now();
        await ctx.http.get(SPEED_TEST_URL, {
          headers: { 'Cache-Control': 'no-cache' },
          timeout: 4000 
        });
        const duration = (Date.now() - startTime) / 1000;
        speedMbps = `${((MB / duration) * 8).toFixed(1)} Mbps`;

        ctx.storage.set(CACHE_KEY, JSON.stringify({
          speed: speedMbps,
          timestamp: Date.now()
        }));
      } catch(e) {
        speedMbps = backupSpeed || "测速超时";
      }
    }

    let countryCode = codeMap[obj.country_code] || obj.country_code;

    const myObj = {
        "IP地址": ip,
        "地区": countryCode,
        ...(obj.city_name ? { "城市": obj.city_name } : {}),
        "互联网服务提供商": `AS${obj.asn} ${obj.as_desc}`,
        "网速": speedMbps,  
        "客户端": obj.user_agent ? obj.user_agent.replace(/^egern/, 'Egern') : 'Egern'
    };

    ctx.response.body = JSON.stringify(myObj);
  } catch (e) {}
}