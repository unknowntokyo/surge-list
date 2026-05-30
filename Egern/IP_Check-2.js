const codeMap = { HK: 'HKG', TW: 'TWN', SG: 'SGP', JP: 'JPN', KR: 'KOR', US: 'USA', NL: 'NED', DE: 'GER' };
const BASE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

// 代理软件沙箱环境兼容网络层 (Surge / Quantumult X / Loon / Shadowrocket)
const isQuanX = typeof $task !== "undefined";

function get(url, headers, timeout) {
  return new Promise((resolve) => {
    if (isQuanX) {
      $task.fetch({ url, method: "GET", headers, timeout: (timeout || 8000) / 1000 }).then(
        resp => resolve(resp.body || ""),
        () => resolve("")
      );
    } else {
      $httpClient.get({ url, headers, timeout: timeout || 8000 }, (err, resp, data) => resolve(data || ""));
    }
  });
}

function post(url, body, headers, timeout) {
  return new Promise((resolve) => {
    if (isQuanX) {
      $task.fetch({ url, method: "POST", headers, body, timeout: (timeout || 8000) / 1000 }).then(
        resp => resolve(resp.body || ""),
        () => resolve("")
      );
    } else {
      $httpClient.post({ url, headers, body, timeout: timeout || 8000 }, (err, resp, data) => resolve(data || ""));
    }
  });
}

function getRaw(url, headers, extraOpts) {
  return new Promise((resolve) => {
    let timeout = 8000;
    if (isQuanX) {
      $task.fetch({ url, method: "GET", headers, timeout: timeout / 1000 }).then(
        resp => resolve({ status: resp.statusCode, text: () => Promise.resolve(resp.body || "") }),
        () => resolve(null)
      );
    } else {
      $httpClient.get({ url, headers, timeout }, (err, resp, data) => {
        if (err) resolve(null);
        else resolve({ status: resp ? resp.status || resp.statusCode : 200, text: () => Promise.resolve(data || "") });
      });
    }
  });
}

function withTimeout(promise, ms, fallback) {
  let timer;
  const timeout = new Promise(resolve => { timer = setTimeout(() => resolve(fallback), ms); });
  return Promise.race([promise.catch(() => fallback), timeout]).then(v => { clearTimeout(timer); return v; });
}

function jp(s) { try { return JSON.parse(s); } catch (e) { return null; } }
function ti(v) { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : null; }

// === 从 1.js 完美移植的 AI 检测逻辑 ===
async function checkChatGPT() {
  try {
    const traceTxt = await get("https://chatgpt.com/cdn-cgi/trace", null, 5000);
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
    try { cfDetails = jp(iosBody)?.cf_details || ""; } catch (e2) {}
    const appBlocked = !iosBody || iosBody.includes("blocked_why_headline") || iosBody.includes("unsupported_country_region_territory") || cfDetails.includes("(1)") || cfDetails.includes("(2)");
    if (appBlocked) return "Cross";
    return "APP";
  } catch (e) { return "Cross"; }
}

