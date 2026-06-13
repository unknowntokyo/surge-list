/**
 * 机场订阅流量监控小组件
 * * 📝 使用说明
 * 1️⃣ 在Egern脚本当中添加 类型选择 通用 保存后 返回首页(分析) 点左上角 进去就能看到小组件界面 然后点右上角加号 选择刚才添加的脚本
 * 添加环境变量（在 Egern 中进入小组件"编辑环境变量"）
 * * 格式：名称里填 NAME1  值里填 你的机场名称
 * * NAME1 = 翻墙                     # 机场名称（自定义）
 * URL1 = https://xxx.com/sub...   # 订阅地址（必填）
 * RESET1 = 1                      # 重置日（可选，每月1日重置）
 * * NAME2 = 机场B
 * URL2 = https://yyy.com/sub...
 * RESET2 = 15                     # 每月15日重置
 * * 2️⃣ 参数说明：
 * - NAME1-5：机场名称，显示在卡片上（必填，否则显示"机场订阅"）
 * - URL1-5：订阅地址，从机场后台复制（必填）
 * - RESET1-5：流量重置日，1-31 的数字（可选）
 */

// 1. 全局静态常量提升：引擎启动时仅分配一次
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
const WIDGET_BG_COLOR = { light: "#FFFFFF", dark: "#2C2C2E" };
const CACHE_TIME = 1 * 60 * 60 * 1000;
const UNITS = ["B", "KB", "MB", "GB", "TB"];

// 加入连字符 '-' 防止非标准字段导致解析崩溃
const REGEX_USERINFO = /([-\w]+)=([\d.eE+-]+)/g;

// 战略打击队列：精准组合盲试，最坏耗时被底层严格限制
const STRATEGIES = [
  { m: "head", flag: null, ua: { "User-Agent": "Quantumult%20X/1.5.2" } },
  { m: "get", flag: null, ua: { "User-Agent": "clash-verge-rev/2.3.1", Accept: "application/x-yaml,text/plain,*/*" } },
  { m: "get", flag: "clash", ua: { "User-Agent": "mihomo/1.19.3", Accept: "application/x-yaml,text/plain,*/*" } },
  { m: "get", flag: "meta", ua: { "User-Agent": "clash-verge-rev/2.3.1", Accept: "application/x-yaml,text/plain,*/*" } }
];

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
      if (num >= 1 && num <= 31) resetDay = num;
    }

    slots.push({
      name: (ctx.env[`NAME${i}`] || "").trim() || "机场订阅",
      url,
      resetDay,
    });
  }

  if (!slots.length) {
    return {
      type: "widget",
      backgroundColor: WIDGET_BG_COLOR,
      padding: 16,
      gap: 12,
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

  const widgetFamily = ctx.widgetFamily;
  const isLarge = widgetFamily === "systemLarge" || widgetFamily === "systemExtraLarge";
  const maxDisplay = isLarge ? 5 : 2;
  const activeSlots = slots.slice(0, maxDisplay);
  
  // 统一绝对时间线
  const now = new Date();
  
  // 并发控制：最大并发数限制为 2，杜绝并发风暴与网络节流
  const cardChildren = await concurrentMap(activeSlots, 2, async (s) => {
    const info = await fetchInfo(ctx, s, now);
    return buildCard(info, ctx);
  });
  
  const refreshTime = new Date(now.getTime() + CACHE_TIME).toISOString();
  // 稳定时间格式化：抛弃脆弱的 toTimeString 本地化依赖
  const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const isCompact = activeSlots.length >= 2;

  return {
    type: "widget",
    backgroundColor: WIDGET_BG_COLOR,
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

  // 🛡️ 防御雷区：安全读取缓存，防止沙盒 I/O 崩溃导致白屏
  try {
    const parsed = ctx.storage.getJSON(cacheKey);
    if (parsed && parsed.time && parsed.data) {
      cacheData = parsed.data;
      if (nowTime - parsed.time < CACHE_TIME) {
        return {
          ...cacheData,
          name: slot.name,
          remainDays: slot.resetDay ? getRemainingDays(slot.resetDay, now) : null,
        };
      }
    }
  } catch (e) {
    // 降级为无缓存状态，静默推进
  }

  // 遍历策略发起请求
  for (const strategy of STRATEGIES) {
    try {
      const targetUrl = buildUrl(slot.url, strategy.flag);
      // 完全依赖底层的 1500ms 阻断，干脆利落
      const resp = await ctx.http[strategy.m](targetUrl, { headers: strategy.ua, timeout: 1500 });
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
        };

        // 安全写入缓存
        try {
          ctx.storage.setJSON(cacheKey, { time: nowTime, data: result });
        } catch (e) {}

        return {
          ...result,
          name: slot.name,
          remainDays: slot.resetDay ? getRemainingDays(slot.resetDay, now) : null,
        };
      }
    } catch (_) {
      // 当前策略失败，静默推进下一个策略
    }
  }

  // 代码执行到这里，说明所有请求策略均已溃败（消除冗余的 try-catch 结构）
  if (cacheData) {
    return {
      ...cacheData,
      name: slot.name,
      remainDays: slot.resetDay ? getRemainingDays(slot.resetDay, now) : null,
      isFallback: true,
    };
  }
  
  return { name: slot.name, error: true };
}

