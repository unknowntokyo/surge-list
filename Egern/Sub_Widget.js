/**
 * 机场订阅流量监控小组件
 *
 * 📝 使用说明
 * 1️⃣ 添加环境变量（在 Egern 中进入小组件"编辑环境变量"）：
 *
 *    NAME1 = 翻墙                     # 机场名称（自定义）
 *    URL1 = https://xxx.com/sub...   # 订阅地址（必填）
 *    RESET1 = 1                      # 重置日（可选，每月1日重置）
 *
 * 2️⃣ 参数说明：
 *    - NAME1-5：机场名称，显示在卡片上（可选，否则显示"机场订阅"）
 *    - URL1-5：订阅地址，从机场后台复制（必填）
 *    - RESET1-5：流量重置日，1-31 的整数（可选）
 *
 * 3️⃣ 注意事项：
 *    - 环境变量名称必须大写（NAME1、URL1 等）
 *    - 至少需要配置 URL1 才能显示
 *    - 订阅地址需要包含完整的 token
 *    - 小组件每1小时自动刷新一次
 *    - 自动适配系统深色/浅色模式
 *
 * 4️⃣ 功能说明：
 *    - 最多支持配置5个机场。中小尺寸组件显示前2个机场，大尺寸显示5个机场
 *    - 防风控机制：同一订阅30分钟内直接返回缓存，不重复请求网络
 *    - 单个订阅失败不会影响其他订阅刷新
 *    - 断网或订阅异常时，10天内的旧缓存可兜底显示，并用红点和"缓存xx"提示
 *    - 超过10天的旧缓存会被删除并强制显示失败
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
const CARD_BG_COLOR = { light: "#FFFFFF", dark: "#2B2B2D" };

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const NETWORK_COOLDOWN_MS = 30 * 60 * 1000;
const MAX_STALE_MS = 10 * 24 * 60 * 60 * 1000;

const SCRIPT_SOFT_TIMEOUT_MS = 8500;
const REQUEST_TIMEOUT_MS = 1500;
const MIN_REQUEST_TIMEOUT_MS = 500;

const CACHE_PREFIX = "sub_cache";

const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];
const REGEX_USERINFO = /([-\w]+)\s*=\s*([\d.eE+-]+)/g;
const USERINFO_KEYS = new Set(["upload", "download", "total", "expire"]);

const STRATEGIES = [
  {
    flag: "meta",
    ua: {
      "User-Agent": "mihomo/1.19.3",
      Accept: "application/x-yaml,text/plain,*/*",
    },
  },
  {
    flag: "clash",
    ua: {
      "User-Agent": "Clash/1.18.0",
      Accept: "application/x-yaml,text/plain,*/*",
    },
  },
  {
    flag: null,
    ua: {
      "User-Agent": "clash-verge-rev/2.3.1",
      Accept: "application/x-yaml,text/plain,*/*",
    },
  },
];

export default async function (ctx) {
  const env = ctx.env || {};
  const slots = buildSlots(env);

  if (!slots.length) {
    return buildEmptyWidget();
  }

  const widgetFamily = String(ctx.widgetFamily || "systemMedium");
  const activeSlots = slots.slice(0, widgetFamily.includes("Large") ? 5 : 2);

  const now = new Date();
  const nowTime = now.getTime();
  const deadlineTime = nowTime + SCRIPT_SOFT_TIMEOUT_MS;

  const results = await concurrentMap(activeSlots, 2, (slot) =>
    fetchInfo(ctx, slot, now, nowTime, deadlineTime)
  );

  const cardChildren = results.map((result) => safeBuildCard(result, ctx, nowTime));

  const timeStr =
    String(now.getHours()).padStart(2, "0") +
    ":" +
    String(now.getMinutes()).padStart(2, "0");

  return {
    type: "widget",
    backgroundColor: WIDGET_BG_COLOR,
    padding: [10, 10],
    gap: 6,
    refreshAfter: new Date(nowTime + REFRESH_INTERVAL_MS).toISOString(),
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 6,
        children: [
          {
            type: "image",
            src: "sf-symbol:gauge.with.dots.needle.67percent",
            width: 16,
            height: 16,
            color: COLORS.accentGreen,
          },
          {
            type: "text",
            text: "SubInfo",
            font: { size: "subheadline", weight: "bold" },
            textColor: COLORS.textPrimary,
          },
          { type: "spacer" },
          {
            type: "image",
            src: "sf-symbol:arrow.clockwise",
            width: 10,
            height: 10,
            color: COLORS.textTertiary,
          },
          {
            type: "text",
            text: timeStr,
            font: { size: "caption2", weight: "medium" },
            textColor: COLORS.textTertiary,
          },
        ],
      },
      {
        type: "stack",
        direction: "column",
        gap: 10,
        children: cardChildren,
      },
    ],
  };
}

