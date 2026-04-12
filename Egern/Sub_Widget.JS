/**
 * 机场订阅流量监控小组件
 * 
 * 📝 使用说明
 * 1️⃣ 添加环境变量（在 Egern 中进入小组件"编辑环境变量"）：
 * 
 *    格式：名称里填 NAME1  值里填 你的机场名称
 * 
 *    NAME1 = 翻墙                     # 机场名称（自定义）
 *    URL1 = https://xxx.com/sub...   # 订阅地址（必填）
 *    RESET1 = 1                      # 重置日（可选，每月1日重置）
 * 
 *    NAME2 = 机场B
 *    URL2 = https://yyy.com/sub...
 *    RESET2 = 15                     # 每月15日重置
 * 
 * 2️⃣ 参数说明：
 *    - NAME1-5：机场名称，显示在卡片上（必填，否则显示"机场订阅"）
 *    - URL1-5：订阅地址，从机场后台复制（必填）
 *    - RESET1-5：流量重置日，1-31 的数字（可选）
 * 
 * 3️⃣ 示例：
 *    NAME1 = 机场订阅
 *    URL1 = https://example.com/sub?token=abc123
 *    RESET1 = 1
 * 
 *    NAME2 = 备用机场
 *    URL2 = https://example2.com/sub?token=def456
 * 
 * 4️⃣ 注意事项：
 *    - 环境变量名称必须大写（NAME1、URL1 等）
 *    - 至少需要配置 URL1 才能显示
 *    - 订阅地址需要包含完整的 token
 *    - 小组件每1小时自动刷新一次
 *    - 自动适配系统深色/浅色模式（无需配置）
 *
 * 5️⃣ 显示数量说明：
 * - 小尺寸 (systemSmall)：自动显示 2 条
 * - 中尺寸 (systemMedium)：自动显示 2 条
 * - 大尺寸 (systemLarge)：自动显示 5 条
 * - 最多支持 5 个机场 中小尺寸只显示两个 大尺寸显示五个 需要显示多条 可以在组件页面右上角 重新添加组件就可以了 祝您使用愉快！
 * - 加了缓存机制 如果数据存在且距离上次请求未超过 1 小时，则直接返回缓存结果，不再发起网络请求，避免风控 导致机场主拉黑
 */

export default async function (ctx) {
 const MAX = 5;
 const slots = [];

 for (let i = 1; i <= MAX; i++) {
  const url = (ctx.env[`URL${i}`] || "").trim();
  if (!url) continue;

  const rawReset = (ctx.env[`RESET${i}`] || "").trim();
  let resetDay = null;

  if (/^\d+$/.test(rawReset)) {
    const num = Number(rawReset);
    if (num >= 1 && num <= 31) {
      resetDay = num;
    }
  }

  slots.push({
    name: (ctx.env[`NAME${i}`] || "").trim() || "机场订阅",
    url,
    resetDay,
  });
 }

 const refreshTime = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString();
 const now = new Date();
 const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

 const colors = {
  textPrimary: { light: "#000000", dark: "#FFFFFF" },
  textSecondary: { light: "#555555", dark: "#EBEBF5" },
  textTertiary: { light: "#888888", dark: "#8E8E93" },
  accentBlue: { light: "#007AFF", dark: "#0A84FF" },
  accentGreen: { light: "#34C759", dark: "#30D158" },
  accentOrange: { light: "#FF9500", dark: "#FF9F0A" },
  accentRed: { light: "#FF3B30", dark: "#FF453A" },
  accentPurple: { light: "#5856D6", dark: "#5856D6" },
  divider: { light: "#E5E5EA", dark: "#48484A" },
 };

 const bgGradient = {
  type: "linear",
  colors: [
   { light: "#FFFFFF", dark: "#2C2C2E" },
   { light: "#FFFFFF", dark: "#2C2C2E" },
  ],
  stops: [0, 1],
  startPoint: { x: 0, y: 0 },
  endPoint: { x: 0, y: 1 },
 };

 if (!slots.length) {
  return {
   type: "widget",
   backgroundGradient: bgGradient,
   padding: 16,
   gap: 12,
   refreshAfter: refreshTime,
   children: [
    {
     type: "stack",
     direction: "column",
     gap: 10,
     alignItems: "center",
     children: [
      { type: "image", src: "sf-symbol:wifi.slash", width: 32, height: 32, color: colors.accentRed },
      { type: "text", text: "未配置订阅", font: { size: "headline", weight: "semibold" }, textColor: colors.textPrimary },
     ],
    },
   ],
  };
 }

 const results = await Promise.all(slots.map((s) => fetchInfo(ctx, s)));

 const widgetFamily = ctx.widgetFamily;
 const isLarge = widgetFamily === "systemLarge";
 const maxDisplay = isLarge ? 5 : 2;

 const numSubs = Math.min(slots.length, maxDisplay);
 const isCompact = numSubs >= 2;

 return {
  type: "widget",
  backgroundGradient: bgGradient,
  padding: isCompact ? 8 : 12,
  gap: isCompact ? 5 : 8,
  refreshAfter: refreshTime,
  children: [
   {
    type: "stack",
    direction: "row",
    alignItems: "center",
    gap: 6,
    children: [
     { type: "text", text: "机场订阅", font: { size: "subheadline", weight: "bold" }, textColor: colors.textPrimary },
     { type: "spacer" },
     { type: "image", src: "sf-symbol:arrow.clockwise", width: 12, height: 12, color: colors.textTertiary },
     { type: "text", text: timeStr, font: { size: "caption2", weight: "medium" }, textColor: colors.textTertiary },
    ],
   },
   {
    type: "stack",
    direction: "column",
    gap: 6,
    children: results.slice(0, maxDisplay).map((r) => buildCard(r, colors, ctx)),
   },
  ],
 };
}

