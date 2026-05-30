const codeMap = { HK: 'HKG', TW: 'TWN', SG: 'SGP', JP: 'JPN', KR: 'KOR', US: 'USA', NL: 'NED', DE: 'GER' };
const BASE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

// 超时包装器
function withTimeout(promise, ms, fallback) {
  let timer;
  const timeout = new Promise(resolve => { timer = setTimeout(() => resolve(fallback), ms); });
  return Promise.race([promise.catch(() => fallback), timeout]).then(v => { clearTimeout(timer); return v; });
}

// 基础网络请求封装
async function get(url, headers) {
  try {
    const res = await fetch(url, { headers: headers || {} });
    return await res.text();
  } catch (e) { return ""; }
}

async function post(url, body, headers) {
  try {
    const res = await fetch(url, { method: 'POST', headers: headers || {}, body: body });
    return await res.text();
  } catch (e) { return ""; }
}

async function getRaw(url, headers) {
  try {
    return await fetch(url, { headers: headers || {} });
  } catch (e) { return null; }
}

// === AI 解锁检测 ===
async function checkChatGPT() {
  try {
    const traceTxt = await get("https://chatgpt.com/cdn-cgi/trace", null);
    const tm = traceTxt ? traceTxt.match(/loc=([A-Z]{2})/) : null;
    if (tm && tm[1]) {
      try {
        const apiRes = await getRaw("https://chatgpt.com/backend-api/models", { "User-Agent": BASE_UA, "Authorization": "Bearer " });
        if (apiRes && apiRes.status && apiRes.status !== 403) return tm[1];
      } catch (e) {}
      return tm[1];
    }
  } catch (e) {}
  try {
    const iosRes = await getRaw("https://ios.chat.openai.com", { "User-Agent": BASE_UA });
    const iosBody = iosRes ? await iosRes.text() : "";
    let cfDetails = "";
    try { cfDetails = JSON.parse(iosBody)?.cf_details || ""; } catch (e2) {}
    const appBlocked = !iosBody || iosBody.includes("blocked_why_headline") || iosBody.includes("unsupported_country_region_territory") || cfDetails.includes("(1)") || cfDetails.includes("(2)");
    if (appBlocked) return "不可用";
    return "APP专用";
  } catch (e) { return "不可用"; }
}

