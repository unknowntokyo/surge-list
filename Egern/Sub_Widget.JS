/**
 * 机场订阅流量监控小组件 (Modern iOS 物理极限封版)
 * 极致压榨：0 内存碎片、0 废弃逻辑、0 动态开销
 */

const COLORS = {
  textPrimary: { light: "#000000", dark: "#FFFFFF" },
  textSecondary: { light: "#555555", dark: "#EBEBF5" },
  textTertiary: { light: "#888888", dark: "#8E8E93" },
  accentGreen: { light: "#34C759", dark: "#30D158" },
  accentOrange: { light: "#FF9500", dark: "#FF9F0A" },
  accentRed: { light: "#FF3B30", dark: "#FF453A" },
  accentPurple: { light: "#D14FE2", dark: "#CA31E1" },
  divider: { light: "#E5E5EA", dark: "#48484A" },
  // 💡 优化 2：抽离渲染层静态对象，彻底消灭循环内 GC 碎片
  errorBg: { light: "#FFF5F5", dark: "#3B1F1F" },
  progressBg: { light: "#E8E8EA", dark: "#48484A" },
};
const WIDGET_BG_COLOR = { light: "#FFFFFF", dark: "#2C2C2E" };
const REFRESH_INTERVAL_MS = 3600000;
const MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const UNITS = ["B", "KB", "MB", "GB", "TB"];

// 💡 优化 3：带抗干扰容错的正则提升至全局，仅编译一次
const REGEX_USERINFO = /([-\w]+)\s*=\s*([\d.eE+-]+)/g;

// 💡 优化 1：剃掉所有无用的 m: "get" 动态分发标记
const STRATEGIES = [
  { flag: null, ua: { "User-Agent": "clash-verge-rev/2.3.1", Accept: "application/x-yaml,text/plain,*/*" } },
  { flag: "clash", ua: { "User-Agent": "mihomo/1.19.3", Accept: "application/x-yaml,text/plain,*/*" } },
  { flag: "meta", ua: { "User-Agent": "clash-verge-rev/2.3.1", Accept: "application/x-yaml,text/plain,*/*" } }
];

export default async function (ctx) {
  const slots = [];

  for (let i = 1; i <= 5; i++) {
    const url = (ctx.env[`URL${i}`] || "").trim();
    if (!url) continue;

    const resetStr = ctx.env[`RESET${i}`];
    const resetDayNum = resetStr ? Number(resetStr) : null;
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

  // 💡 优化 4：优雅处理大尺寸判断
  const activeSlots = slots.slice(0, ctx.widgetFamily.includes("Large") ? 5 : 2);
  const now = new Date();

  const cardChildren = await concurrentMap(activeSlots, 2, async (s) => buildCard(await fetchInfo(ctx, s, now), ctx));
  
  const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const isCompact = activeSlots.length >= 2;

  return {
    type: "widget",
    backgroundColor: WIDGET_BG_COLOR,
    padding: isCompact ? 8 : 12,
    gap: isCompact ? 5 : 8,
    refreshAfter: new Date(now.getTime() + REFRESH_INTERVAL_MS).toISOString(),
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 6,
        children: [
          { type: "image", src: "sf-symbol:gauge.with.dots.needle.67percent", width: 16, height: 16, color: COLORS.accentGreen },
          { type: "text", text: "SubInfo", font: { size: "subheadline", weight: "bold" }, textColor: COLORS.textPrimary },
          { type: "spacer" },
          { type: "image", src: "sf-symbol:arrow.clockwise", width: 12, height: 12, color: COLORS.textTertiary },
          { type: "text", text: timeStr, font: { size: "caption2", weight: "medium" }, textColor: COLORS.textTertiary },
        ],
      },
      { type: "stack", direction: "column", gap: 6, children: cardChildren },
    ],
  };
}

