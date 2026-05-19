/**
 * 机场订阅流量监控小组件 (顶级重构·极致高效版)
 */
const CACHE_TIME = 3600000, MAX_SLOTS = 5;
const COLORS = {
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

const BG_GRADIENT = {
  type: "linear",
  colors: [{ light: "#FFFFFF", dark: "#2C2C2E" }, { light: "#FFFFFF", dark: "#2C2C2E" }],
  stops: [0, 1], startPoint: { x: 0, y: 0 }, endPoint: { x: 0, y: 1 }
};

const UNITS = ["B", "KB", "MB", "GB", "TB"];

export default async function (ctx) {
  const SYSTEM_NOW = Date.now(), now = new Date(SYSTEM_NOW);
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const refreshTime = new Date(SYSTEM_NOW + CACHE_TIME).toISOString();

  // 1. 收集 slots
  let slots = [];
  for (let i = 1; i <= MAX_SLOTS; i++) {
    const url = (ctx.env[`URL${i}`] || "").trim();
    if (!url) continue;
    const rawReset = parseInt(ctx.env[`RESET${i}`], 10);
    slots.push({
      name: (ctx.env[`NAME${i}`] || "").trim() || `订阅 ${i}`,
      url,
      resetDay: rawReset >= 1 && rawReset <= 31 ? rawReset : null
    });
  }

  if (!slots.length) return {
    type: "widget", backgroundGradient: BG_GRADIENT, padding: 16, refreshAfter: refreshTime,
    children: [{
      type: "stack", direction: "column", gap: 10, alignItems: "center",
      children: [
        { type: "image", src: "sf-symbol:wifi.slash", width: 32, height: 32, color: COLORS.accentRed },
        { type: "text", text: "未配置订阅链接", font: { size: "headline", weight: "semibold" }, textColor: COLORS.textPrimary }
      ]
    }]
  };

  // 🔥 优化点 2：先根据组件大小截断，再请求！防小组件盲目并发 5 次网络
  const maxDisplay = ctx.widgetFamily === "systemLarge" ? 5 : 2;
  slots = slots.slice(0, maxDisplay); 

  const results = await Promise.all(slots.map(s => fetchInfo(ctx, s, SYSTEM_NOW)));
  const isCompact = Math.min(slots.length, maxDisplay) >= 2;

  return {
    type: "widget", backgroundGradient: BG_GRADIENT, padding: isCompact ? 8 : 12, gap: isCompact ? 5 : 8, refreshAfter: refreshTime,
    children: [
      {
        type: "stack", direction: "row", alignItems: "center", gap: 6,
        children: [
          { type: "image", src: "sf-symbol:network", width: 12, height: 12, color: COLORS.accentBlue },
          { type: "text", text: "机场订阅监控", font: { size: "subheadline", weight: "bold" }, textColor: COLORS.textPrimary },
          { type: "spacer" },
          { type: "image", src: "sf-symbol:arrow.clockwise", width: 12, height: 12, color: COLORS.textTertiary },
          { type: "text", text: timeStr, font: { size: "caption2", weight: "medium" }, textColor: COLORS.textTertiary }
        ]
      },
      {
        type: "stack", direction: "column", gap: 6,
        children: results.map(r => buildCard(r, SYSTEM_NOW, ctx)) // 移除无意义的 slice
      }
    ]
  };
}

async function fetchInfo(ctx, slot, currentTimestamp) {
  const cacheKey = `sub_cache_${slot.url}`;
  const cache = await ctx.storage.get(cacheKey).catch(() => null);
  let cacheData = null;

  if (cache) {
    try {
      const parsed = JSON.parse(cache);
      if (currentTimestamp - parsed.time < CACHE_TIME) {
        return { ...parsed.data, name: slot.name, remainDays: slot.resetDay ? getRemainingDays(slot.resetDay, currentTimestamp) : null };
      }
      cacheData = parsed.data;
    } catch (_) {}
  }

  try {
    const resp = await ctx.http.get(slot.url, { headers: { "User-Agent": "clash-verge-rev/2.3.1" }, timeout: 4 });
    const raw = resp.headers.get("subscription-userinfo") || resp.headers.get("Subscription-UserInfo") || "";
    
    // 🔥 优化点 1：抛弃正则，采用极致高效的低级字符串切分，零堆内存污染
    const obj = { upload: 0, download: 0, total: 0, expire: 0 };
    let hasTotal = false;
    
    const pairs = raw.split(/[;&]/);
    for (let i = 0; i < pairs.length; i++) {
      const eqIdx = pairs[i].indexOf('=');
      if (eqIdx === -1) continue;
      const key = pairs[i].substring(0, eqIdx).trim().toLowerCase();
      if (key in obj) {
        obj[key] = parseFloat(pairs[i].substring(eqIdx + 1));
        if (key === 'total') hasTotal = true;
      }
    }

    if (hasTotal) {
      const used = obj.upload + obj.download;
      const result = { error: null, used, totalBytes: obj.total, percent: obj.total > 0 ? (used / obj.total) * 100 : 0, expire: obj.expire || null, remainDays: slot.resetDay ? getRemainingDays(slot.resetDay, currentTimestamp) : null };
      await ctx.storage.set(cacheKey, JSON.stringify({ time: currentTimestamp, data: result })).catch(() => null);
      return { ...result, name: slot.name };
    }
  } catch (_) {}

  if (cacheData) return { ...cacheData, name: slot.name };
  return { name: slot.name, error: true };
}

function buildCard(result, currentTimestamp, ctx) {
  const { name, error, used, totalBytes, percent, expire, remainDays } = result;

  if (error) return {
    type: "stack", direction: "row", alignItems: "center", gap: 6, padding: [8, 10], backgroundColor: { light: "#FFF5F5", dark: "#3B1F1F" }, borderRadius: 8,
    children: [
      { type: "image", src: "sf-symbol:exclamationmark.circle.fill", width: 12, height: 12, color: COLORS.accentRed },
      { type: "text", text: name, font: { size: "caption2", weight: "semibold" }, textColor: COLORS.textPrimary, flex: 1 },
      { type: "text", text: "连接失败", font: { size: "caption2", weight: "semibold" }, textColor: COLORS.accentRed }
    ]
  };

  const progressPercent = Math.min(Math.max(percent, 0), 100);
  let statusColor = COLORS.accentGreen;
  if (progressPercent >= 95) statusColor = COLORS.accentRed;
  else if (progressPercent >= 80) statusColor = COLORS.accentOrange;
  else if (progressPercent >= 50) statusColor = COLORS.accentPurple;

  let expireText = "永久有效";
  if (remainDays != null) expireText = `重置剩 ${remainDays} 天`;
  else if (expire > 0) {
    const d = new Date(expire < 1e12 ? expire * 1000 : expire);
    expireText = `${d.getMonth() + 1}-${d.getDate()} 过期`;
  }

  return {
    type: "stack", direction: "column", gap: 5, padding: [8, 10], backgroundColor: { light: "#FFFFFF", dark: "#2B2B2D" }, borderRadius: 8, borderWidth: 1, borderColor: COLORS.divider,
    children: [
      {
        type: "stack", direction: "row", alignItems: "center", gap: 5,
        children: [
          { type: "image", src: "sf-symbol:circle.fill", width: 6, height: 6, color: statusColor },
          { type: "text", text: name, font: { size: "caption2", weight: "semibold" }, textColor: COLORS.textPrimary, flex: 1 },
          { type: "text", text: `${Math.round(progressPercent)}%`, font: { size: "caption2", weight: "bold" }, textColor: statusColor }
        ]
      },
      {
        type: "stack", direction: "row", height: 5, borderRadius: 3,
        children: [
          { type: "stack", flex: Math.max(progressPercent, 1), height: 5, backgroundColor: statusColor, borderRadius: 3 },
          { type: "stack", flex: Math.max(100 - progressPercent, 1), height: 5, backgroundColor: { light: "#E8E8EA", dark: "#48484A" }, borderRadius: 3 }
        ]
      },
      {
        type: "stack", direction: "row", alignItems: "center", gap: 5,
        children: [
          { type: "text", text: `${formatBytes(used)} / ${formatBytes(totalBytes)}`, font: { size: "caption2", weight: "medium" }, textColor: COLORS.textSecondary },
          { type: "spacer" },
          ...(ctx.widgetFamily === "systemSmall" ? [] : [{ type: "text", text: expireText, font: { size: "caption2", weight: "medium" }, textColor: COLORS.textTertiary }, { type: "spacer" }]),
          { type: "text", text: `剩${formatBytes(Math.max(0, totalBytes - used))}`, font: { size: "caption2", weight: "semibold" }, textColor: COLORS.accentGreen }
        ]
      }
    ]
  };
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0B";
  let i = 0;
  while (bytes >= 1024 && i < UNITS.length - 1) { bytes /= 1024; i++; }
  // 🔥 优化点 4：消除小数末尾无意义的 .0
  return `${bytes >= 10 || bytes % 1 === 0 ? Math.round(bytes) : bytes.toFixed(1)}${UNITS[i]}`;
}

function getRemainingDays(resetDay, currentTimestamp) {
  // 🔥 优化点 3：更加简单安全的重置日剩余天数算法
  const now = new Date(currentTimestamp);
  const today = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();

  // 获取本月最大天数
  const maxThisMonth = new Date(year, month + 1, 0).getDate();
  const targetDayInThisMonth = Math.min(resetDay, maxThisMonth);

  let targetDate;
  if (today < targetDayInThisMonth) {
    targetDate = new Date(year, month, targetDayInThisMonth);
  } else {
    // 跨到下个月
    const maxNextMonth = new Date(year, month + 2, 0).getDate();
    targetDate = new Date(year, month + 1, Math.min(resetDay, maxNextMonth));
  }

  now.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((targetDate - now) / 86400000));
}