async function checkGemini() {
  try {
    const bodyRaw = 'f.req=[["K4WWud","[[0],[\\"en-US\\"]]",null,"generic"]]';
    const txt = await post('https://gemini.google.com/_/BardChatUi/data/batchexecute', bodyRaw, { "User-Agent": BASE_UA, "Accept-Language": "en-US", "Content-Type": "application/x-www-form-urlencoded" });
    if (!txt) return "不可用";
    let m = txt.match(/"countryCode"\s*:\s*"([A-Z]{2})"/i);
    if (m && m[1]) return m[1].toUpperCase();
    m = txt.match(/"requestCountry"\s*:\s*\{[^}]*"id"\s*:\s*"([A-Z]{2})"/i);
    if (m && m[1]) return m[1].toUpperCase();
    m = txt.match(/\[\[\\?"([A-Z]{2})\\?",\\?"S/);
    if (m && m[1]) return m[1].toUpperCase();
    if (txt.includes("Bard isn't currently supported")) return "不可用";
    return "可用";
  } catch (e) { return "不可用"; }
}

async function checkClaude() {
  const restricted = { CN: true, HK: true, MO: true, RU: true, KP: true, IR: true, SY: true, CU: true, BY: true, VE: true };
  try {
    const traceTxt = await get("https://claude.ai/cdn-cgi/trace", { "User-Agent": BASE_UA });
    const locMatch = traceTxt ? traceTxt.match(/(?:^|\n)ip=([^\n]+)/) : null;
    const locMatch2 = traceTxt ? traceTxt.match(/(?:^|\n)loc=([A-Z]{2})/) : null;
    const cc = locMatch2 && locMatch2[1] ? locMatch2[1].toUpperCase() : "";
    if (cc && restricted[cc]) return "受限";
    return cc || "可用";
  } catch (e) { return "不可用"; }
}

// === 流媒体解锁检测 ===
async function checkYouTube() {
  try {
    const body = await get('https://www.youtube.com/premium', { "User-Agent": BASE_UA, "Accept-Language": "en" });
    if (!body) return "不可用";
    if (body.includes('www.google.cn')) return "CN地区";
    const isNotAvailable = body.includes('Premium is not available in your country') || body.includes('YouTube Premium is not available');
    const m = body.match(/"contentRegion"\s*:\s*"?([A-Z]{2})"?/);
    const region = m && m[1] ? m[1].toUpperCase() : null;
    const isAvailable = body.includes('ad-free') || body.includes('Ad-free');
    if (isNotAvailable) return "不可用";
    if (isAvailable && region) return region;
    if (isAvailable && !region) return "可用";
    if (region) return region;
    return "不可用";
  } catch (e) { return "不可用"; }
}

async function checkNetflix() {
  try {
    const titles = ["https://www.netflix.com/title/81280792", "https://www.netflix.com/title/70143836"];
    const fetchTitle = async (url) => { try { return await get(url, { "User-Agent": BASE_UA }); } catch (e) { return ""; } };
    const bodies = await Promise.all([fetchTitle(titles[0]), fetchTitle(titles[1])]);
    const t1 = bodies[0], t2 = bodies[1];
    if (!t1 && !t2) return "不可用";
    const blocked1 = /oh no!/i.test(t1 || "") || /not available/i.test(t1 || "") || /Sorry/i.test(t1 || "");
    const blocked2 = /oh no!/i.test(t2 || "") || /not available/i.test(t2 || "") || /Sorry/i.test(t2 || "");
    if (blocked1 && blocked2) return "仅自制剧";
    const allBodies = [t1, t2];
    for (let b of allBodies) {
      if (!b) continue;
      const rm = b.match(/"countryCode"\s*:\s*"?([A-Z]{2})"?/);
      if (rm && rm[1]) return rm[1];
    }
    return "完整解锁";
  } catch (e) { return "不可用"; }
}

async function checkTikTok() {
  try {
    let body1 = await get("https://www.tiktok.com/", { "User-Agent": BASE_UA });
    if (body1 && body1.includes("Please wait...")) {
      try { body1 = await get("https://www.tiktok.com/explore", { "User-Agent": BASE_UA }); } catch (e2) {}
    }
    let m1 = body1 ? body1.match(/"region"\s*:\s*"([A-Z]{2})"/) : null;
    if (m1 && m1[1]) return m1[1];
    const body2 = await get("https://www.tiktok.com/", { "User-Agent": BASE_UA, "Accept-Language": "en" });
    const m2 = body2 ? body2.match(/"region"\s*:\s*"([A-Z]{2})"/) : null;
    if (m2 && m2[1]) return m2[1];
    if (body1 || body2) return "可用";
    return "不可用";
  } catch (e) { return "不可用"; }
}

// 主执行函数
async function main() {
  try {
    const obj = JSON.parse($response.body);
    let countryCode = codeMap[obj.country_code] || obj.country_code;

    // 并发执行所有检测，单个检测超时设为 5000ms 避免网络卡死
    const [gpt, claude, gemini, youtube, netflix, tiktok] = await Promise.all([
      withTimeout(checkChatGPT(), 5000, "超时"),
      withTimeout(checkClaude(), 5000, "超时"),
      withTimeout(checkGemini(), 5000, "超时"),
      withTimeout(checkYouTube(), 5000, "超时"),
      withTimeout(checkNetflix(), 5000, "超时"),
      withTimeout(checkTikTok(), 5000, "超时")
    ]);

    const myObj = {
      "IP地址": obj.ip,
      "地区": countryCode,
      ...(obj.city_name ? { "城市": obj.city_name } : {}),
      "服务提供商": `AS${obj.asn} ${obj.as_desc}`, 
      "AI解锁": `ChatGPT: ${gpt} | Claude: ${claude} | Gemini: ${gemini}`,
      "流媒体解锁": `YouTube: ${youtube} | Netflix: ${netflix} | TikTok: ${tiktok}`,
      "用户代理": obj.user_agent
    };

    $done({ body: JSON.stringify(myObj) });
  } catch (e) {
    $done({ body: $response.body });
  }
}

// 启动执行
main();