async function fetchInfo(ctx, slot, now) {
  const cacheKey = `sub_cache_${slot.url}`;
  let cacheData = null;
  let lastErrorMsg = "Unknown";

  try {
    const parsed = ctx.storage.getJSON(cacheKey);
    if (parsed?.data) {
      if (now.getTime() - parsed.time < MAX_STALE_MS) {
        cacheData = parsed.data; 
      } else {
        try { ctx.storage.remove(cacheKey); } catch (e) {}
      }
    }
  } catch (e) {}

  for (const strategy of STRATEGIES) {
    try {
      // 💡 剥离动态方法，直指本质的 GET 请求
      const resp = await ctx.http.get(buildUrl(slot.url, strategy.flag), { headers: strategy.ua, timeout: 1500 });

      if (resp.status && (resp.status < 200 || resp.status >= 300)) {
        lastErrorMsg = `HTTP ${resp.status}`;
        continue;
      }

      const info = parseUserInfo(resp.headers.get("subscription-userinfo") || "");

      if (info) {
        const used = (info.upload || 0) + (info.download || 0);
        const totalBytes = info.total || 0;
        const result = {
          used,
          totalBytes,
          percent: totalBytes > 0 ? (used / totalBytes) * 100 : 0,
          expire: info.expire || null, 
        };

        try { ctx.storage.setJSON(cacheKey, { time: now.getTime(), data: result }); } catch (e) {}
        return { ...result, name: slot.name, remainDays: slot.resetDay ? getRemainingDays(slot.resetDay, now) : null };
      } else {
        lastErrorMsg = "No Data";
      }
    } catch (err) {
      const msg = String(err?.message ?? err ?? "").toLowerCase();
      if (msg.includes("timeout") || msg.includes("timed out")) lastErrorMsg = "Timeout";
      else if (msg.includes("dns") || msg.includes("host")) lastErrorMsg = "DNS Error";
      else lastErrorMsg = "Network";
    }
  }

  if (cacheData) {
    return { ...cacheData, name: slot.name, remainDays: slot.resetDay ? getRemainingDays(slot.resetDay, now) : null, isFallback: true };
  }

  return { name: slot.name, error: true, errorMsg: lastErrorMsg };
}

function buildCard(result, ctx) {
  const { name, error, errorMsg, used, totalBytes, percent, expire, remainDays, isFallback } = result;

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
      backgroundColor: COLORS.errorBg, // 💡 复用常量
      borderRadius: 8,
      children: [
        { type: "image", src: "sf-symbol:exclamationmark.circle.fill", width: 12, height: 12, color: COLORS.accentRed },
        { type: "text", text: name, font: { size: "caption2", weight: "semibold" }, textColor: COLORS.accentRed, flex: 1 },
        { type: "text", text: `失败 | ${errorMsg || '异常'}`, font: { size: "caption2", weight: "bold" }, textColor: COLORS.accentRed },
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
          { type: "text", text: name, font: { size: "caption2", weight: "semibold" }, textColor: COLORS.textPrimary, flex: 1 },
          { type: "text", text: `${Math.round(p)}%`, font: { size: "caption2", weight: "bold" }, textColor: statusColor },
        ],
      },
      {
        type: "stack",
        direction: "row",
        height: 5,
        borderRadius: 3,
        children: [
          { type: "stack", flex: Math.max(p, 0.01), height: 5, backgroundColor: statusColor, borderRadius: 3 },
          { type: "stack", flex: Math.max(100 - p, 0.01), height: 5, backgroundColor: COLORS.progressBg, borderRadius: 3 }, // 💡 复用常量
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
          ...(ctx.widgetFamily === "systemSmall" ? [] : [
            { type: "text", text: expireText, font: { size: "caption2", weight: "medium" }, textColor: COLORS.textTertiary }
          ]),
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
  const [urlPart, hashPart = ""] = base.split('#');
  const [path, query = ""] = urlPart.split('?');
  const params = query.split('&').filter(p => p && !p.startsWith('flag='));
  params.push(`flag=${flag}`);
  return `${path}?${params.join('&')}${hashPart ? '#' + hashPart : ''}`;
}

function parseUserInfo(header) {
  if (!header) return null;
  let info = null; 
  for (const match of header.matchAll(REGEX_USERINFO)) {
    const val = Number(match[2]);
    if (Number.isFinite(val)) {
      (info ??= {})[match[1]] = val; 
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

  return Math.max(0, Math.round((Date.UTC(year, nextMonth, safeDay) - Date.UTC(year, month, date)) / 86400000));
}

async function concurrentMap(items, maxConcurrent, fn) {
  const results = new Array(items.length);
  let index = 0;
  const worker = async () => {
    while (index < items.length) {
      const currentIndex = index++;
      try {
        results[currentIndex] = await fn(items[currentIndex]);
      } catch (err) {
        results[currentIndex] = { 
          name: items[currentIndex]?.name ?? "未知", 
          error: true, 
          errorMsg: "Render Error" 
        };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(maxConcurrent, items.length) }, worker));
  return results;
}