function buildSlots(env) {
  const slots = [];

  for (let i = 1; i <= 5; i++) {
    const url = String(env[`URL${i}`] || "").trim();
    if (!url) continue;

    slots.push({
      id: i,
      name: String(env[`NAME${i}`] || "").trim() || "机场订阅",
      url,
      resetDay: parseResetDay(env[`RESET${i}`]),
    });
  }

  return slots;
}

function buildEmptyWidget() {
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
          {
            type: "image",
            src: "sf-symbol:wifi.slash",
            width: 32,
            height: 32,
            color: COLORS.accentRed,
          },
          {
            type: "text",
            text: "未配置订阅",
            font: { size: "headline", weight: "semibold" },
            textColor: COLORS.textPrimary,
          },
        ],
      },
    ],
  };
}

async function fetchInfo(ctx, slot, now, nowTime, deadlineTime) {
  const remainDays = slot.resetDay ? getRemainingDays(slot.resetDay, now) : null;
  const cacheKey = `${CACHE_PREFIX}_${slot.id}_${hashString(slot.url)}`;

  const cache = readCache(ctx, cacheKey, nowTime);

  if (cache.fresh) {
    return attachSlotMeta(cache.fresh, slot, remainDays);
  }

  const hasStaleCache = Boolean(cache.stale);
  const remote = await fetchRemoteInfo(
    ctx,
    slot.url,
    nowTime,
    deadlineTime,
    hasStaleCache
  );

  if (remote.ok) {
    saveCache(ctx, cacheKey, remote.data);
    return attachSlotMeta(
      {
        ...remote.data,
        cacheTime: nowTime,
      },
      slot,
      remainDays
    );
  }

  if (cache.stale) {
    return attachSlotMeta(
      {
        ...cache.stale,
        isFallback: true,
        cacheAgeText: formatCacheAge(nowTime - cache.stale.cacheTime),
      },
      slot,
      remainDays
    );
  }

  return buildErrorResult(slot, remainDays, remote.errorMsg || "Unknown");
}

function readCache(ctx, cacheKey, nowTime) {
  try {
    const parsed = ctx.storage.getJSON(cacheKey);

    if (!parsed || typeof parsed !== "object") {
      return { fresh: null, stale: null };
    }

    const data = parsed.data;
    const cacheTime = Number(parsed.time ?? data?.updatedAt);
    const normalized = normalizeCachedData(data, cacheTime);

    if (!normalized) {
      safeDeleteCache(ctx, cacheKey);
      return { fresh: null, stale: null };
    }

    const age = nowTime - cacheTime;

    if (age >= 0 && age < NETWORK_COOLDOWN_MS) {
      return {
        fresh: normalized,
        stale: null,
      };
    }

    if (age >= 0 && age < MAX_STALE_MS) {
      return {
        fresh: null,
        stale: normalized,
      };
    }

    safeDeleteCache(ctx, cacheKey);
  } catch (e) {
    safeDeleteCache(ctx, cacheKey);
  }

  return { fresh: null, stale: null };
}

function normalizeCachedData(data, cacheTime) {
  if (!data || typeof data !== "object" || !Number.isFinite(cacheTime)) {
    return null;
  }

  const used = Number(data.used);
  const totalBytes = Number(data.totalBytes);

  if (
    !Number.isFinite(used) ||
    !Number.isFinite(totalBytes) ||
    used < 0 ||
    totalBytes <= 0
  ) {
    return null;
  }

  const expire = Number(data.expire);
  const updatedAt = Number(data.updatedAt);

  return {
    ...data,
    used,
    totalBytes,
    percent: (used / totalBytes) * 100,
    expire: Number.isFinite(expire) && expire > 0 ? expire : null,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : cacheTime,
    cacheTime,
  };
}