async function checkGemini() {
  try {
    const bodyRaw = 'f.req=[["K4WWud","[[0],[\\"en-US\\"]]",null,"generic"]]';
    const txt = await post('https://gemini.google.com/_/BardChatUi/data/batchexecute', bodyRaw, { "User-Agent": BASE_UA, "Accept-Language": "en-US", "Content-Type": "application/x-www-form-urlencoded" });
    if (!txt) return "Cross";
    let m = txt.match(/"countryCode"\s*:\s*"([A-Z]{2})"/i);
    if (m && m[1]) return m[1].toUpperCase();
    m = txt.match(/"requestCountry"\s*:\s*\{[^}]*"id"\s*:\s*"([A-Z]{2})"/i);
    if (m && m[1]) return m[1].toUpperCase();
    m = txt.match(/\[\[\\?"([A-Z]{2})\\?",\\?"S/);
    if (m && m[1]) return m[1].toUpperCase();
    if (txt.includes("Bard isn't currently supported")) return "Cross";
    return "OK";
  } catch (e) { return "Cross"; }
}

async function checkClaude() {
  const restricted = { CN: true, HK: true, MO: true, RU: true, KP: true, IR: true, SY: true, CU: true, BY: true, VE: true };
  try {
    const traceTxt = await get("https://claude.ai/cdn-cgi/trace", { "User-Agent": BASE_UA }, 8000);
    const ipMatch = traceTxt ? traceTxt.match(/(?:^|\n)ip=([^\n]+)/) : null;
    const locMatch = traceTxt ? traceTxt.match(/(?:^|\n)loc=([A-Z]{2})/) : null;
    const cIp = ipMatch && ipMatch[1] ? ipMatch[1].trim() : "";
    const cc = locMatch && locMatch[1] ? locMatch[1].toUpperCase() : "";
    if (cc && restricted[cc]) return "受限";
    if (cIp) {
      try {
        const riskTxt = await get(`https://ip.net.coffee/api/iprisk/${encodeURIComponent(cIp)}`, null, 4000);
        const r = JSON.parse(riskTxt);
        const score = ti(r && r.trust_score);
        if (score !== null && score < 50) return "风险";
      } catch (e2) {}
    }
    return cc || "OK";
  } catch (e) { return "Cross"; }
}

// === 从 1.js 完美移植的流媒体检测逻辑 ===
async function checkYouTube() {
  try {
    const body = await get('https://www.youtube.com/premium', { "User-Agent": BASE_UA, "Accept-Language": "en" }, 8000);
    if (!body) return "Cross";
    if (body.includes('www.google.cn')) return "CN";
    const isNotAvailable = body.includes('Premium is not available in your country') || body.includes('YouTube Premium is not available');
    const m = body.match(/"contentRegion"\s*:\s*"?([A-Z]{2})"?/);
    const region = m && m[1] ? m[1].toUpperCase() : null;
    const isAvailable = body.includes('ad-free') || body.includes('Ad-free');
    if (isNotAvailable) return "Cross";
    if (isAvailable && region) return region;
    if (isAvailable && !region) return "OK";
    if (region) return region;
    return "Cross";
  } catch (e) { return "Cross"; }
}

async function checkNetflix() {
  try {
    const titles = ["https://www.netflix.com/title/81280792", "https://www.netflix.com/title/70143836"];
    const fetchTitle = async (url) => { try { return await get(url, { "User-Agent": BASE_UA }, 8000); } catch (e) { return ""; } };
    const bodies = await Promise.all([fetchTitle(titles[0]), fetchTitle(titles[1])]);
    const t1 = bodies[0], t2 = bodies[1];
    if (!t1 && !t2) return "Cross";
    const blocked1 = /oh no!/i.test(t1 || "") || /not available/i.test(t1 || "") || /Sorry/i.test(t1 || "");
    const blocked2 = /oh no!/i.test(t2 || "") || /not available/i.test(t2 || "") || /Sorry/i.test(t2 || "");
    if (blocked1 && blocked2) return "Popcorn";
    const allBodies = [t1, t2];
    for (let b of allBodies) {
      if (!b) continue;
      const rm = b.match(/"countryCode"\s*:\s*"?([A-Z]{2})"?/);
      if (rm && rm[1]) return rm[1];
    }
    return "OK";
  } catch (e) { return "Cross"; }
}

async function checkTikTok() {
  try {
    let body1 = await get("https://www.tiktok.com/", { "User-Agent": BASE_UA }, 8000);
    if (body1 && body1.includes("Please wait...")) {
      try { body1 = await get("https://www.tiktok.com/explore", { "User-Agent": BASE_UA }, 8000); } catch (e2) {}
    }
    let m1 = body1 ? body1.match(/"region"\s*:\s*"([A-Z]{2})"/) : null;
    if (m1 && m1[1]) return m1[1];
    const body2 = await get("https://www.tiktok.com/", { "User-Agent": BASE_UA, "Accept-Language": "en" }, 8000);
    const m2 = body2 ? body2.match(/"region"\s*:\s*"([A-Z]{2})"/) : null;
    if (m2 && m2[1]) return m2[1];
    if (body1 || body2) return "OK";
    return "Cross";
  } catch (e) { return "Cross"; }
}

// 统一格式化输出状态
function formatStatus(status) {
  if (status === "Cross") return "不可用";
  if (status === "Popcorn") return "仅自制剧";
  if (status === "CN") return "中国大陆";
  if (status === "OK") return "已解锁";
  return status; // 返回具体的区域代码如：US, HK, SG 或风险状态
}

// 主异步函数
async function main() {
  try {
    const obj = JSON.parse($response.body);
    let countryCode = codeMap[obj.country_code] || obj.country_code;

    // 并发执行所有检测，单项超时保护设为 6000ms
    const [gpt, gemini, claude, youtube, netflix, tiktok] = await Promise.all([
      withTimeout(checkChatGPT(), 6000, "Cross"),
      withTimeout(checkGemini(), 6000, "Cross"),
      withTimeout(checkClaude(), 6000, "Cross"),
      withTimeout(checkYouTube(), 6000, "Cross"),
      withTimeout(checkNetflix(), 6000, "Cross"),
      withTimeout(checkTikTok(), 6000, "Cross")
    ]);

    // 组合成新的 JSON 对象
    const myObj = {
      "IP地址": obj.ip,
      "地区": countryCode,
      ...(obj.city_name ? { "城市": obj.city_name } : {}),
      "服务提供商": `AS${obj.asn} ${obj.as_desc}`, 
      "ChatGPT": formatStatus(gpt),
      "Claude": formatStatus(claude),
      "Gemini": formatStatus(gemini),
      "YouTube": formatStatus(youtube),
      "Netflix": formatStatus(netflix),
      "TikTok": formatStatus(tiktok),
      "用户代理": obj.user_agent
    };

    $done({ body: JSON.stringify(myObj) });
  } catch (e) {
    // 即使发生未知错误也保证能返回原有 body 不会卡死网络
    $done({ body: $response.body });
  }
}

// 启动执行
main();