function buildCard(result, ctx) {
  const { name, error, used, totalBytes, percent, expire, remainDays, isFallback } = result;

  let statusColor = COLORS.accentGreen;
  if (error) statusColor = COLORS.accentRed;
  else if (percent >= 95) statusColor = COLORS.accentRed;
  else if (percent >= 80) statusColor = COLORS.accentOrange;
  else if (percent >= 50) statusColor = COLORS.accentPurple;

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
        { type: "text", text: "失败", font: { size: "caption2", weight: "semibold" }, textColor: COLORS.accentRed },
      ],
    };
  }

  const progressPercent = Math.min(Math.max(percent, 0), 100);
  const usedStr = formatBytes(used);
  const totalStr = formatBytes(totalBytes);
  const remainStr = formatBytes(totalBytes - used);

  let expireText = "";

  if (remainDays != null) {
    expireText = `${remainDays}天后流量重置`;
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
    borderColor: COLORS.divider,
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 5,
        children: [
          { type: "image", src: "sf-symbol:circle.fill", width: 6, height: 6, color: statusColor },
          { type: "text", text: name, font: { size: "caption2", weight: "semibold" }, textColor: isFallback ? COLORS.accentRed : COLORS.textPrimary, flex: 1 },
          { type: "text", text: `${Math.round(progressPercent)}%`, font: { size: "caption2", weight: "bold" }, textColor: statusColor },
        ],
      },
      {
        type: "stack",
        direction: "row",
        height: 5,
        borderRadius: 3,
        children: [
          { type: "stack", flex: Math.max(progressPercent, 0.1), height: 5, backgroundColor: statusColor, borderRadius: 3 },
          { type: "stack", flex: Math.max(100 - progressPercent, 0.1), height: 5, backgroundColor: { light: "#E8E8EA", dark: "#48484A" }, borderRadius: 3 },
        ],
      },
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 5,
        children: [
          { type: "text", text: `${usedStr}/${totalStr}`, font: { size: "caption2", weight: "medium" }, textColor: COLORS.textSecondary },
          { type: "spacer" },
          ...(ctx.widgetFamily === "systemSmall" ? [] : [
            { type: "text", text: expireText, font: { size: "caption2", weight: "medium" }, textColor: COLORS.textTertiary, lineLimit: 1 },
            { type: "spacer" },
          ]),
          { type: "text", text: `剩${remainStr}`, font: { size: "caption2", weight: "semibold" }, textColor: COLORS.accentGreen },
        ],
      },
    ],
  };
}

function buildUrl(base, flag) {
  if (!flag) return base;
  // 避免给本身已经含有相同 flag 的地址重复追加导致机场报错
  if (base.includes(`flag=${flag}`)) return base;
  
  const hashIndex = base.indexOf("#");
  const url = hashIndex !== -1 ? base.substring(0, hashIndex) : base;
  const hash = hashIndex !== -1 ? base.substring(hashIndex) : "";
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}flag=${flag}${hash}`;
}

// 极致内存克制：若无匹配，连空对象的初始内存都不分配
function parseUserInfo(header) {
  if (!header) return null;
  let info = null; 
  for (const match of header.matchAll(REGEX_USERINFO)) {
    if (!info) info = {};
    info[match[1]] = +match[2];
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

  const maxDay = new Date(year, month + 1, 0).getDate();
  const safeDay = Math.min(resetDay, maxDay);
  
  let next = new Date(year, month, safeDay);

  // 修复边界 bug：只有当今天已经【过了】重置日，才将重置日推迟到下个月。
  // 确保重置日当天计算出的剩余天数为 0，而不是 30。
  if (date > safeDay) {
    const nextMonthMax = new Date(year, month + 2, 0).getDate();
    const nextSafeDay = Math.min(resetDay, nextMonthMax);
    next = new Date(year, month + 1, nextSafeDay);
  }
  
  return Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86400000));
}

/**
 * 极简并发控制器 (Worker Pool 模式)
 * 作用：限制并发数，无锁设计，严格保证数组渲染顺序，避免内存碎片
 */
async function concurrentMap(items, maxConcurrent, fn) {
  const results = new Array(items.length);
  let index = 0;

  const worker = async () => {
    while (index < items.length) {
      const currentIndex = index++;
      // 即便其中某个任务抛错，也能保障组件后续运转
      try {
        results[currentIndex] = await fn(items[currentIndex]);
      } catch (err) {
        results[currentIndex] = { error: true, name: items[currentIndex]?.name || "未知" };
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(maxConcurrent, items.length) }, 
    () => worker()
  );

  await Promise.all(workers);
  return results;
}