export default async function(ctx) {
  if (!ctx.env) ctx.env = {};
  const widgetFamily = ctx.widgetFamily || 'systemMedium';
  const BG_COLOR = { light: '#FFFFFF', dark: '#1C1C1E' };
  const C_TITLE = { light: '#1A1A1A', dark: '#FFD700' };
  const C_SUB = { light: '#666666', dark: '#B0B0B0' };
  const C_MAIN = { light: '#1A1A1A', dark: '#FFFFFF' };
  const C_GREEN = { light: '#32D74B', dark: '#32D74B' };
  const C_YELLOW = { light: '#FFD60A', dark: '#FFD60A' };
  const C_ORANGE = { light: '#FF9500', dark: '#FF9500' };
  const C_RED = { light: '#FF3B30', dark: '#FF3B30' };
  const C_ICON = { light: '#007AFF', dark: '#0A84FF' };

  if (['systemSmall', 'accessoryCircular', 'accessoryInline', 'accessoryRectangular'].includes(widgetFamily)) {
    return { type: 'widget', padding: 16, backgroundColor: BG_COLOR, children: [{ type: 'text', text: '请使用中号或大号组件', font: { size: 'callout' }, textColor: C_MAIN, textAlign: 'center' }] };
  }

  const policy = String((ctx.env && ctx.env.POLICY) ? ctx.env.POLICY : "").trim();
  const BASE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
  const RISK_DATA_BASE = "https://raw.githubusercontent.com/Linsars/ip-risk-data/main/dist";
  const RISK_WORKER_API = "https://iprisk.linsar.us.ci/check";

  async function get(url, headers, timeout) {
    const opts = { timeout: timeout || 8000 };
    if (headers) opts.headers = headers;
    const res = await ctx.http.get(url, opts);
    return await res.text();
  }
  async function post(url, body, headers, timeout) {
    const opts = { timeout: timeout || 8000, body: body };
    if (headers) opts.headers = headers;
    const res = await ctx.http.post(url, opts);
    return await res.text();
  }
  async function getRaw(url, headers, extraOpts) {
    const opts = { timeout: 8000 };
    if (headers) opts.headers = headers;
    if (extraOpts) Object.assign(opts, extraOpts);
    return await ctx.http.get(url, opts);
  }
  function jp(s) { try { return JSON.parse(s); } catch (e) { return null; } }
  function ti(v) { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : null; }
  function ip4ToInt(ip) {
    const p = String(ip || '').split('.').map(x => Number(x));
    if (p.length !== 4 || p.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return null;
    return (((p[0] * 256 + p[1]) * 256 + p[2]) * 256 + p[3]) >>> 0;
  }
  function ip4InCidr(ip, cidr) {
    const n = ip4ToInt(ip);
    const m = String(cidr || '').match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
    if (n === null || !m) return false;
    const base = ip4ToInt(m[1]);
    const bits = Number(m[2]);
    if (base === null || bits < 0 || bits > 32) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (n & mask) === (base & mask);
  }
  function ip4InCidrList(ip, txt) {
    return String(txt || '').split(/\n+/).some(line => ip4InCidr(ip, line.trim()));
  }
  function withTimeout(promise, ms, fallback) {
    let timer;
    const timeout = new Promise(resolve => { timer = setTimeout(() => resolve(fallback), ms); });
    return Promise.race([promise.catch(() => fallback), timeout]).then(v => { clearTimeout(timer); return v; });
  }
  // HTML parsing is intentionally avoided for risk sources.
  // Risk dimensions use direct self-check sources; no HTML risk-page parsing.

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

  const fmtISP = (isp) => {
    if (!isp) return "未知";
    const s = String(isp).toLowerCase();
    if (/移动|mobile|cmcc/i.test(s)) return "中国移动";
    if (/电信|telecom|chinanet/i.test(s)) return "中国电信";
    if (/联通|unicom/i.test(s)) return "中国联通";
    if (/广电|broadcast|cbn/i.test(s)) return "中国广电";
    return isp;
  };

  const fmtFlag = (code) => {
    if (!code || code.length !== 2 || code.toUpperCase() === 'XX') return "🌍";
    return String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0)));
  };

  function hasCjk(s) { return /[\u4e00-\u9fff]/.test(String(s || "")); }
  function cnGeoScore(g) {
    if (!g) return -1;
    const text = [g.country, g.region, g.city].filter(Boolean).join(' ');
    if (!hasCjk(text)) return -1;
    let score = text.length;
    if (/区|县|旗|镇|街道|乡/.test(text)) score += 100;
    return score;
  }
  function pickBestCnGeo(list) {
    let best = null, bestScore = -1;
    (list || []).forEach(g => {
      const score = cnGeoScore(g);
      if (score > bestScore) { best = g; bestScore = score; }
    });
    return bestScore >= 0 ? best : null;
  }
  function buildGeoLoc(g, fallbackCode) {
    if (!g) return "";
    const code = g.country_code || g.countryCode || fallbackCode || "";
    const parts = [g.country, g.region, g.city].filter(Boolean);
    if (!parts.length) return "";
    return `${fmtFlag(code)} ${parts.join(' ')}`.replace(/\s+/g, ' ').trim();
  }

  function extractIspFromGeo(geo) {
    const m = String(geo || '').match(/(电信|联通|移动|广电|铁通|教育网|长城宽带|鹏博士|China\s*Telecom|China\s*Unicom|China\s*Mobile|Chinanet)\s*$/i);
    return m ? fmtISP(m[1]) : "";
  }
  function stripIspFromGeo(geo) {
    return String(geo || '')
      .replace(/\s*(电信|联通|移动|广电|铁通|教育网|长城宽带|鹏博士|China\s*Telecom|China\s*Unicom|China\s*Mobile|Chinanet)\s*$/i, '')
      .trim();
  }

  const unlockPromise = Promise.all([
    withTimeout(checkChatGPT(), 9000, "Cross"),
    withTimeout(checkGemini(), 9000, "Cross"),
    withTimeout(checkYouTube(), 9000, "Cross"),
    withTimeout(checkNetflix(), 9000, "Cross"),
    withTimeout(checkTikTok(), 9000, "Cross"),
    withTimeout(checkClaude(), 9000, "Cross")
  ]);

  async function getLocalCnGeo() {
    const fetchIP138 = async () => {
      try {
        const html = await get('https://2026.ip138.com/', { 'User-Agent': BASE_UA }, 5000);
        const ipMatch = html && html.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
        const geoMatch = html && html.match(/来自：([^<\n]+)/);
        if (ipMatch) return { ip: ipMatch[1], geo: geoMatch ? geoMatch[1].replace(/<[^>]+>/g, '').trim() : '' };
      } catch (e) {}
      return null;
    };
    const fetchIPCN = async () => {
      try {
        const text = await get('https://my.ip.cn/', { 'User-Agent': BASE_UA }, 5000);
        const ipMatch = text && text.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
        const geoMatch = text && text.match(/归属地：(.+)/);
        if (ipMatch) return { ip: ipMatch[1], geo: geoMatch ? geoMatch[1].replace(/<[^>]+>/g, '').trim() : '' };
      } catch (e) {}
      return null;
    };
    const rs = await Promise.all([
      withTimeout(fetchIP138(), 5200, null),
      withTimeout(fetchIPCN(), 5200, null)
    ]);
    const valid = rs.filter(r => r && r.ip);
    if (!valid.length) return null;
    const sameIp = valid[0];
    const candidates = valid.filter(r => r.ip === sameIp.ip && r.geo);
    const picked = candidates.reduce((a, b) => (a.geo.length >= b.geo.length ? a : b), { geo: '' });
    const rawGeo = picked.geo || sameIp.geo || '';
    return { ip: sameIp.ip, geo: stripIspFromGeo(rawGeo), isp: extractIspFromGeo(rawGeo) };
  }

  async function getLocalByIpip() {
    try {
      const lRes = await ctx.http.get('https://myip.ipip.net/json', { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 });
      const body = JSON.parse(await lRes.text());
      if (body?.data) {
        const locArr = body.data.location || [];
        return {
          ip: body.data.ip || "获取失败",
          loc: `🇨🇳 ${locArr[1] || ""} ${locArr[2] || ""}`.trim() || "未知位置",
          isp: fmtISP(locArr[4] || locArr[3])
        };
      }
    } catch (e) {}
    return null;
  }

  async function getLocalInfo() {
    let lIp = "获取失败", lLoc = "未知位置", lIsp = "未知运营商";
    let hasLocalCnGeo = false;
    const [cnGeo, ipipInfo] = await Promise.all([
      withTimeout(getLocalCnGeo(), 5600, null),
      withTimeout(getLocalByIpip(), 5600, null)
    ]);

    const base = ipipInfo || null;
    if (base && base.ip && base.ip !== "获取失败") {
      lIp = base.ip;
      lLoc = base.loc || lLoc;
      lIsp = base.isp || lIsp;
    }
    if (cnGeo && cnGeo.ip) {
      lIp = cnGeo.ip;
      if (cnGeo.geo) { lLoc = cnGeo.geo; hasLocalCnGeo = true; }
      if (cnGeo.isp) lIsp = cnGeo.isp;
    }

    if (lIp !== "获取失败" && (!hasLocalCnGeo || lIsp === "未知运营商")) {
      try {
        const lcRes = await withTimeout(ctx.http.get(`https://ip.net.coffee/api/ip/lookup/${encodeURIComponent(lIp)}`, { timeout: 3000 }), 3200, null);
        if (lcRes) {
          const lc = JSON.parse(await lcRes.text());
          if (lc) {
            let lcCode = lc.countryCode || lc.country_code || "";
            if (lcCode.toUpperCase() === 'TW') lcCode = 'CN';
            if (!hasLocalCnGeo) {
              const geoList = Array.isArray(lc.geo_sources) ? lc.geo_sources : [];
              const mainGeo = { country: lc.country, region: lc.region, city: lc.city, country_code: lcCode };
              const cnGeo2 = pickBestCnGeo([mainGeo].concat(geoList));
              const detailLoc = cnGeo2 ? buildGeoLoc(cnGeo2, lcCode) : "";
              if (detailLoc && detailLoc !== "🌍") lLoc = detailLoc;
            }
            if (lc.isp || lc.asOrganization || lc.company_name) lIsp = fmtISP(lc.isp || lc.asOrganization || lc.company_name);
          }
        }
      } catch (e) {}
    }
    return { lIp, lLoc, lIsp };
  }

  async function getLandingIPv4() {
    const parseIp = (txt) => {
      if (!txt) return "";
      try { const j = JSON.parse(txt); if (j && j.ip) return String(j.ip).trim(); } catch (e) {}
      const m = String(txt).match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
      return m ? m[0] : "";
    };
    const sources = [
      'https://api4.ipify.org?format=json',
      'https://api-ipv4.ip.sb/ip',
      'https://ipv4.icanhazip.com',
      'https://v4.ident.me'
    ];
    const tasks = sources.map(async (url) => {
      try {
        const res = await withTimeout(ctx.http.get(url, { timeout: 3500 }), 3800, null);
        if (!res) return "";
        return parseIp(await res.text());
      } catch (e) { return ""; }
    });
    return await new Promise(resolve => {
      let pending = tasks.length, done = false;
      const finish = (v) => { if (!done && v) { done = true; resolve(v); } };
      tasks.forEach(p => p.then(v => { if (v) finish(v); else if (--pending === 0 && !done) resolve(""); }).catch(() => { if (--pending === 0 && !done) resolve(""); }));
      setTimeout(() => { if (!done) { done = true; resolve(""); } }, 3900);
    });
  }

  function buildNativeText(flags, org, typ) {
    const f = flags || {};
    const text = `${org || ''} ${typ || ''}`.toLowerCase();
    const cloudNames = ['amazon', 'aws', 'google', 'microsoft', 'azure', 'oracle', 'alibaba', 'tencent', 'cloudflare', 'digitalocean', 'linode', 'akamai', 'vultr', 'hetzner', 'ovh'];
    const isCloud = f.cloud || cloudNames.some(k => text.includes(k));
    if (f.mobile) return '📱 移动网络';
    if (f.residential && !f.datacenter) return '🏠 住宅宽带';
    if (isCloud) return '☁️ 云服务器';
    if (f.datacenter || String(typ || '').toLowerCase() === 'hosting') return '🏢 商业机房';
    if (f.crawler) return '🤖 爬虫网络';
    if (f.tor) return '🧅 Tor出口';
    if (f.vpn || f.proxy) return '🔀 代理/VPN';
    return '未知';
  }

  async function getLandingInfo() {
    let nIp = "获取失败", nLoc = "未知位置", nativeText = "未知";
    let riskIPPureTxt = "--", ippSev = -1;
    let riskIpapiTxt = "--", apiSev = -1;
    let riskCoffeeTxt = "--", coffeeSev = -1;
    let riskProxyTxt = "--", proxySev = -1;
    let riskBlackTxt = "--", blackSev = -1;
    let attrFlags = { residential: false, mobile: false, datacenter: false, cloud: false, proxy: false, vpn: false, tor: false, crawler: false };
    let companyName = "", companyType = "", asnOrg = "", asnType = "";
    let ipApiProxy = "--", ipApiHosting = "--";
    let dshieldTxt = "--", dshieldSev = -1;
    let sfsTxt = "--", sfsSev = -1;
    let blockTxt = "--", blockSev = -1;
    let spamTxt = "--", spamSev = -1;
    let torTxt = "否", torSev = 0;
    let otxTxt = "--", otxSev = -1;
    let greyTxt = "--", greySev = -1;
    let pulseTxt = "--", pulseSev = -1;
    let portTxt = "--", portSev = -1;
    let workerRisk = null;

    nIp = await getLandingIPv4() || "获取失败";

    if (nIp === "获取失败") {
      try {
        const res2 = await withTimeout(ctx.http.get('https://api.ip.sb/geoip', { timeout: 4000 }), 4200, null);
        if (res2) {
          const d2 = JSON.parse(await res2.text());
          if (d2 && d2.ip) {
            nIp = d2.ip;
            let code2 = d2.country_code || "";
            if (code2.toUpperCase() === 'TW') code2 = 'CN';
            nLoc = `${fmtFlag(code2)} ${d2.country || ""} ${d2.city || ""}`.trim();
          }
        }
      } catch (e) {}
    }

    if (nIp !== "获取失败") {
      await Promise.all([
        (async () => {
          try {
            const wr = await withTimeout(ctx.http.get(`${RISK_WORKER_API}?ip=${encodeURIComponent(nIp)}`, { timeout: 4200 }), 4400, null);
            if (!wr) return;
            const wj = JSON.parse(await wr.text());
            if (wj && wj.ok && wj.result) workerRisk = wj.result;
          } catch (e) {}
        })(),
        (async () => {
          try {
            const coffeeRes = await withTimeout(ctx.http.get(`https://ip.net.coffee/api/ip/lookup/${encodeURIComponent(nIp)}`, { timeout: 4500 }), 4700, null);
            if (!coffeeRes) return;
            const cj = JSON.parse(await coffeeRes.text());
            if (cj) {
              let code = cj.countryCode || cj.country_code || "";
              if (code.toUpperCase() === 'TW') code = 'CN';
              nLoc = `${fmtFlag(code)} ${cj.country || ""} ${cj.city || ""}`.trim() || nLoc;
              attrFlags.residential = attrFlags.residential || cj.isResidential === true;
              attrFlags.datacenter = attrFlags.datacenter || cj.is_datacenter === true || cj.isResidential === false || String(cj.company_type || '').toLowerCase() === 'hosting';
              attrFlags.mobile = attrFlags.mobile || cj.is_mobile === true;
              attrFlags.proxy = attrFlags.proxy || cj.is_proxy === true;
              attrFlags.vpn = attrFlags.vpn || cj.is_vpn === true;
              attrFlags.tor = attrFlags.tor || cj.is_tor === true;
              attrFlags.crawler = attrFlags.crawler || cj.is_crawler === true;
              companyName = companyName || cj.company_name || cj.datacenter_name || '';
              companyType = companyType || cj.company_type || '';
              asnOrg = asnOrg || cj.asOrganization || cj.asname || '';
              nativeText = buildNativeText(attrFlags, companyName || asnOrg, companyType || asnType);
              const score = ti(cj.trust_score);
              if (score !== null) {
                if (score < 30) coffeeSev = 4;
                else if (score < 45) coffeeSev = 3;
                else if (score < 60) coffeeSev = 2;
                else if (score < 75) coffeeSev = 1;
                else coffeeSev = 0;
                riskCoffeeTxt = `信任${score}`;
              }
            }
          } catch (e) {}
        })(),
        (async () => {
          try {
            const apiRes = await withTimeout(ctx.http.get(`https://api.ipapi.is/?q=${nIp}`, { timeout: 4500 }), 4700, null);
            if (!apiRes) return;
            const j = JSON.parse(await apiRes.text());
            if (j) {
              attrFlags.mobile = attrFlags.mobile || j.is_mobile === true;
              attrFlags.datacenter = attrFlags.datacenter || j.is_datacenter === true || String(j.company?.type || '').toLowerCase() === 'hosting' || String(j.asn?.type || '').toLowerCase() === 'hosting';
              attrFlags.proxy = attrFlags.proxy || j.is_proxy === true;
              attrFlags.vpn = attrFlags.vpn || j.is_vpn === true;
              attrFlags.tor = attrFlags.tor || j.is_tor === true;
              attrFlags.crawler = attrFlags.crawler || j.is_crawler === true;
              companyName = companyName || j.company?.name || j.datacenter?.datacenter || '';
              companyType = companyType || j.company?.type || '';
              asnOrg = asnOrg || j.asn?.org || j.asn?.descr || '';
              asnType = asnType || j.asn?.type || '';
              nativeText = buildNativeText(attrFlags, companyName || asnOrg, companyType || asnType);
            }
            if (j) {
              const scores = [j.company?.abuser_score, j.asn?.abuser_score].map(x => String(x || '').match(/([0-9.]+)\s*\(([^)]+)\)/)).filter(Boolean);
              let best = null;
              scores.forEach(m => {
                const raw = Number(m[1]);
                const lv = m[2].trim();
                let sev = 0;
                if (lv.includes('Very High')) sev = 4;
                else if (lv.includes('High')) sev = 3;
                else if (lv.includes('Elevated')) sev = 2;
                const item = { raw, sev, pct: Math.round(raw * 10000) / 100 + '%' };
                if (!best || item.sev > best.sev || (item.sev === best.sev && item.raw > best.raw)) best = item;
              });
              if (best) { apiSev = best.sev; riskIpapiTxt = best.pct; }
            }
          } catch (e) {}
        })(),
        (async () => {
          try {
            const res = await withTimeout(ctx.http.get('https://my.ippure.com/v1/info', { timeout: 5000 }), 5200, null);
            if (!res) return;
            const d = JSON.parse(await res.text());
            const risk = ti(d.fraudScore);
            if (risk !== null) {
              if (risk >= 80) ippSev = 4;
              else if (risk >= 70) ippSev = 3;
              else if (risk >= 40) ippSev = 2;
              else if (risk > 0) ippSev = 1;
              else ippSev = 0;
              riskIPPureTxt = `风险${risk}`;
            }
          } catch (e) {}
        })(),
        (async () => {
          try {
            const pcRes = await withTimeout(ctx.http.get(`https://proxycheck.io/v2/${encodeURIComponent(nIp)}?vpn=1&asn=1&risk=1&_=${Date.now()}`, { timeout: 4500 }), 4700, null);
            if (!pcRes) return;
            const pj = JSON.parse(await pcRes.text());
            const item = pj && pj[nIp];
            if (item) {
              const risk = ti(item.risk);
              const isProxy = String(item.proxy || '').toLowerCase() === 'yes';
              const typ = item.type ? String(item.type) : '';
              const typLow = typ.toLowerCase();
              attrFlags.proxy = attrFlags.proxy || isProxy;
              attrFlags.vpn = attrFlags.vpn || typLow.includes('vpn');
              attrFlags.tor = attrFlags.tor || typLow.includes('tor');
              companyName = companyName || item.provider || item.organisation || '';
              asnOrg = asnOrg || item.provider || item.organisation || '';
              nativeText = buildNativeText(attrFlags, companyName || asnOrg, companyType || asnType);
              if (risk !== null) {
                if (risk >= 80) proxySev = 4;
                else if (risk >= 60 || isProxy) proxySev = 3;
                else if (risk >= 30) proxySev = 2;
                else if (risk > 0) proxySev = 1;
                else proxySev = 0;
                riskProxyTxt = `${typ || (isProxy ? 'Proxy' : 'Clean')}/${risk}`;
              }
            }
          } catch (e) {}
        })(),
        (async () => {
          try {
            const bbRes = await withTimeout(ctx.http.get(`https://blackbox.ipinfo.app/lookup/${encodeURIComponent(nIp)}`, { timeout: 3500 }), 3700, null);
            if (!bbRes) return;
            const txt = String(await bbRes.text()).trim().toUpperCase();
            if (txt === 'Y') { blackSev = 3; riskBlackTxt = '疑似代理'; }
            else if (txt === 'N') { blackSev = 0; riskBlackTxt = '正常'; }
          } catch (e) {}
        })(),
        (async () => {
          try {
            const r = await withTimeout(ctx.http.get(`http://ip-api.com/json/${encodeURIComponent(nIp)}?fields=status,proxy,hosting,mobile,as,isp,org,countryCode,query`, { timeout: 3500 }), 3700, null);
            if (!r) return;
            const j = JSON.parse(await r.text());
            if (j && j.status === 'success') {
              attrFlags.proxy = attrFlags.proxy || j.proxy === true;
              attrFlags.datacenter = attrFlags.datacenter || j.hosting === true;
              attrFlags.mobile = attrFlags.mobile || j.mobile === true;
              ipApiProxy = j.proxy === true ? '是' : '否';
              ipApiHosting = j.hosting === true ? '是' : '否';
              // mobile flag is stored in attrFlags.mobile.
              asnOrg = asnOrg || j.as || j.org || j.isp || '';
              nativeText = buildNativeText(attrFlags, companyName || asnOrg, companyType || asnType);
            }
          } catch (e) {}
        })(),
        (async () => {
          try {
            const r = await withTimeout(ctx.http.get(`https://isc.sans.edu/api/ip/${encodeURIComponent(nIp)}?json`, { timeout: 3500 }), 3700, null);
            if (!r) return;
            const d = JSON.parse(await r.text()).ip || {};
            const attacks = ti(d.attacks), count = ti(d.count), maxrisk = ti(d.maxrisk);
            if ((attacks || 0) > 0 || (count || 0) > 0 || (maxrisk || 0) > 0) {
              dshieldSev = (maxrisk && maxrisk >= 7) || (attacks && attacks >= 100) ? 4 : 3;
              dshieldTxt = attacks ? `${attacks}次` : (count ? `${count}条` : `风险${maxrisk}`);
            } else { dshieldSev = 0; dshieldTxt = '未见'; }
          } catch (e) {}
        })(),
        (async () => {
          try {
            const r = await withTimeout(ctx.http.get(`https://api.stopforumspam.org/api?ip=${encodeURIComponent(nIp)}&json`, { timeout: 3500 }), 3700, null);
            if (!r) return;
            const d = JSON.parse(await r.text()).ip || {};
            const appears = Number(d.appears || 0), freq = Number(d.frequency || 0);
            if (appears > 0 || freq > 0) { sfsSev = freq >= 3 ? 4 : 3; sfsTxt = freq ? `命中${freq}` : '命中'; }
            else { sfsSev = 0; sfsTxt = '未见'; }
          } catch (e) {}
        })(),
        (async () => {
          try {
            const r = await withTimeout(ctx.http.get(`https://api.blocklist.de/api.php?ip=${encodeURIComponent(nIp)}`, { timeout: 3500 }), 3700, null);
            if (!r) return;
            const txt = String(await r.text());
            const attacks = Number((txt.match(/attacks:\s*(\d+)/i) || [])[1] || 0);
            const reports = Number((txt.match(/reports:\s*(\d+)/i) || [])[1] || 0);
            if (attacks > 0 || reports > 0) { blockSev = attacks >= 3 || reports >= 3 ? 4 : 3; blockTxt = attacks ? `攻击${attacks}` : `报告${reports}`; }
            else { blockSev = 0; blockTxt = '未见'; }
          } catch (e) {}
        })(),
        (async () => {
          try {
            const drop = await withTimeout(ctx.http.get(`${RISK_DATA_BASE}/spamhaus-drop.txt`, { timeout: 3600 }), 3800, null);
            const edrop = await withTimeout(ctx.http.get(`${RISK_DATA_BASE}/spamhaus-edrop.txt`, { timeout: 3600 }), 3800, null);
            const dropTxt = drop ? await drop.text() : '';
            const edropTxt = edrop ? await edrop.text() : '';
            const hitDrop = ip4InCidrList(nIp, dropTxt);
            const hitEdrop = ip4InCidrList(nIp, edropTxt);
            if (hitDrop || hitEdrop) { spamSev = 4; spamTxt = hitEdrop ? 'EDROP' : 'DROP'; }
            else { spamSev = 0; spamTxt = '未命中'; }
          } catch (e) {}
        })(),
        (async () => {
          try {
            const r = await withTimeout(ctx.http.get(`${RISK_DATA_BASE}/tor-exit-v4.txt`, { timeout: 3600 }), 3800, null);
            if (!r) return;
            const txt = `\n${String(await r.text()).trim()}\n`;
            if (txt.includes(`\n${nIp}\n`)) { attrFlags.tor = true; torSev = 4; torTxt = '是'; nativeText = buildNativeText(attrFlags, companyName || asnOrg, companyType || asnType); }
            else { torSev = 0; torTxt = '否'; }
          } catch (e) {}
        })(),
        (async () => {
          try {
            const r = await withTimeout(ctx.http.get(`https://otx.alienvault.com/api/v1/indicators/IPv4/${encodeURIComponent(nIp)}/general`, { timeout: 4200 }), 4400, null);
            if (!r) return;
            const d = JSON.parse(await r.text());
            const pulses = Number(d?.pulse_info?.count || 0), rep = Number(d?.reputation || 0);
            if (pulses > 0 || rep > 0) { otxSev = pulses >= 3 || rep >= 3 ? 4 : 3; otxTxt = pulses ? `${pulses}脉冲` : `信誉${rep}`; }
            else { otxSev = 0; otxTxt = '未见'; }
          } catch (e) {}
        })(),
        (async () => {
          try {
            const r = await withTimeout(ctx.http.get(`https://api.greynoise.io/v3/community/${encodeURIComponent(nIp)}`, { timeout: 3500 }), 3700, null);
            if (!r) return;
            const d = JSON.parse(await r.text());
            if (d.noise === true) { greySev = 3; greyTxt = '扫描源'; }
            else if (d.riot === true) { greySev = 0; greyTxt = 'RIOT'; }
            else { greySev = 0; greyTxt = '未见'; }
          } catch (e) {}
        })(),
        (async () => {
          try {
            const r = await withTimeout(ctx.http.get(`https://pulsedive.com/api/info.php?indicator=${encodeURIComponent(nIp)}`, { timeout: 4200 }), 4400, null);
            if (!r) return;
            const d = JSON.parse(await r.text());
            if (d.error) { pulseSev = 0; pulseTxt = '未见'; return; }
            const risk = String(d.risk || '').toLowerCase();
            if (risk.includes('critical') || risk.includes('high')) { pulseSev = 4; pulseTxt = '高危'; }
            else if (risk.includes('medium')) { pulseSev = 3; pulseTxt = '可疑'; }
            else if (risk.includes('low')) { pulseSev = 1; pulseTxt = '低危'; }
            else { pulseSev = 0; pulseTxt = '未见'; }
          } catch (e) {}
        })(),
        (async () => {
          try {
            const r = await withTimeout(ctx.http.get(`https://internetdb.shodan.io/${encodeURIComponent(nIp)}`, { timeout: 4200 }), 4400, null);
            if (!r || r.status === 404) { portSev = 0; portTxt = '未见'; return; }
            const d = JSON.parse(await r.text());
            const ports = Array.isArray(d.ports) ? d.ports : [];
            const vulns = d.vulns && typeof d.vulns === 'object' ? Object.keys(d.vulns) : [];
            if (vulns.length) { portSev = 4; portTxt = `${vulns.length}漏洞`; }
            else if (ports.some(p => [22,23,3389,5900,6379,9200,9300,11211].includes(Number(p)))) { portSev = 3; portTxt = ports.slice(0, 3).join(','); }
            else if (ports.length) { portSev = 1; portTxt = ports.slice(0, 3).join(','); }
            else { portSev = 0; portTxt = '未见'; }
          } catch (e) {}
        })()
      ]);
    }
    nativeText = buildNativeText(attrFlags, companyName || asnOrg, companyType || asnType);
    return { nIp, nLoc, nativeText, attrFlags, asnType, riskIPPureTxt, ippSev, riskIpapiTxt, apiSev, riskCoffeeTxt, coffeeSev, riskProxyTxt, proxySev, riskBlackTxt, blackSev, ipApiProxy, ipApiHosting, dshieldTxt, dshieldSev, sfsTxt, sfsSev, blockTxt, blockSev, spamTxt, spamSev, torTxt, torSev, otxTxt, otxSev, greyTxt, greySev, pulseTxt, pulseSev, portTxt, portSev, workerRisk };
  }

  const [localInfo, landingInfo, unlockStatuses] = await Promise.all([
    getLocalInfo(),
    getLandingInfo(),
    unlockPromise
  ]);
  const { lIp, lLoc, lIsp } = localInfo;
  const { nIp, nLoc, nativeText, attrFlags, asnType, riskIPPureTxt, ippSev, riskIpapiTxt, apiSev, riskCoffeeTxt, coffeeSev, riskProxyTxt, proxySev, riskBlackTxt, blackSev, ipApiProxy, ipApiHosting, dshieldTxt, dshieldSev, sfsTxt, sfsSev, blockTxt, blockSev, spamTxt, spamSev, torTxt, torSev, otxTxt, otxSev, greyTxt, greySev, pulseTxt, pulseSev, portTxt, portSev, workerRisk } = landingInfo;
  const [gptStatus, geminiStatus, youtubeStatus, netflixStatus, tiktokStatus, claudeStatus] = unlockStatuses;

  const proxySuccess = nIp !== "获取失败";
  const isLarge = widgetFamily === 'systemLarge';
  const isDirectPolicy = !policy || policy.toUpperCase() === "DIRECT";
  const policyOk = !isDirectPolicy && proxySuccess && nIp !== lIp;
  const policyWarn = !isDirectPolicy && (!proxySuccess || nIp === lIp);
  const getUnlockColor = (status) => (status === "Cross" || status === "CN" || status === "受限" || status === "风险") ? C_RED : C_GREEN;
  const getUnlockResult = (status) => {
    if (status === "Cross") return "不可用";
    if (status === "Popcorn") return "仅自制";
    if (status === "CN") return "CN";
    return status;
  };

  let riskGrades = [];
  let maxSev = -1;
  const sourceGrades = proxySuccess ? [
    { sev: ippSev, t: `IPPure: ${riskIPPureTxt}` },
    { sev: apiSev, t: `ipapi: ${riskIpapiTxt}` },
    { sev: coffeeSev, t: `NetCoffee: ${riskCoffeeTxt}` },
    { sev: proxySev, t: `ProxyCheck: ${riskProxyTxt}` },
    { sev: blackSev, t: `Blackbox: ${riskBlackTxt}` }
  ] : [];
  if (proxySuccess) {
    sourceGrades.forEach(g => { if (g.sev > maxSev) maxSev = g.sev; });
    riskGrades = [
      { sev: -1, t: 'TG预测: 计算中' },
      ...sourceGrades
    ];
  } else {
    maxSev = 4;
    riskGrades = [
      { sev: 4, t: 'TG预测: 无法判断' },
      { sev: -1, t: 'IPPure: --' },
      { sev: -1, t: 'ipapi: --' },
      { sev: -1, t: 'NetCoffee: --' },
      { sev: -1, t: 'ProxyCheck: --' },
      { sev: -1, t: 'Blackbox: --' }
    ];
  }

  const yesNoSev = (v, yesSev = 3) => v === '是' ? yesSev : (v === '否' ? 0 : -1);
  const flags = attrFlags || {};
  const w = workerRisk || {};
  const workerProxyTxt = w.proxy === '是' ? `${w.proxy_type || 'Proxy'}${w.proxy_risk != null ? '/' + w.proxy_risk : ''}` : '';
  const localProxyTxt = riskProxyTxt && !['正常', '--'].includes(riskProxyTxt) ? riskProxyTxt : (flags.vpn ? 'VPN' : (flags.proxy ? 'Proxy' : ''));
  const proxyValue = flags.tor ? 'Tor' : (workerProxyTxt || localProxyTxt || ((w.proxy === '否' || ipApiProxy === '否' || riskProxyTxt.includes('Clean')) ? '否' : '--'));
  const torValue = flags.tor || torSev >= 4 || w.tor === '是' ? '是' : (torTxt || '否');
  const dcValue = (w.datacenter === '是' || flags.datacenter || ipApiHosting === '是' || nativeText.includes('云') || nativeText.includes('机房')) ? '是' : ((w.datacenter === '否' || flags.residential || flags.mobile || ipApiHosting === '否') ? '否' : '--');
  const workerSpamHit = w.spamhaus && w.spamhaus !== '未命中';
  const banHit = sfsSev >= 3 || blockSev >= 3 || spamSev >= 4 || workerSpamHit;
  const banClean = sfsSev === 0 && blockSev === 0 && spamSev === 0 && (w.spamhaus === '未命中' || !w.spamhaus);
  const banValue = banHit ? (workerSpamHit ? w.spamhaus : (spamSev >= 4 ? spamTxt : (sfsSev >= 3 ? sfsTxt : blockTxt))) : (banClean ? '未命中' : '--');
  const blacklistValue = blackSev >= 3 ? riskBlackTxt : (blackSev === 0 ? '正常' : '--');
  const intelParts = [];
  if (otxSev >= 3) intelParts.push(`OTX/${otxTxt}`);
  if (greySev >= 3) intelParts.push(`Grey/${greyTxt}`);
  if (dshieldSev >= 3) intelParts.push(`DShield/${dshieldTxt}`);
  if (pulseSev >= 3) intelParts.push(`Pulse/${pulseTxt}`);
  const intelHit = intelParts.length > 0;
  const intelClean = otxSev === 0 && greySev === 0 && dshieldSev === 0 && pulseSev === 0;
  const intelValue = intelHit ? intelParts.slice(0, 2).join('+') : (intelClean ? '未收录' : '--');
  const intelSev = Math.max(otxSev, greySev, dshieldSev, pulseSev);
  const workerPorts = Array.isArray(w.sensitive_ports) && w.sensitive_ports.length ? w.sensitive_ports.join(',') : (Array.isArray(w.vulns) && w.vulns.length ? `${w.vulns.length}漏洞` : '');
  const portValue = portSev >= 3 ? portTxt : (workerPorts || (portSev >= 0 ? portTxt : '--'));
  const portRiskSev = (Array.isArray(w.vulns) && w.vulns.length) ? 4 : (Array.isArray(w.sensitive_ports) && w.sensitive_ports.length ? 3 : portSev);
  const compactName = s => {
    const v = String(s || '').replace(/\b(Network|Services|Limited|Ltd|Inc|LLC|Co\.?|Corporation|Company)\b/gi, '').replace(/\s+/g, ' ').trim();
    return v.length > 12 ? `${v.slice(0, 11)}…` : v;
  };
  const asnLabel = w.cloud && w.cloud !== '否' ? compactName(w.cloud) : (asnType ? compactName(asnType) : '');
  const asnRiskTxt = asnLabel ? `${asnLabel}/${riskIpapiTxt}` : riskIpapiTxt;
  const asnRiskSev = w.cloud && w.cloud !== '否' ? Math.max(apiSev, 2) : apiSev;
  const firstNum = s => {
    const m = String(s || '').match(/(\d+(?:\.\d+)?)/);
    return m ? Number(m[1]) : null;
  };
  const fraudCandidates = [
    { src: 'IPPure', val: firstNum(riskIPPureTxt), sev: ippSev },
    { src: 'Proxy', val: firstNum(riskProxyTxt), sev: proxySev },
    { src: 'NetCoffee', val: firstNum(riskCoffeeTxt), sev: coffeeSev },
    { src: 'ipapi', val: firstNum(riskIpapiTxt), sev: apiSev }
  ].filter(x => typeof x.val === 'number' && Number.isFinite(x.val));
  const fraudBest = fraudCandidates.sort((a, b) => (b.sev - a.sev) || (b.val - a.val))[0];
  const fraudTxt = fraudBest ? `${Math.round(fraudBest.val * 100) / 100}` : '--';
  const fraudSev = fraudBest ? fraudBest.sev : -1;
  const scoreCandidates = [typeof w.score === 'number' ? w.score : null, firstNum(riskProxyTxt), firstNum(riskIPPureTxt), firstNum(riskCoffeeTxt)].filter(v => typeof v === 'number' && Number.isFinite(v));
  if (proxyValue === 'Tor' || torValue === '是') scoreCandidates.push(90);
  if (!['否', '--'].includes(proxyValue)) scoreCandidates.push(60);
  if (banHit) scoreCandidates.push(85);
  if (Array.isArray(w.vulns) && w.vulns.length) scoreCandidates.push(90);
  else if (portRiskSev >= 3) scoreCandidates.push(55);
  if (asnRiskSev >= 3) scoreCandidates.push(60); else if (asnRiskSev >= 2) scoreCandidates.push(35);
  const riskScore = scoreCandidates.length ? Math.round(Math.max(...scoreCandidates)) : null;
  const anonSev = proxyValue === 'Tor' || torValue === '是' ? 4 : (['否', '--'].includes(proxyValue) ? yesNoSev(proxyValue, 3) : Math.max(proxySev, 3));
  const anonValue = torValue === '是' && proxyValue !== 'Tor' ? `Tor+${proxyValue}` : proxyValue;
  const isResidential = flags.residential === true;
  const residentialValue = isResidential ? '是' : (dcValue === '是' || !['--', '否'].includes(proxyValue) ? '否' : '--');
  const riskDimensions = [
    { sev: anonSev, t: `匿名网络: ${anonValue}` },
    { sev: banHit ? 4 : (banValue === '未命中' ? 0 : -1), t: `封禁名单: ${banValue}` },
    { sev: fraudSev, t: `欺诈指数: ${fraudTxt}` },
    { sev: asnRiskSev, t: `ASN风险: ${asnRiskTxt}` },
    { sev: intelSev, t: `情报记录: ${intelValue}` },
    { sev: portRiskSev, t: `端口风险: ${portValue}` }
  ];

  if (proxySuccess) riskDimensions.forEach(g => { if (g.sev > maxSev) maxSev = g.sev; });

  if (proxySuccess && riskGrades[0]) {
    const tgRisk = calcTelegramLoginRisk({
      proxyValue, dcValue, residentialValue, blacklistValue: banHit ? '命中' : banValue,
      ippSev, apiSev, coffeeSev, proxySev, blackSev, intelSev, portRiskSev,
      nativeText, riskProxyTxt
    });
    const workerTgSev = w.tg === '邮箱/收费' ? 4 : (w.tg === '易邮箱' ? 3 : (w.tg === '可能风控' ? 2 : (w.tg === '稍有风险' ? 1 : (w.tg === '大概率正常' ? 0 : -1))));
    if (workerTgSev > tgRisk.sev) riskGrades[0] = { sev: workerTgSev, t: `TG预测: ${w.tg}` };
    else riskGrades[0] = { sev: tgRisk.sev, t: `TG预测: ${tgRisk.text}` };
  }

  function sevIcon(sev) {
    if (sev < 0) return 'questionmark.shield.fill';
    if (sev >= 4) return 'xmark.shield.fill';
    if (sev >= 3) return 'exclamationmark.shield.fill';
    if (sev >= 1) return 'exclamationmark.shield.fill';
    return 'checkmark.shield.fill';
  }
  function sevText(sev) {
    if (sev < 0) return '风险未知';
    if (sev >= 4) return '极高风险';
    if (sev >= 3) return '高风险';
    if (sev >= 2) return '中等风险';
    if (sev >= 1) return '中低风险';
    return '纯净低危';
  }
  // Telegram login prediction uses a dedicated weighted model below.
  function calcTelegramLoginRisk(s) {
    let score = 0;
    const add = (v) => { score += v; };
    const proxyTxt = String(s.riskProxyTxt || '').toLowerCase();
    const coffeeRisk = s.coffeeSev >= 0 ? s.coffeeSev : 0;
    const dc = s.dcValue === '是' || String(s.nativeText || '').includes('商业机房');
    const proxy = (s.proxyValue && !['否', '--'].includes(s.proxyValue)) || proxyTxt.includes('vpn') || proxyTxt.includes('proxy');

    if (s.blacklistValue === '命中' || s.blackSev >= 3) add(38);
    if (s.intelSev >= 4) add(30); else if (s.intelSev >= 3) add(20);
    if (s.portRiskSev >= 4) add(24); else if (s.portRiskSev >= 3) add(12);

    if (proxy && s.proxySev >= 4) add(30);
    else if (proxy && s.proxySev >= 3) add(20);
    else if (proxy) add(14);

    if (dc) add(14);
    if (s.ippSev >= 4) add(30); else if (s.ippSev >= 3) add(22); else if (s.ippSev >= 2) add(12); else if (s.ippSev >= 1) add(6);
    if (s.apiSev >= 4) add(24); else if (s.apiSev >= 3) add(18); else if (s.apiSev >= 2) add(10);
    if (coffeeRisk >= 4) add(22); else if (coffeeRisk >= 3) add(15); else if (coffeeRisk >= 2) add(8); else if (coffeeRisk === 0 && !proxy && !dc) add(-8);

    if (s.residentialValue === '是') add(-15);
    else if (s.residentialValue === '否') add(12);
    if (!proxy && !dc && s.blackSev === 0 && s.ippSev <= 1 && s.apiSev <= 1 && coffeeRisk <= 1) add(-10);

    if (score >= 70) return { sev: 4, text: '邮箱/收费' };
    if (score >= 45) return { sev: 3, text: '易邮箱' };
    if (score >= 25) return { sev: 2, text: '可能风控' };
    if (score >= 10) return { sev: 1, text: '稍有风险' };
    return { sev: 0, text: '大概率正常' };
  }
  function sevColor(sev) {
    if (sev < 0) return C_SUB;
    if (sev >= 4) return C_RED;
    if (sev >= 3) return C_ORANGE;
    if (sev >= 1) return C_YELLOW;
    return C_GREEN;
  }
  // Risk source rows show raw signals; sev remains internal for color and TG prediction.

  const riskScoreSev = riskScore !== null ? (riskScore >= 70 ? 4 : (riskScore >= 45 ? 3 : (riskScore >= 25 ? 2 : (riskScore >= 10 ? 1 : 0)))) : maxSev;
  const summaryIcon = sevIcon(riskScoreSev);
  const summaryTxt = riskScore !== null ? `风险 ${riskScore}` : sevText(maxSev);
  const summaryCol = sevColor(riskScoreSev);
  const INFO_FONT = isLarge ? 12 : 10;
  const INFO_ICON = isLarge ? 16 : 12;
  const SMALL_FONT = isLarge ? 10 : 9.5;
  const SMALL_ICON = isLarge ? 12 : 11;

  function smallInfoRow(iconName, label, value, valueCol = C_MAIN) {
    return {
      type: 'stack', direction: 'row', alignItems: 'center', gap: 5,
      children: [
        { type: 'image', src: `sf-symbol:${iconName}`, color: C_ICON, width: INFO_ICON, height: INFO_ICON },
        { type: 'text', text: label, font: { size: INFO_FONT }, textColor: C_SUB },
        { type: 'spacer' },
        { type: 'text', text: value, font: { size: INFO_FONT, weight: 'bold', family: 'Menlo' }, textColor: valueCol, maxLines: 1, minScale: 0.5, lineBreakMode: 'tail' }
      ]
    };
  }

  function UnlockRow(name, status) {
    const iconName = (status === "Cross" || status === "CN") ? "xmark.circle.fill" : "checkmark.circle.fill";
    const iconCol = getUnlockColor(status);
    const result = getUnlockResult(status);
    return {
      type: 'stack', direction: 'row', alignItems: 'center', gap: 4,
      children: [
        { type: 'image', src: `sf-symbol:${iconName}`, color: iconCol, width: SMALL_ICON, height: SMALL_ICON },
        { type: 'text', text: name, font: { size: SMALL_FONT, weight: 'medium' }, textColor: C_MAIN, flex: 1, maxLines: 1 },
        { type: 'spacer' },
        { type: 'text', text: result, font: { size: SMALL_FONT, weight: 'bold' }, textColor: iconCol, maxLines: 1 }
      ]
    };
  }

  function ScoreRow(grade) {
    const col = sevColor(grade.sev);
    const parts = grade.t.split(': ');
    const src = parts[0] || grade.t;
    const val = parts[1] || '';
    return {
      type: 'stack', direction: 'row', alignItems: 'center', gap: 4,
      children: [
        { type: 'image', src: `sf-symbol:${sevIcon(grade.sev)}`, color: col, width: SMALL_ICON, height: SMALL_ICON },
        { type: 'text', text: src, font: { size: SMALL_FONT, weight: 'medium' }, textColor: C_SUB, flex: 1, maxLines: 1 },
        { type: 'spacer' },
        { type: 'text', text: val, font: { size: SMALL_FONT, weight: 'bold' }, textColor: col, maxLines: 1, minScale: 0.7, lineBreakMode: 'tail' }
      ]
    };
  }

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const WIDGET_PADDING = isLarge ? [8, 12] : [8, 10];
  const HEADER_FONT = 14;
  const HEADER_ICON = 11;
  // Main title uses HEADER_FONT; secondary header text stays compact.
  const HEADER_GAP = 4;
  const TOP_GAP = isLarge ? 2.5 : 5;
  const HEADER_INFO_GAP = 0;
  const INFO_GAP = isLarge ? 2.5 : 2.5;
  const BOTTOM_GAP = isLarge ? 1.8 : 2.5;
  const COL_GAP = 12;

  const leftColumn = {
    type: 'stack', direction: 'column', gap: INFO_GAP, flex: 1,
    children: [
      smallInfoRow("house.fill", "本地IP：", lIp, C_GREEN),
      smallInfoRow("mappin.and.ellipse", "本地位置：", lLoc),
      smallInfoRow("simcard.fill", "本地运营商：", lIsp)
    ]
  };

  const rightColumn = {
    type: 'stack', direction: 'column', gap: INFO_GAP, flex: 1,
    children: [
      smallInfoRow("network", "落地IP：", nIp, proxySuccess ? C_GREEN : C_RED),
      smallInfoRow("map.fill", "落地位置：", nLoc, proxySuccess ? C_MAIN : C_RED),
      smallInfoRow("building.2.fill", "原生属性：", nativeText, proxySuccess ? C_MAIN : C_RED)
    ]
  };

  const unlockLeft = {
    type: 'stack', direction: 'column', gap: BOTTOM_GAP, flex: 1,
    children: [
      UnlockRow("GPT", gptStatus),
      UnlockRow("Claude", claudeStatus),
      UnlockRow("Gemini", geminiStatus),
      UnlockRow("YouTube", youtubeStatus),
      UnlockRow("奈飞", netflixStatus),
      UnlockRow("TikTok", tiktokStatus)
    ]
  };

  const unlockRight = {
    type: 'stack', direction: 'column', gap: BOTTOM_GAP, flex: 1,
    children: riskGrades.map(g => ScoreRow(g))
  };

  const riskDimensionSection = {
    type: 'stack', direction: 'row', gap: COL_GAP,
    children: [
      { type: 'stack', direction: 'column', gap: BOTTOM_GAP, flex: 1, children: riskDimensions.slice(0, 3).map(g => ScoreRow(g)) },
      { type: 'stack', direction: 'column', gap: BOTTOM_GAP, flex: 1, children: riskDimensions.slice(3).map(g => ScoreRow(g)) }
    ]
  };

  const unlockSection = {
    type: 'stack', direction: 'row', gap: COL_GAP,
    children: [unlockLeft, unlockRight]
  };

  const headerInfoSection = {
    type: 'stack', direction: 'column', gap: HEADER_INFO_GAP,
    children: [
      {
        type: 'stack', direction: 'row', gap: COL_GAP, height: isLarge ? 22 : undefined,
        children: [
          {
            type: 'stack', direction: 'row', alignItems: 'center', gap: HEADER_GAP, flex: 1,
            children: [
              { type: 'text', text: '数据中心（DCH）', font: { size: HEADER_FONT, weight: 'heavy' }, textColor: C_TITLE, flex: 1, maxLines: 1, minScale: 0.65 },
              { type: 'image', src: `sf-symbol:${summaryIcon}`, color: summaryCol, width: 12, height: 12 },
              { type: 'text', text: summaryTxt, font: { size: 10, weight: 'bold' }, textColor: summaryCol, maxLines: 1 }
            ]
          },
          {
            type: 'stack', direction: 'row', alignItems: 'center', gap: HEADER_GAP, flex: 1,
            children: [
              ...(!isDirectPolicy ? [
                { type: 'image', src: `sf-symbol:${policyOk ? 'checkmark.circle.fill' : (policyWarn ? 'exclamationmark.circle.fill' : 'questionmark.circle.fill')}`, color: policyOk ? C_GREEN : (policyWarn ? C_ORANGE : C_SUB), width: 10, height: 10 },
                { type: 'text', text: policy, font: { size: 10, weight: 'bold' }, textColor: policyOk ? C_GREEN : (policyWarn ? C_ORANGE : C_SUB), flex: 1, maxLines: 1, minScale: 0.7 },
              ] : [{ type: 'spacer' }]),
              { type: 'spacer' },
              {
                type: 'stack', direction: 'row', alignItems: 'center', gap: 3,
                children: [
                  { type: 'image', src: 'sf-symbol:arrow.clockwise', color: C_SUB, width: HEADER_ICON, height: HEADER_ICON },
                  { type: 'text', text: timeStr, font: { size: 10 }, textColor: C_SUB }
                ]
              }
            ]
          }
        ]
      },
      { type: 'stack', direction: 'row', gap: COL_GAP, children: [leftColumn, rightColumn] }
    ]
  };

  const divider = { type: 'stack', height: 0.5, backgroundColor: { light: 'rgba(0,0,0,0.08)', dark: 'rgba(255,255,255,0.12)' } };

  return {
    type: 'widget',
    padding: WIDGET_PADDING,
    gap: TOP_GAP,
    backgroundColor: BG_COLOR,
    children: isLarge ? [headerInfoSection, riskDimensionSection, divider, unlockSection] : [headerInfoSection, divider, unlockSection]
  };
}