function saveCache(ctx, cacheKey, data) {
  try {
    ctx.storage.setJSON(cacheKey, {
      time: data.updatedAt,
      data,
    });
  } catch (e) {}
}

function safeDeleteCache(ctx, cacheKey) {
  try {
    ctx.storage.delete(cacheKey);
  } catch (e) {}
}

async function fetchRemoteInfo(ctx, url, nowTime, deadlineTime, hasStaleCache) {
  let lastErrorMsg = "Unknown";

  for (const strategy of STRATEGIES) {
    const timeout = getRequestTimeout(deadlineTime);

    if (timeout <= 0) {
      lastErrorMsg = "Timeout";
      break;
    }

    try {
      const resp = await ctx.http.get(buildUrl(url, strategy.flag), {
        headers: strategy.ua,
        timeout,
      });

      const status = Number(resp.status);

      if (Number.isFinite(status) && (status < 200 || status >= 300)) {
        lastErrorMsg = `HTTP ${status}`;

        if (hasStaleCache) {
          break;
        }

        continue;
      }

      const info = parseUserInfo(getHeader(resp.headers, "subscription-userinfo"));

      if (info && Number.isFinite(info.total) && info.total > 0) {
        return {
          ok: true,
          data: buildSuccessResult(info, nowTime),
        };
      }

      lastErrorMsg = "No Data";

      if (hasStaleCache) {
        break;
      }
    } catch (err) {
      lastErrorMsg = normalizeRequestError(err);

      if (hasStaleCache) {
        break;
      }
    }
  }

  return {
    ok: false,
    errorMsg: lastErrorMsg,
  };
}

function getRequestTimeout(deadlineTime) {
  const remaining = deadlineTime - Date.now() - 100;

  if (remaining < MIN_REQUEST_TIMEOUT_MS) {
    return 0;
  }

  return Math.min(REQUEST_TIMEOUT_MS, remaining);
}

function normalizeRequestError(err) {
  const msg = String(err?.message ?? err ?? "").toLowerCase();

  if (msg.includes("timeout") || msg.includes("timed out")) {
    return "Timeout";
  }

  if (msg.includes("dns")) {
    return "DNS Error";
  }

  return "Network";
}

function buildSuccessResult(info, nowTime) {
  const upload = Math.max(0, info.upload || 0);
  const download = Math.max(0, info.download || 0);
  const used = upload + download;
  const totalBytes = info.total;

  return {
    used,
    totalBytes,
    percent: totalBytes > 0 ? (used / totalBytes) * 100 : 0,
    expire: Number.isFinite(info.expire) && info.expire > 0 ? info.expire : null,
    updatedAt: nowTime,
  };
}

function attachSlotMeta(data, slot, remainDays) {
  return {
    ...data,
    name: slot.name,
    remainDays,
  };
}

function buildErrorResult(slot, remainDays, errorMsg) {
  return {
    name: slot.name,
    error: true,
    errorMsg,
    remainDays,
  };
}

