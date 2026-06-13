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
 * - 加了缓存机制 如果数据存在且距离上次请求未超过 1 小时，则直接返回缓存结果，不再发起网络请求，避免风控，导致机场主拉黑，若流量信息的缓存时间超过10天，则强制显示失败
* - 加了订阅链接存活检测机制，订阅链接连接失败，名称前显示红点，非实时，必须要超过上面设置的1小时缓存时间才能切换状态
 */

/**
 * 机场订阅流量监控小组件 (Modern iOS 物理极限封版)
 * * 📝 使用说明：
 * 1️⃣ 在 Egern 脚本当中添加 类型选择 通用
 * 2️⃣ 添加环境变量：
 * - NAME1 = 机场名称 (自定义)
 * - URL1  = 订阅地址 (必填)
 * - RESET1 = 1-31 的重置日 (可选)
 * * 💡 缓存与风控机制说明 (已完美对齐代码行为)：
 * - 🛡️ 5分钟防暴击：数据成功请求后，5分钟内若重复触发刷新，将直接返回缓存，不请求网络，防止误触导致机场风控拉黑。
 * - 📡 实时测活：超过5分钟后，组件每次刷新均会优先请求网络。若机场链接挂了，将自动启用10天内的本地缓存兜底，并【立刻亮起红点】发出断网警示。
 * - 🔥 10天自动火化：若断网/机场跑路超过10天，缓存彻底失效，卡片将全线爆红并打印精准死因。
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
  errorBg: { light: "#FFF5F5", dark: "#3B1F1F" },
  progressBg: { light: "#E8E8EA", dark: "#48484A" },
};
const WIDGET_BG_COLOR = { light: "#FFFFFF", dark: "#2C2C2E" };
const REFRESH_INTERVAL_MS = 3600000; // 系统级心跳唤醒间隔 (1小时)
const MAX_STALE_MS = 10 * 24 * 60 * 60 * 1000; // 10天缓存火化线
const UNITS = ["B", "KB", "MB", "GB", "TB"];
const REGEX_USERINFO = /([-\w]+)\s*=\s*([\d.eE+-]+)/g;

// 🔒 严格核对：100% 还原你最关心的原生 UA 映射与 flag 对应关系
const STRATEGIES = [
  { flag: "meta", ua: { "User-Agent": "mihomo/1.19.3", Accept: "application/x-yaml,text/plain,*/*" } },
  { flag: "clash", ua: { "User-Agent": "Clash/1.18.0", Accept: "application/x-yaml,text/plain,*/*" } },
  { flag: null, ua: { "User-Agent": "clash-verge-rev/2.3.1", Accept: "application/x-yaml,text/plain,*/*" } }
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
  const nowTime = now.getTime();

  try {
    const parsed = ctx.storage.getJSON(cacheKey);
    if (parsed?.data) {
      const timeDiff = nowTime - parsed.time;

      // 🛡️ 智能风控盾：如果距离上次拉取成功未满 5 分钟 (300000ms)，直接拦截，强制返回缓存保护 IP
      if (timeDiff < 300000) {
        return { ...parsed.data, name: slot.name, remainDays: slot.resetDay ? getRemainingDays(slot.resetDay, now) : null };
      }

      // 超过 5 分钟，进入测活流程，留出旧数据用于断网兜底
      if (timeDiff < MAX_STALE_MS) {
        cacheData = parsed.data; 
      } else {
        try { ctx.storage.remove(cacheKey); } catch (e) {}
      }
    }
  } catch (e) {}

  for (const strategy of STRATEGIES) {
    let retryCount = 0;
    while (retryCount < 2) {
      try {
        // 🔒 死守命令：严格保持 2000ms 超时阈值，单策略内允许重试 1 次抗网络抑制
        const resp = await ctx.http.get(buildUrl(slot.url, strategy.flag), { headers: strategy.ua, timeout: 2000 });

        if (resp.status && (resp.status < 200 || resp.status >= 300)) {
          lastErrorMsg = `HTTP ${resp.status}`;
          break; 
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

          try { ctx.storage.setJSON(cacheKey, { time: nowTime, data: result }); } catch (e) {}
          return { ...result, name: slot.name, remainDays: slot.resetDay ? getRemainingDays(slot.resetDay, now) : null };
        } else {
          lastErrorMsg = "No Data";
          break; 
        }
      } catch (err) {
        retryCount++;
        const msg = String(err?.message ?? err ?? "").toLowerCase();
        if (msg.includes("timeout") || msg.includes("timed out")) {
          lastErrorMsg = "Timeout";
          if (retryCount < 2) continue; 
        } else {
          lastErrorMsg = msg.includes("dns") ? "DNS Error" : "Network";
        }
        break; 
      }
    }
  }

  // 📡 网络请求失败：调取 10 天内缓存兜底，并打上离线标记（触发 UI 亮起红点）
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
      backgroundColor: COLORS.errorBg, 
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
          { type: "stack", flex: Math.max(100 - p, 0.01), height: 5, backgroundColor: COLORS.progressBg, borderRadius: 3 }, 
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