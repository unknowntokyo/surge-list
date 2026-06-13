/**
 * 机场订阅流量监控小组件 (工业级最终封版)
 * 📝 使用说明：
 * 1️⃣ 在Egern脚本当中添加 类型选择 通用
 * 2️⃣ 添加环境变量：
 * - NAME1 = 机场名称
 * - URL1 = https://xxx...
 * - RESET1 = 1-31 的重置日
 */

const COLORS = {
  textPrimary: { light: "#000000", dark: "#FFFFFF" },
  textSecondary: { light: "#555555", dark: "#EBEBF5" },
  textTertiary: { light: "#888888", dark: "#8E8E93" },
  accentBlue: { light: "#007AFF", dark: "#0A84FF" },
  accentGreen: { light: "#34C759", dark: "#30D158" },
  accentOrange: { light: "#FF9500", dark: "#FF9F0A" },
  accentRed: { light: "#FF3B30", dark: "#FF453A" },
  accentPurple: { light: "#D14FE2", dark: "#CA31E1" },
  divider: { light: "#E5E5EA", dark: "#48484A" },
};
const WIDGET_BG_COLOR = { light: "#FFFFFF", dark: "#2C2C2E" };
const CACHE_TIME = 3600000;
const UNITS = ["B", "KB", "MB", "GB", "TB"];

const REGEX_USERINFO = /([-\w]+)=([\d.eE+-]+)/g;

const STRATEGIES = [
  { m: "get", flag: null, ua: { "User-Agent": "clash-verge-rev/2.3.1", Accept: "application/x-yaml,text/plain,*/*" } },
  { m: "get", flag: "clash", ua: { "User-Agent": "mihomo/1.19.3", Accept: "application/x-yaml,text/plain,*/*" } },
  { m: "get", flag: "meta", ua: { "User-Agent": "clash-verge-rev/2.3.1", Accept: "application/x-yaml,text/plain,*/*" } }
];

export default async function (ctx) {
  const slots = [];

  for (let i = 1; i <= 5; i++) {
    const url = (ctx.env[`URL${i}`] || "").trim();
    if (!url) continue;

    const resetDayNum = parseInt(ctx.env[`RESET${i}`], 10);
    slots.push({
      name: (ctx.env[`NAME${i}`] || "").trim() || "机场订阅",
      url,
      resetDay: (resetDayNum >= 1 && resetDayNum <= 31) ? resetDayNum : null,
    });
  }

  if (!slots.length) {
    return {
      type: "widget",
      backgroundColor: WIDGET_BG_COLOR,
      padding: 16,
      children: [
        {
          type: "stack",
          direction: "column",
          gap: 10,
          alignItems: "center",
          children: [
            { type: "image", src: "sf-symbol:wifi.slash", width: 32, height: 32, color: COLORS.accentRed },
            { type: "text", text: "未配置订阅", font: { size: "headline", weight: "semibold" }, textColor: COLORS.textPrimary },
          ],
        },
      ],
    };
  }

  const isLarge = ctx.widgetFamily === "systemLarge" || ctx.widgetFamily === "systemExtraLarge";
  const activeSlots = slots.slice(0, isLarge ? 5 : 2);
  const now = new Date();

  const cardChildren = await concurrentMap(activeSlots, 2, async (s) => {
    try {
      const info = await fetchInfo(ctx, s, now);
      return buildCard(info, ctx);
    } catch (e) {
      return buildCard({ name: s.name, error: true }, ctx);
    }
  });
  
  const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const isCompact = activeSlots.length >= 2;

  return {
    type: "widget",
    backgroundColor: WIDGET_BG_COLOR,
    padding: isCompact ? 8 : 12,
    gap: isCompact ? 5 : 8,
    refreshAfter: new Date(now.getTime() + CACHE_TIME).toISOString(),
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 6,
        children: [
          { type: "image", src: "sf-symbol:network", width: 12, height: 12, color: COLORS.accentBlue },
          { type: "text", text: "机场订阅", font: { size: "subheadline", weight: "bold" }, textColor: COLORS.textPrimary },
          { type: "spacer" },
          { type: "image", src: "sf-symbol:arrow.clockwise", width: 12, height: 12, color: COLORS.textTertiary },
          { type: "text", text: timeStr, font: { size: "caption2", weight: "medium" }, textColor: COLORS.textTertiary },
        ],
      },
      {
        type: "stack",
        direction: "column",
        gap: 6,
        children: cardChildren, 
      },
    ],
  };
}

async function fetchInfo(ctx, slot, now) {
  const cacheKey = `sub_cache_${slot.url}`;
  let cacheData = null;
  const nowTime = now.getTime(); 

  try {
    const parsed = ctx.storage.getJSON(cacheKey);
    if (parsed?.data) {

      cacheData = parsed.data; 
      if (nowTime - parsed.time < CACHE_TIME) {
        return { ...cacheData, name: slot.name, remainDays: slot.resetDay ? getRemainingDays(slot.resetDay, now) : null };
      }
    }
  } catch (e) {}

  for (const strategy of STRATEGIES) {
    try {
      const targetUrl = buildUrl(slot.url, strategy.flag);
      const resp = await ctx.http[strategy.m](targetUrl, { headers: strategy.ua, timeout: 1500 });
      const info = parseUserInfo(resp.headers.get("subscription-userinfo") || "");

      if (info) {
        const used = (info.upload || 0) + (info.download || 0);
        const totalBytes = info.total || 0;
        const result = {
          error: null,
          used,
          totalBytes,
          percent: totalBytes > 0 ? (used / totalBytes) * 100 : 0,
          expire: info.expire || null, 
        };

        try { ctx.storage.setJSON(cacheKey, { time: nowTime, data: result }); } catch (e) {}
        return { ...result, name: slot.name, remainDays: slot.resetDay ? getRemainingDays(slot.resetDay, now) : null };
      }
    } catch (_) {}
  }

  if (cacheData) {
    return { ...cacheData, name: slot.name, remainDays: slot.resetDay ? getRemainingDays(slot.resetDay, now) : null, isFallback: true };
  }
  return { name: slot.name, error: true };
}

