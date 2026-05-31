const codeMap = { 
  HK: '🇭🇰 香港', TW: '🇼🇸 台湾', SG: '🇸🇬 新加坡', JP: '🇯🇵 日本', 
  KR: '🇰🇷 韩国', US: '🇺🇸 美国', NL: '🇳🇱 荷兰', DE: '🇩🇪 德国', 
  UK: '🇬🇧 英国', TR: '🇹🇷 土耳其', FR: '🇫🇷 法国' 
};

export default async function(ctx) {
  // 依然保留这行：安全气囊，防止无响应体时崩溃
  if (!ctx.response || !ctx.response.body) return;

  try {
    // 既然确定是 String，直接解析
    const obj = JSON.parse(ctx.response.body);

    const myObj = {
        "IP地址": obj.ip,
        "地区": codeMap[obj.country_code] || obj.country_code,
        ...(obj.city_name ? { "城市": obj.city_name } : {}),
        "互联网服务提供商": `AS${obj.asn || ''} ${obj.as_desc || ''}`.trim(),
        "客户端": obj.user_agent ? obj.user_agent.replace(/^egern/, 'Egern') : 'Egern'
    };

    // 直接回写序列化后的字符串
    ctx.response.body = JSON.stringify(myObj);
  } catch (e) {}
}