function buildCard(result, ctx, nowTime) {
  const {
    name,
    error,
    errorMsg,
    used,
    totalBytes,
    percent,
    expire,
    remainDays,
    isFallback,
    cacheAgeText,
  } = result;

  const safePercent = Number.isFinite(percent) ? percent : 0;

  let statusColor = COLORS.accentGreen;
  if (safePercent >= 95) statusColor = COLORS.accentRed;
  else if (safePercent >= 80) statusColor = COLORS.accentOrange;
  else if (safePercent >= 50) statusColor = COLORS.accentPurple;

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
        {
          type: "image",
          src: "sf-symbol:exclamationmark.circle.fill",
          width: 12,
          height: 12,
          color: COLORS.accentRed,
        },
        {
          type: "text",
          text: name,
          font: { size: "caption2", weight: "semibold" },
          textColor: COLORS.accentRed,
          flex: 1,
          maxLines: 1,
        },
        {
          type: "text",
          text: `失败 | ${errorMsg || "异常"}`,
          font: { size: "caption2", weight: "bold" },
          textColor: COLORS.accentRed,
          maxLines: 1,
        },
      ],
    };
  }

  const p = Math.min(Math.max(safePercent, 0), 100);
  const displayPercent = Math.max(0, safePercent);
  const displayName = isFallback ? `${name} · ${cacheAgeText || "缓存"}` : name;

  let expireText = "永久有效";
  let isExpired = false;

  if (remainDays != null) {
    expireText = remainDays === 0 ? "今天重置" : `${remainDays}天后重置`;
  } else if (expire > 0) {
    const expireMs = expire < 1e12 ? expire * 1000 : expire;
    const d = new Date(expireMs);

    if (Number.isFinite(expireMs) && expireMs < nowTime) {
      expireText = "已过期";
      isExpired = true;
      statusColor = COLORS.accentRed;
    } else {
      expireText = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }

  const dotColor = isFallback || isExpired ? COLORS.accentRed : statusColor;

  return {
    type: "stack",
    direction: "column",
    gap: 5,
    padding: [8, 10],
    backgroundColor: CARD_BG_COLOR,
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
          {
            type: "image",
            src: "sf-symbol:circle.fill",
            width: 6,
            height: 6,
            color: dotColor,
          },
          {
            type: "text",
            text: displayName,
            font: { size: "caption2", weight: "semibold" },
            textColor: COLORS.textPrimary,
            flex: 1,
            maxLines: 1,
          },
          {
            type: "text",
            text: `${Math.round(displayPercent)}%`,
            font: { size: "caption2", weight: "bold" },
            textColor: statusColor,
            maxLines: 1,
          },
        ],
      },
      {
        type: "stack",
        direction: "row",
        height: 5,
        borderRadius: 3,
        children: [
          {
            type: "stack",
            flex: Math.max(p, 0.01),
            height: 5,
            backgroundColor: statusColor,
            borderRadius: 3,
          },
          {
            type: "stack",
            flex: Math.max(100 - p, 0.01),
            height: 5,
            backgroundColor: COLORS.progressBg,
            borderRadius: 3,
          },
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
              {
                type: "text",
                text: `${formatBytes(used)}/${formatBytes(totalBytes)}`,
                font: { size: "caption2", weight: "medium" },
                textColor: COLORS.textSecondary,
                maxLines: 1,
              },
              { type: "spacer" },
            ],
          },
          ...(ctx.widgetFamily === "systemSmall"
            ? []
            : [
                {
                  type: "text",
                  text: expireText,
                  font: { size: "caption2", weight: "medium" },
                  textColor: isExpired ? COLORS.accentRed : COLORS.textTertiary,
                  maxLines: 1,
                },
              ]),
          {
            type: "stack",
            direction: "row",
            flex: 1,
            children: [
              { type: "spacer" },
              {
                type: "text",
                text: `剩${formatBytes(Math.max(0, totalBytes - used))}`,
                font: { size: "caption2", weight: "semibold" },
                textColor: statusColor,
                maxLines: 1,
              },
            ],
          },
        ],
      },
    ],
  };
}

function safeBuildCard(result, ctx, nowTime) {
  try {
    return buildCard(result, ctx, nowTime);
  } catch (err) {
    return buildRenderErrorCard(result?.name || "未知");
  }
}

function buildRenderErrorCard(name) {
  return {
    type: "stack",
    direction: "row",
    alignItems: "center",
    gap: 6,
    padding: [8, 10],
    backgroundColor: COLORS.errorBg,
    borderRadius: 8,
    children: [
      {
        type: "image",
        src: "sf-symbol:exclamationmark.circle.fill",
        width: 12,
        height: 12,
        color: COLORS.accentRed,
      },
      {
        type: "text",
        text: String(name || "未知"),
        font: { size: "caption2", weight: "semibold" },
        textColor: COLORS.accentRed,
        flex: 1,
        maxLines: 1,
      },
      {
        type: "text",
        text: "失败 | Render Error",
        font: { size: "caption2", weight: "bold" },
        textColor: COLORS.accentRed,
        maxLines: 1,
      },
    ],
  };
}