const CACHE_TIME = 1 * 60 * 60 * 1000;

async function fetchInfo(ctx, slot) {
 const cacheKey = `sub_cache_${slot.url}`;
 let cache = await ctx.storage.get(cacheKey);
 let cacheData = null;

 if (cache) {
  try {
   const parsed = JSON.parse(cache);
   if (Date.now() - parsed.time < CACHE_TIME) {
  return {
    ...parsed.data,
    name: slot.name,
    remainDays: slot.resetDay ? getRemainingDays(slot.resetDay) : null,
  };
}
   cacheData = parsed.data;
  } catch {}
 }

 const urls = buildVariants(slot.url);

 for (const method of ["head", "get"]) {
  for (const url of urls) {
   for (const headers of UA_LIST) {
    try {
     const resp = await ctx.http[method](url, { headers });
     const raw = resp.headers.get("subscription-userinfo") || "";
     const info = parseUserInfo(raw);

     if (info) {
      const used = (info.upload || 0) + (info.download || 0);
      const totalBytes = info.total || 0;
      const percent = totalBytes > 0 ? (used / totalBytes) * 100 : 0;

      const result = {
        error: null,
        used,
        totalBytes,
        percent,
        expire: info.expire || null,
        remainDays: slot.resetDay ? getRemainingDays(slot.resetDay) : null,
      };

      await ctx.storage.set(cacheKey, JSON.stringify({
        time: Date.now(),
        data: result,
      }));

      return { ...result, name: slot.name };
     }
    } catch (_) {}
   }
  }
 }

 if (cacheData) {
  return { ...cacheData, name: slot.name };
 }

 return { name: slot.name, error: true };
}