function buildCard(result, ctx) {
  const { name, error, used, totalBytes, percent, expire, remainDays, isFallback } = result;

  let statusColor = COLORS.accentGreen;
  if (percent >= 95) statusColor = COLORS.accentRed;
  else if (percent >= 80) statusColor = COLORS.accentOrange;
  else if (percent >= 50) statusColor = COLORS.accentPurple;

  let dotColor = (error || isFallback) ? COLORS.accentRed : statusColor; 

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
        { type: "image", src: "sf-symbol:exclamationmark.circle.fill", width: 12, height: 12, color: COLORS.accentRed },
        { type: "text", text: name, font: { size: "caption2", weight: "semibold" }, textColor: COLORS.accentRed, flex: 1 },
        { type: "text", text: "获取失败", font: { size: "caption2", weight: "semibold" }, textColor: COLORS.accentRed },
      ],
    };
  }

  const p = Math.min(Math.max(percent, 0), 100);
  let expireText = "永久有效";
  
  if (remainDays != null) {
    expireText = `${remainDays}天后重置`;
  } else if (expire > 0) {
    const d = new Date(expire < 1e12 ? expire * 1000 : expire);
    expireText = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  return {
    type: "stack",
    direction: "column",
    gap: 5,
    padding: [8, 10],
    backgroundColor: { light: "#FFFFFF", dark: "#2B2B2D" },
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.divider,
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 5,
        children: [
          { type: "image", src: "sf-symbol:circle.fill", width: 6, height: 6, color: dotColor }, 
          { type: "text", text: name, font: { size: "caption2", weight: "semibold" }, textColor: isFallback ? COLORS.accentRed : COLORS.textPrimary, flex: 1 },
          { type: "text", text: `${Math.round(p)}%`, font: { size: "caption2", weight: "bold" }, textColor: statusColor },
        ],
      },
      {
        type: "stack",
        direction: "row",
        height: 5,
        borderRadius: 3,
        children: [
          { type: "stack", flex: Math.max(p, 0.1), height: 5, backgroundColor: statusColor, borderRadius: 3 },
          { type: "stack", flex: Math.max(100 - p, 0.1), height: 5, backgroundColor: { light: "#E8E8EA", dark: "#48484A" }, borderRadius: 3 },
        ],
      },
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        children: [
          {
            type: "stack",
            direction: "row",
            flex: 1, 
            children: [
              { type: "text", text: `${formatBytes(used)}/${formatBytes(totalBytes)}`, font: { size: "caption2", weight: "medium" }, textColor: COLORS.textSecondary },
              { type: "spacer" }, 
            ],
          },

          { 
            type: "text", 
            text: ctx.widgetFamily === "systemSmall" ? "" : expireText, 
            font: { size: "caption2", weight: "medium" }, 
            textColor: COLORS.textTertiary 
          },
          {
            type: "stack",
            direction: "row",
            flex: 1,
            children: [
              { type: "spacer" }, 
              { type: "text", text: `剩${formatBytes(totalBytes - used)}`, font: { size: "caption2", weight: "semibold" }, textColor: COLORS.accentGreen },
            ],
          },
        ],
      },
    ],
  };
}

function buildUrl(base, flag) {
  if (!flag) return base;
  
  const hashIndex = base.indexOf('#');
  const urlPart = hashIndex !== -1 ? base.substring(0, hashIndex) : base;
  const hashPart = hashIndex !== -1 ? base.substring(hashIndex) : '';
  
  const qIndex = urlPart.indexOf('?');
  if (qIndex === -1) return `${urlPart}?flag=${flag}${hashPart}`;
  
  const path = urlPart.substring(0, qIndex);
  const query = urlPart.substring(qIndex + 1);

  const params = query.split('&').filter(p => !p.startsWith('flag=') && p !== '');
  params.push(`flag=${flag}`);
  
  return `${path}?${params.join('&')}${hashPart}`;
}

function parseUserInfo(header) {
  if (!header) return null;
  let info = null; 
  for (const match of header.matchAll(REGEX_USERINFO)) {
    const val = Number(match[2]);
    if (Number.isFinite(val)) {
      if (!info) info = {};
      info[match[1]] = val;
    }
  }
  return info;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0B";
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < 4) {
    value /= 1024;
    i++;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)}${UNITS[i]}`; 
}

function getRemainingDays(resetDay, now) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();

  let nextMonth = month;
  const maxDayThisMonth = new Date(year, month + 1, 0).getDate();
  let safeDay = Math.min(resetDay, maxDayThisMonth);

  if (date > safeDay) {
    nextMonth = month + 1;
    const maxDayNextMonth = new Date(year, nextMonth + 1, 0).getDate();
    safeDay = Math.min(resetDay, maxDayNextMonth);
  }

  const nowUTC = Date.UTC(year, month, date);
  const nextUTC = Date.UTC(year, nextMonth, safeDay);
  
  return Math.max(0, Math.round((nextUTC - nowUTC) / 86400000));
}

async function concurrentMap(items, maxConcurrent, fn) {
  const results = new Array(items.length);
  let index = 0;
  const worker = async () => {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await fn(items[currentIndex]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(maxConcurrent, items.length) }, worker));
  return results;
}