function buildUrl(base, flag) {
  if (!flag) return base;

  try {
    const u = new URL(base);

    for (const key of Array.from(u.searchParams.keys())) {
      if (key.toLowerCase() === "flag") {
        u.searchParams.delete(key);
      }
    }

    u.searchParams.set("flag", flag);
    return u.toString();
  } catch (e) {
    const hashIndex = base.indexOf("#");
    const urlPart = hashIndex >= 0 ? base.slice(0, hashIndex) : base;
    const hashPart = hashIndex >= 0 ? base.slice(hashIndex) : "";

    const queryIndex = urlPart.indexOf("?");
    const path = queryIndex >= 0 ? urlPart.slice(0, queryIndex) : urlPart;
    const query = queryIndex >= 0 ? urlPart.slice(queryIndex + 1) : "";

    const params = query.split("&").filter(isNonFlagParam);
    params.push(`flag=${encodeURIComponent(flag)}`);

    return `${path}?${params.join("&")}${hashPart}`;
  }
}

function isNonFlagParam(param) {
  if (!param) return false;

  const rawKey = param.split("=")[0] || "";
  let key = rawKey;

  try {
    key = decodeURIComponent(rawKey.replace(/\+/g, "%20"));
  } catch (e) {}

  return key.toLowerCase() !== "flag";
}

function getHeader(headers, name) {
  if (!headers) return "";

  if (typeof headers.get === "function") {
    return (
      headers.get(name) ||
      headers.get(name.toLowerCase()) ||
      headers.get(name.toUpperCase()) ||
      ""
    );
  }

  const target = name.toLowerCase();

  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === target) {
      return headers[key];
    }
  }

  return "";
}

function parseUserInfo(header) {
  if (header == null) return null;

  if (Array.isArray(header)) {
    header = header.join("; ");
  } else {
    header = String(header);
  }

  if (!header.trim()) return null;

  const info = {};
  REGEX_USERINFO.lastIndex = 0;

  for (const match of header.matchAll(REGEX_USERINFO)) {
    const key = String(match[1] || "").toLowerCase();
    if (!USERINFO_KEYS.has(key)) continue;

    const val = Number(match[2]);

    if (Number.isFinite(val) && val >= 0) {
      info[key] = val;
    }
  }

  return Object.keys(info).length ? info : null;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0B";

  let i = 0;
  let value = bytes;

  while (value >= 1024 && i < UNITS.length - 1) {
    value /= 1024;
    i++;
  }

  let displayValue =
    value >= 10 || i === 0 ? Math.round(value) : Number(value.toFixed(1));

  if (displayValue >= 1024 && i < UNITS.length - 1) {
    displayValue = 1;
    i++;
  }

  return `${displayValue}${UNITS[i]}`;
}

function formatCacheAge(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "缓存";

  const minutes = Math.max(1, Math.floor(ms / 60000));

  if (minutes < 60) {
    return `缓存${minutes}分`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `缓存${hours}小时`;
  }

  const days = Math.floor(hours / 24);
  return `缓存${days}天`;
}

function getRemainingDays(resetDay, now) {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();

  let targetYear = currentYear;
  let targetMonth = currentMonth;

  const getMonthDays = (year, month) => new Date(year, month + 1, 0).getDate();

  let safeDay = Math.min(resetDay, getMonthDays(targetYear, targetMonth));

  if (currentDate > safeDay) {
    targetMonth += 1;

    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }

    safeDay = Math.min(resetDay, getMonthDays(targetYear, targetMonth));
  }

  const diffMs =
    Date.UTC(targetYear, targetMonth, safeDay) -
    Date.UTC(currentYear, currentMonth, currentDate);

  return Math.max(0, Math.ceil(diffMs / 86400000));
}

function parseResetDay(value) {
  if (value == null) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const num = Number(raw);
  return Number.isInteger(num) && num >= 1 && num <= 31 ? num : null;
}

async function concurrentMap(items, maxConcurrent, fn) {
  if (!Array.isArray(items) || !items.length) return [];

  const results = new Array(items.length);
  const workerCount = Math.max(
    1,
    Math.min(Math.floor(Number(maxConcurrent)) || 1, items.length)
  );

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
          errorMsg: "Fetch Error",
        };
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

function hashString(str) {
  let h = 2166136261;

  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return (h >>> 0).toString(36);
}