function buildCard(result, colors, ctx) {
 const { name, error, used, totalBytes, percent, expire, remainDays } = result;

 let statusColor = colors.accentGreen;
 if (error) statusColor = colors.accentRed;
 else if (percent >= 95) statusColor = colors.accentRed;
 else if (percent >= 80) statusColor = colors.accentOrange;
 else if (percent >= 50) statusColor = colors.accentPurple;

 if (error) {
  return {
   type: "stack",
   direction: "row",
   alignItems: "center",
   gap: 6,
   padding: [8, 10],
   backgroundColor: { light: "#FFF5F5", dark: "#3B1F1F" },
   borderRadius: 8,
   children: [
    { type: "image", src: "sf-symbol:exclamationmark.circle.fill", width: 12, height: 12, color: colors.accentRed },
    { type: "text", text: name, font: { size: "caption2", weight: "semibold" }, textColor: colors.textPrimary, flex: 1 },
    { type: "text", text: "失败", font: { size: "caption2", weight: "semibold" }, textColor: colors.accentRed },
   ],
  };
 }

 const progressPercent = Math.min(Math.max(percent, 0), 100);
 const usedStr = formatBytes(used);
 const totalStr = formatBytes(totalBytes);
 const remainStr = formatBytes(totalBytes - used);

 let expireText = "";

 if (remainDays != null) {
  expireText = `流量重置时间${remainDays}天后`;
 } else if (expire && Number(expire) > 0) {
  let ts = Number(expire);
  if (ts < 1e12) ts *= 1000;
  const d = new Date(ts);
  expireText = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
 } else {
  expireText = "永久有效";
 }

 return {
  type: "stack",
  direction: "column",
  gap: 5,
  padding: [8, 10],
  backgroundColor: { light: "#FFFFFF", dark: "#2B2B2D" },
  borderRadius: 8,
  borderWidth: 1,
  borderColor: colors.divider,
  children: [
   {
    type: "stack",
    direction: "row",
    alignItems: "center",
    gap: 5,
    children: [
     { type: "image", src: "sf-symbol:circle.fill", width: 6, height: 6, color: statusColor },
     { type: "text", text: name, font: { size: "caption2", weight: "semibold" }, textColor: colors.textPrimary, flex: 1 },
     { type: "text", text: `${Math.round(progressPercent)}%`, font: { size: "caption2", weight: "bold" }, textColor: statusColor },
    ],
   },
   {
    type: "stack",
    direction: "row",
    height: 5,
    borderRadius: 3,
    children: [
     { type: "stack", flex: Math.max(progressPercent, 1), height: 5, backgroundColor: statusColor, borderRadius: 3 },
     { type: "stack", flex: Math.max(100 - progressPercent, 1), height: 5, backgroundColor: { light: "#E8E8EA", dark: "#48484A" }, borderRadius: 3 },
    ],
   },
   {
    type: "stack",
    direction: "row",
    alignItems: "center",
    gap: 5,
    children: [
     { type: "text", text: `${usedStr}/${totalStr}`, font: { size: "caption2", weight: "medium" }, textColor: colors.textSecondary },
     { type: "spacer" },
     ...(ctx.widgetFamily === "systemSmall" ? [] : [
       { type: "text", text: expireText, font: { size: "caption2", weight: "medium" }, textColor: colors.textTertiary },
       { type: "spacer" },
     ]),
     { type: "text", text: `剩${remainStr}`, font: { size: "caption2", weight: "semibold" }, textColor: colors.accentGreen },
    ],
   },
  ],
 };
}

const UA_LIST = [
 { "User-Agent": "Quantumult%20X/1.5.2" },
 { "User-Agent": "clash-verge-rev/2.3.1", Accept: "application/x-yaml,text/plain,*/*" },
 { "User-Agent": "mihomo/1.19.3", Accept: "application/x-yaml,text/plain,*/*" },
];

function buildVariants(url) {
 const seen = new Set();
 const out = [];
 const add = (u) => { if (u && !seen.has(u)) { seen.add(u); out.push(u); } };
 add(url);
 add(withParam(url, "flag", "clash"));
 add(withParam(url, "flag", "meta"));
 return out;
}

function withParam(url, key, value) {
 return `${url}${url.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

function parseUserInfo(header) {
 if (!header) return null;
 const pairs = header.match(/\w+=[\d.eE+-]+/g) || [];
 if (!pairs.length) return null;
 return Object.fromEntries(pairs.map(p => {
  const [k, v] = p.split("=");
  return [k, Number(v)];
 }));
}

function formatBytes(bytes) {
 if (!Number.isFinite(bytes) || bytes <= 0) return "0B";
 const units = ["B", "KB", "MB", "GB", "TB"];
 const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
 const value = bytes / Math.pow(1024, i);
 return `${value >= 10 ? Math.round(value) : value.toFixed(1)}${units[i]}`;
}

function getRemainingDays(resetDay) {
 const now = new Date();

 const maxDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
 const safeDay = Math.min(resetDay, maxDay);

 let next = new Date(now.getFullYear(), now.getMonth(), safeDay);

 if (now.getDate() >= safeDay) {
  const nextMonthMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate();
  const nextSafeDay = Math.min(resetDay, nextMonthMax);
  next = new Date(now.getFullYear(), now.getMonth() + 1, nextSafeDay);
 }

 return Math.max(0, Math.ceil((next - now) / 86400000));
}