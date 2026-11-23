/*
 * =======================================
 * 时光倒数 (Surge Panel + Cron 提醒)
 * ---------------------------------------
 * 参考 Egern Countdown.js 同步改造，适配 Surge 面板与定时通知：
 * - 统一按北京时间 (UTC+8) 计算，解决跨时区偏移与跨年农历漏算问题
 * - 内置 1900-2100 农历与清明节气算法，优先融合 holiday-cn 国务院放假/调休数据
 * - 支持四大分类（法定 / 民俗 / 国际 / 专属）、跨年连续假期合并、今日放假进度
 * - 支持置顶节日、优先级排序、专属高权重、自动主题色（含官方补班日回落）
 * - 支持 Panel 与 Cron 共享持久化缓存与当日首日提醒去重（含同日新增补推与失败退避）
 *
 * 参数配置（通过 Surge 模块 #!arguments 或脚本 argument="KEY=VAL&..." 传入）：
 * - ENABLE_PRIORITY_SORT     : true/false，默认 true，按节日权重排序
 * - ENABLE_EXCLUSIVE_WEIGHT  : true/false，默认 true，开启后专属日优先级提升为 9
 * - ENABLE_AUTO_THEME        : true/false，默认 true，按今日节日(红)/放假或周末(绿)/工作日或补班(灰)切图标色
 * - ENABLE_NOTIFY            : true/false，默认 true，节日/专属日首日发送系统通知
 * - PINNED_HOLIDAY           : 置顶节日名称，支持逗号/顿号/斜杠分隔，最多 12 项
 * - EXCLUSIVE_NAME_1 ~ 6     : 专属纪念日名称（与同序号日期成对生效）
 * - EXCLUSIVE_DATE_1 ~ 6     : 支持公历每年 M/D、公历一次性 YYYY/M/D，
 *                              并额外兼容农历每年 L12/3（或 农历12/3）与一次性 L2026/12/3
 * =======================================
 */

"use strict";

const RANDOM_NOTICES = [
  "距离放假，还要摸鱼多少天？",
  "坚持住，就快放假啦！",
  "上班好累呀，下顿吃啥？",
  "努力，我还能加班24小时！",
  "躺平中，等放假",
  "施主请回，此饼不吃",
  "只有摸鱼才是赚老板的钱",
  "小乌龟慢慢爬",
  "加油，明天会更好！",
  "生活本该如此轻松",
  "好累，但还能坚持一会儿",
  "快放假啦，期待放松的时光",
  "给自己加个鸡腿！",
  "佛系上班，一切随缘",
  "我的理想是：不上班还有钱",
  "放弃幻想，认清现状，低调搬砖",
  "生活碎片，拼凑成诗",
  "慢慢走，沿途的花都开了",
  "没什么期待，也就没什么失望",
  "所谓的成长，就是学会不抱希望",
  "只要努力工作，老板的午餐就是我的",
  "今天的任务是：不干活！",
  "用力生活，用力摸鱼"
];

const CATEGORY_CONFIG = [
  { key: "legal", label: "法定", emoji: "🏛" },
  { key: "folk", label: "民俗", emoji: "🏮" },
  { key: "intl", label: "国际", emoji: "🌍" },
  { key: "exclusive", label: "专属", emoji: "🎁" }
];

const CATEGORY_KEYS = CATEGORY_CONFIG.map(cfg => cfg.key);

const BASE_PRIORITY = {
  legal: 3,
  folk: 2,
  intl: 1,
  exclusive: 2
};

const SPECIAL_PRIORITY = {
  春节: 10,
  国庆节: 9,
  元旦: 7,
  清明节: 7,
  端午节: 7,
  中秋节: 7,
  除夕: 6
};

const DISPLAY_NAME_MAP = {
  端午节: "🐲",
  七夕节: "💘",
  万圣节: "🎃"
};

const ICON_COLORS = {
  festival: "#FF3B30",
  offday: "#34C759",
  workday: "#8E8E93",
  error: "#FF3B30"
};

const DAY_MS = 86400000;
const BJ_OFFSET_MS = 8 * 3600000;
const PANEL_HTTP_TIMEOUT_S = 3;
const CRON_HTTP_TIMEOUT_S = 5;
const OFFICIAL_REFRESH_INTERVAL_MS = 3 * DAY_MS;
const OFFICIAL_FAILED_RETRY_INTERVAL_MS = DAY_MS;
const NOTIFY_FAILED_RETRY_INTERVAL_MS = 10 * 60 * 1000;
const NOTIFY_PANEL_START_HOUR = 8;

const TOP_PINNED_DISPLAY_LIMIT = 2;
const CATEGORY_CACHE_LIMIT = 7;
const CATEGORY_DISPLAY_LIMIT = 3;

const STORAGE_SCOPE = "timecard";
const OFFICIAL_HOLIDAY_STORAGE_VERSION = 3;
const DAILY_CACHE_SCHEMA_VERSION = 26;
const DAILY_CACHE_VERSION = `v${DAILY_CACHE_SCHEMA_VERSION}`;

const OFFICIAL_HOLIDAY_KEY = `${STORAGE_SCOPE}:official_holidays:v${OFFICIAL_HOLIDAY_STORAGE_VERSION}`;
const BASE_CACHE_KEY = `${STORAGE_SCOPE}:daily:${DAILY_CACHE_VERSION}`;
const NOTIFY_KEY = `${STORAGE_SCOPE}:notify:v1`;

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SLASH_YMD_RE = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;
const ANNUAL_SLASH_DATE_RE = /^(\d{1,2})\/(\d{1,2})$/;
const ONCE_SLASH_DATE_RE = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;
const LUNAR_PREFIX_RE = /^(?:[Ll]|农历)\s*/;
const TEMPLATE_PLACEHOLDER_RE = /^\{\{\{[A-Za-z0-9_]+\}\}\}$/;
const EMPTY_ARG_SENTINEL_RE = /^(?:-|无|none|null|\(null\))$/i;
const NAME_LIST_SEPARATOR_RE = /[、，,/]+/;
const EXCLUSIVE_NAME_KEY_RE = /^EXCLUSIVE_NAME_\d+$/;
const EXCLUSIVE_DATE_KEY_RE = /^EXCLUSIVE_DATE_\d+$/;

const MAX_EXCLUSIVE_NAME_LENGTH = 20;
const MAX_EXCLUSIVE_DATE_LENGTH = 20;
const MAX_PINNED_HOLIDAY_ITEM_LENGTH = 20;
const MAX_PINNED_HOLIDAY_COUNT = 12;
const MAX_PINNED_HOLIDAY_TOTAL_LENGTH = 120;

const DATA_ENV_KEYS = [
  "ENABLE_PRIORITY_SORT",
  "ENABLE_EXCLUSIVE_WEIGHT",
  "PINNED_HOLIDAY",
  "EXCLUSIVE_NAME_1",
  "EXCLUSIVE_DATE_1",
  "EXCLUSIVE_NAME_2",
  "EXCLUSIVE_DATE_2",
  "EXCLUSIVE_NAME_3",
  "EXCLUSIVE_DATE_3",
  "EXCLUSIVE_NAME_4",
  "EXCLUSIVE_DATE_4",
  "EXCLUSIVE_NAME_5",
  "EXCLUSIVE_DATE_5",
  "EXCLUSIVE_NAME_6",
  "EXCLUSIVE_DATE_6"
];

const RENDER_ENV_KEYS = ["ENABLE_AUTO_THEME", "ENABLE_NOTIFY"];
const CACHE_ENV_KEYS = [...DATA_ENV_KEYS, ...RENDER_ENV_KEYS];
const BOOL_ENV_KEYS = new Set([
  "ENABLE_PRIORITY_SORT",
  "ENABLE_EXCLUSIVE_WEIGHT",
  "ENABLE_AUTO_THEME",
  "ENABLE_NOTIFY"
]);

const BOOL_FALSE_VALUES = new Set(["false", "0", "no", "off", "disabled"]);
const BOOL_TRUE_VALUES = new Set(["true", "1", "yes", "on", "enabled"]);

const SOLAR_TERM_INFO = [
  0, 21208, 42467, 63836, 85337, 107014, 128867, 150921,
  173149, 195551, 218072, 240693, 263343, 285989, 308563, 331033,
  353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758
];

const Lunar = {
  info: [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0,
    0x09ad0, 0x055d2, 0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540,
    0x0d6a0, 0x0ada2, 0x095b0, 0x14977, 0x04970, 0x0a4b0, 0x0b4b5, 0x06a50,
    0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, 0x06566, 0x0d4a0,
    0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2,
    0x0a950, 0x0b557, 0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573,
    0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, 0x0aea6, 0x0ab50, 0x04b60, 0x0aae4,
    0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, 0x096d0, 0x04dd5,
    0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46,
    0x0ab60, 0x09570, 0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58,
    0x05ac0, 0x0ab60, 0x096d5, 0x092e0, 0x0c960, 0x0d954, 0x0d4a0, 0x0da50,
    0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, 0x0a950, 0x0b4a0,
    0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260,
    0x0ea65, 0x0d530, 0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0,
    0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, 0x0b5a0, 0x056d0, 0x055b2, 0x049b0,
    0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, 0x14b63, 0x09370,
    0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
    0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0,
    0x0a6d0, 0x055d4, 0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50,
    0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, 0x0b273, 0x06930, 0x07337, 0x06aa0,
    0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, 0x0e968, 0x0d520,
    0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
    0x0d520
  ],
  term(y, n) {
    return new Date(
      31556925974.7 * (y - 1900) +
        SOLAR_TERM_INFO[n - 1] * 60000 +
        Date.UTC(1900, 0, 6, 2, 5)
    );
  },
  lDays(y) {
    if (!Number.isInteger(y) || y < 1900 || y >= 1900 + this.info.length) return 0;
    const info = this.info[y - 1900];
    let s = 348;
    for (let i = 0x8000; i > 0x8; i >>= 1) {
      s += info & i ? 1 : 0;
    }
    const lp = info & 0xf;
    return s + (lp ? (info & 0x10000 ? 30 : 29) : 0);
  },
  mDays(y, m) {
    if (!Number.isInteger(y) || y < 1900 || y >= 1900 + this.info.length) return 0;
    if (!Number.isInteger(m) || m < 1 || m > 12) return 0;
    return this.info[y - 1900] & (0x10000 >> m) ? 30 : 29;
  }
};

const MIN_LUNAR_YEAR = 1900;
const MAX_LUNAR_YEAR = MIN_LUNAR_YEAR + Lunar.info.length - 1;
const LUNAR_BASE_MS = Date.UTC(1900, 0, 31);

function isValidLunarYear(y) {
  return Number.isInteger(y) && y >= MIN_LUNAR_YEAR && y <= MAX_LUNAR_YEAR;
}

const lunarCumulativeCache = { maxYear: 1899, off: [] };

function ensureLunarCumulative(maxYear) {
  const targetYear = Math.min(MAX_LUNAR_YEAR, maxYear);
  if (targetYear <= lunarCumulativeCache.maxYear) return;

  let acc =
    lunarCumulativeCache.maxYear < MIN_LUNAR_YEAR
      ? 0
      : lunarCumulativeCache.off[lunarCumulativeCache.maxYear - MIN_LUNAR_YEAR] +
        Lunar.lDays(lunarCumulativeCache.maxYear);

  for (let y = Math.max(MIN_LUNAR_YEAR, lunarCumulativeCache.maxYear + 1); y <= targetYear; y++) {
    lunarCumulativeCache.off[y - MIN_LUNAR_YEAR] = acc;
    acc += Lunar.lDays(y);
  }
  lunarCumulativeCache.maxYear = targetYear;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function YMD(y, m, d) {
  return `${y}/${pad2(m)}/${pad2(d)}`;
}

function getBeijingDateContext(now = new Date()) {
  const bj = new Date(now.getTime() + BJ_OFFSET_MS);
  const Y = bj.getUTCFullYear();
  const M = bj.getUTCMonth() + 1;
  const D = bj.getUTCDate();
  const hour = bj.getUTCHours();
  const weekday = bj.getUTCDay();
  const todayMs = Date.UTC(Y, M - 1, D);
  return {
    Y,
    M,
    D,
    hour,
    weekday,
    isWeekend: weekday === 0 || weekday === 6,
    todayMs,
    todayStr: `${Y}_${M}_${D}`,
    todayIso: `${Y}-${pad2(M)}-${pad2(D)}`
  };
}

function isValidMonthDay(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() + 1 === month &&
    d.getUTCDate() === day
  );
}

function parseISODateParts(dateStr) {
  const m = ISO_DATE_RE.exec(String(dateStr ?? "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!isValidMonthDay(y, mo, d)) return null;
  return { y, m: mo, d, ms: Date.UTC(y, mo - 1, d) };
}

function isoToMs(dateStr) {
  const parts = parseISODateParts(dateStr);
  return parts ? parts.ms : NaN;
}

function parseSlashYMDParts(dateStr) {
  const m = SLASH_YMD_RE.exec(String(dateStr ?? "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!isValidMonthDay(y, mo, d)) return null;
  return { y, m: mo, d, ms: Date.UTC(y, mo - 1, d) };
}

function slashYMDToMs(dateStr) {
  const parts = parseSlashYMDParts(dateStr);
  return parts ? parts.ms : NaN;
}

function msToYMD(ms) {
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  return YMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function displayName(name) {
  return DISPLAY_NAME_MAP[name] ?? name;
}

function splitNameList(value) {
  return String(value ?? "")
    .split(NAME_LIST_SEPARATOR_RE)
    .map(s => s.trim())
    .filter(Boolean);
}

const EMPTY_HOLIDAY_NAME_PARTS = [];
const HOLIDAY_NAME_PARTS_CACHE = new Map();

function splitHolidayNames(name) {
  const raw = String(name ?? "").trim();
  if (!raw) return EMPTY_HOLIDAY_NAME_PARTS;
  const cached = HOLIDAY_NAME_PARTS_CACHE.get(raw);
  if (cached) return cached;
  const parts = splitNameList(raw);
  if (HOLIDAY_NAME_PARTS_CACHE.size >= 256) {
    HOLIDAY_NAME_PARTS_CACHE.clear();
  }
  HOLIDAY_NAME_PARTS_CACHE.set(raw, parts);
  return parts;
}

function partsIntersect(parts, partSet) {
  if (!Array.isArray(parts) || parts.length === 0 || !(partSet instanceof Set) || partSet.size === 0) {
    return false;
  }
  return parts.some(part => partSet.has(part));
}

function addHolidayNameTokens(targetSet, name) {
  if (!(targetSet instanceof Set)) return;
  for (const part of splitHolidayNames(name)) {
    targetSet.add(part);
  }
}

function holidayNameMatchesTokenSet(name, tokenSet) {
  if (!(tokenSet instanceof Set) || tokenSet.size === 0) return false;
  return splitHolidayNames(name).some(part => tokenSet.has(part));
}

function getSpecialHolidayPriority(name) {
  const names = splitHolidayNames(name);
  let maxPriority = Number.isFinite(SPECIAL_PRIORITY[name])
    ? SPECIAL_PRIORITY[name]
    : undefined;
  for (const n of names) {
    const p = SPECIAL_PRIORITY[n];
    if (Number.isFinite(p)) {
      maxPriority = maxPriority === undefined ? p : Math.max(maxPriority, p);
    }
  }
  return maxPriority;
}

function dedupeHolidayItemsByToken(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const usedTokenSet = new Set();
  const output = [];
  for (const item of items) {
    if (!item) continue;
    const parts = splitHolidayNames(item.name);
    if (parts.some(part => usedTokenSet.has(part))) continue;
    for (const part of parts) usedTokenSet.add(part);
    output.push(item);
  }
  return output;
}

function formatPeriodStr(label, diff, duration = 1) {
  if (diff === 0) return `今日 ${label}`;
  const total = Math.max(1, Number(duration) || 1);
  if (diff < 0 && total > 1) {
    const dayIndex = Math.floor(Math.abs(diff)) + 1;
    return dayIndex >= total ? `${label}最后一天` : `${label}第${dayIndex}天`;
  }
  return `${label} ${diff}天`;
}

function formatDisplayItem(item) {
  return formatPeriodStr(displayName(item.name), item.diff, item.duration);
}

function toPublicCountdownItem(item) {
  return {
    name: item.name,
    diff: item.diff,
    duration: Math.max(1, Number(item.duration) || 1)
  };
}

function formatTodayFestGroup(items) {
  let todayPrefixUsed = false;
  const parts = items.slice(0, 2).map(item => {
    const name = displayName(item.name);
    if (item.diff === 0) {
      if (!todayPrefixUsed) {
        todayPrefixUsed = true;
        return `今日 ${name}`;
      }
      return name;
    }
    return formatPeriodStr(name, item.diff, item.duration);
  });
  return `${parts.join("、")}${items.length > 2 ? "…" : ""}`;
}

function buildPinnedStickyText(pinnedData) {
  if (!Array.isArray(pinnedData) || pinnedData.length === 0) return "";
  const visible = pinnedData.slice(0, TOP_PINNED_DISPLAY_LIMIT);
  const text = visible.map(item => formatPeriodStr(item.name, item.diff, item.duration)).join(" · ");
  return pinnedData.length > TOP_PINNED_DISPLAY_LIMIT ? `${text} · …` : text;
}

function truncateByCodePoint(str, maxLen) {
  const s = String(str ?? "");
  if (maxLen <= 0) return "";
  let out = "";
  let count = 0;
  for (const ch of s) {
    if (count >= maxLen) break;
    out += ch;
    count += 1;
  }
  return out;
}

function hashString(str) {
  const s = String(str ?? "");
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) ^ s.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function parseBoolValue(value, defaultVal = true) {
  if (typeof value === "boolean") return value;
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return defaultVal;
  if (BOOL_FALSE_VALUES.has(raw)) return false;
  if (BOOL_TRUE_VALUES.has(raw)) return true;
  return defaultVal;
}

function safeDecodeURIComponent(str) {
  if (!str || str.indexOf("%") === -1) return str;
  try {
    return decodeURIComponent(str);
  } catch (_) {
    return str;
  }
}

function parseSurgeArgument(rawArg) {
  if (!rawArg) return {};
  if (typeof rawArg === "object") return { ...rawArg };
  const text = String(rawArg).trim();
  if (!text) return {};

  if (text.startsWith("{") && text.endsWith("}")) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (_) {
      // 回落按 query string 解析
    }
  }

  const out = {};
  for (const segment of text.split("&")) {
    if (!segment) continue;
    const eqIdx = segment.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = safeDecodeURIComponent(segment.slice(0, eqIdx).trim());
    if (!key) continue;
    let val = safeDecodeURIComponent(segment.slice(eqIdx + 1)).trim();
    if (TEMPLATE_PLACEHOLDER_RE.test(val)) {
      val = "";
    }
    out[key] = val;
  }
  return out;
}

function sanitizeEnvStringValue(key, rawValue) {
  let value = String(rawValue ?? "").trim();
  if (TEMPLATE_PLACEHOLDER_RE.test(value) || EMPTY_ARG_SENTINEL_RE.test(value)) {
    value = "";
  }
  if (key === "PINNED_HOLIDAY") {
    const truncated = truncateByCodePoint(value, MAX_PINNED_HOLIDAY_TOTAL_LENGTH);
    return splitNameList(truncated)
      .map(item => truncateByCodePoint(item, MAX_PINNED_HOLIDAY_ITEM_LENGTH))
      .filter(Boolean)
      .slice(0, MAX_PINNED_HOLIDAY_COUNT)
      .join(",");
  }
  if (EXCLUSIVE_NAME_KEY_RE.test(key)) {
    return truncateByCodePoint(value, MAX_EXCLUSIVE_NAME_LENGTH);
  }
  if (EXCLUSIVE_DATE_KEY_RE.test(key)) {
    return truncateByCodePoint(value, MAX_EXCLUSIVE_DATE_LENGTH);
  }
  return value;
}

function buildNormalizedEnv(rawEnv) {
  const src = rawEnv && typeof rawEnv === "object" ? rawEnv : {};
  const normalized = {};
  for (const key of CACHE_ENV_KEYS) {
    if (BOOL_ENV_KEYS.has(key)) {
      normalized[key] = parseBoolValue(src[key], true) ? "1" : "0";
    } else {
      normalized[key] = sanitizeEnvStringValue(key, src[key]);
    }
  }
  return normalized;
}

function buildEnvFingerprintFromNormalized(normalizedEnv) {
  return JSON.stringify(DATA_ENV_KEYS.map(key => [key, normalizedEnv[key] ?? ""]));
}

function warnLog(msg, err) {
  const detail = err ? ` ${err.message || String(err)}` : "";
  console.log(`[TimeCard] ${msg}${detail}`);
}

const surgeStorage = {
  getJSON(key) {
    if (typeof $persistentStore === "undefined" || !$persistentStore?.read) {
      return null;
    }
    try {
      const raw = $persistentStore.read(key);
      if (typeof raw !== "string" || !raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      warnLog(`failed to read storage ${key}:`, e);
      return null;
    }
  },
  setJSON(key, value) {
    if (typeof $persistentStore === "undefined" || !$persistentStore?.write) {
      return false;
    }
    try {
      const ok = $persistentStore.write(JSON.stringify(value), key);
      return Boolean(ok);
    } catch (e) {
      warnLog(`failed to write storage ${key}:`, e);
      return false;
    }
  }
};

function httpGetJSON(url, timeoutSec) {
  return new Promise((resolve, reject) => {
    if (typeof $httpClient === "undefined" || !$httpClient?.get) {
      reject(new Error("$httpClient unavailable"));
      return;
    }
    const clampedTimeout = Math.max(1, Math.min(10, Number(timeoutSec) || PANEL_HTTP_TIMEOUT_S));
    $httpClient.get(
      {
        url,
        timeout: clampedTimeout,
        headers: {
          Accept: "application/json",
          "User-Agent": "Surge-TimeCard"
        }
      },
      (error, response, data) => {
        if (error) {
          reject(new Error(typeof error === "string" ? error : error.message || "request failed"));
          return;
        }
        const status = Number(response?.status ?? response?.statusCode);
        if (Number.isFinite(status) && status >= 400) {
          reject(new Error(`HTTP ${status}`));
          return;
        }
        try {
          const parsed = typeof data === "string" ? JSON.parse(data) : data;
          resolve(parsed);
        } catch (e) {
          reject(new Error(`invalid JSON: ${e.message || e}`));
        }
      }
    );
  });
}

function normalizeOfficialDay(day) {
  if (!day || typeof day !== "object") return null;
  const name = typeof day.name === "string" ? day.name.trim() : "";
  if (!name) return null;
  const date = typeof day.date === "string" ? day.date.trim() : "";
  const parts = parseISODateParts(date);
  if (!parts) return null;
  if (typeof day.isOffDay !== "boolean") return null;
  return {
    name,
    date,
    isOffDay: day.isOffDay,
    ms: parts.ms
  };
}

function normalizeOfficialDays(days) {
  if (!Array.isArray(days) || days.length === 0) return [];
  const seen = new Set();
  const normalizedDays = [];
  for (const rawDay of days) {
    const day = normalizeOfficialDay(rawDay);
    if (!day) continue;
    const dedupeKey = `${day.date}|${day.name}|${day.isOffDay ? 1 : 0}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    normalizedDays.push(day);
  }
  normalizedDays.sort(
    (a, b) =>
      a.ms - b.ms ||
      a.name.localeCompare(b.name) ||
      (a.isOffDay === b.isOffDay ? 0 : a.isOffDay ? -1 : 1)
  );
  return normalizedDays;
}

function normalizeHolidayCnYearData(data, year) {
  if (!data || typeof data !== "object") {
    throw new Error(`holiday-cn ${year} payload is not an object`);
  }
  if (Number(data.year) !== Number(year)) {
    throw new Error(`holiday-cn year mismatch: expected ${year}, got ${data.year}`);
  }
  if (!Array.isArray(data.days)) {
    throw new Error(`holiday-cn ${year} missing days array`);
  }
  const days = normalizeOfficialDays(data.days);
  if (days.length === 0) {
    throw new Error(`holiday-cn ${year} has no valid days`);
  }
  return { days };
}

function buildOfficialFingerprint(years) {
  if (!years || typeof years !== "object") return "none";
  const keys = Object.keys(years).sort();
  const chunks = [];
  for (const key of keys) {
    const yearData = years[key];
    if (!yearData || !Array.isArray(yearData.days) || yearData.days.length === 0) {
      continue;
    }
    const dayParts = yearData.days.map(
      day => `${day.date}:${day.name}:${day.isOffDay ? 1 : 0}`
    );
    chunks.push(`${key}=${dayParts.join(",")}`);
  }
  return chunks.length > 0 ? hashString(chunks.join("|")) : "none";
}

function isTrustedOfficialCacheYears(years) {
  if (!years || typeof years !== "object" || Array.isArray(years)) return false;
  for (const [yearKey, yearData] of Object.entries(years)) {
    if (!/^\d{4}$/.test(yearKey)) return false;
    if (!yearData || typeof yearData !== "object" || !Array.isArray(yearData.days) || yearData.days.length === 0) {
      return false;
    }
    for (const day of yearData.days) {
      if (
        !day ||
        typeof day !== "object" ||
        typeof day.name !== "string" ||
        !day.name.trim() ||
        typeof day.date !== "string" ||
        !ISO_DATE_RE.test(day.date) ||
        typeof day.isOffDay !== "boolean" ||
        !Number.isFinite(day.ms) ||
        day.ms !== isoToMs(day.date)
      ) {
        return false;
      }
    }
  }
  return true;
}

function sanitizeOfficialYears(rawYears) {
  const clean = {};
  if (!rawYears || typeof rawYears !== "object") return clean;
  for (const [yearKey, yearData] of Object.entries(rawYears)) {
    if (!/^\d{4}$/.test(yearKey)) continue;
    if (!yearData || !Array.isArray(yearData.days)) continue;
    const days = normalizeOfficialDays(yearData.days);
    if (days.length > 0) {
      clean[yearKey] = { days };
    }
  }
  return clean;
}

function officialRequiredYears(currentYear, todayIso) {
  const parts = parseISODateParts(todayIso);
  const m = parts ? parts.m : 0;
  if (m === 1) return [currentYear - 1, currentYear];
  if (m === 12) return [currentYear, currentYear + 1];
  return [currentYear];
}

function pruneOfficialYears(years, keepYearsSet) {
  const out = {};
  if (!years || typeof years !== "object") return out;
  for (const [yearKey, yearData] of Object.entries(years)) {
    if (!keepYearsSet.has(Number(yearKey))) continue;
    if (yearData && Array.isArray(yearData.days) && yearData.days.length > 0) {
      out[yearKey] = yearData;
    }
  }
  return out;
}

function pruneCheckedDateByYear(checkedDateByYear, validYears) {
  const out = {};
  if (!checkedDateByYear || typeof checkedDateByYear !== "object") return out;
  for (const [yearKey, dateStr] of Object.entries(checkedDateByYear)) {
    if (!validYears[yearKey]) continue;
    if (typeof dateStr === "string" && parseISODateParts(dateStr)) {
      out[yearKey] = dateStr;
    }
  }
  return out;
}

function pruneRetryAfterByYear(retryAfterByYear, keepYearsSet, nowMs) {
  const out = {};
  if (!retryAfterByYear || typeof retryAfterByYear !== "object") return out;
  for (const [yearKey, retryAt] of Object.entries(retryAfterByYear)) {
    if (!keepYearsSet.has(Number(yearKey))) continue;
    const ts = Number(retryAt);
    if (Number.isFinite(ts) && ts > nowMs) {
      out[yearKey] = ts;
    }
  }
  return out;
}

function shallowEqualRecord(a, b) {
  const objA = a && typeof a === "object" ? a : {};
  const objB = b && typeof b === "object" ? b : {};
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (objA[k] !== objB[k]) return false;
  }
  return true;
}

function isPlainRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function shouldSaveOfficialCache(oldCache, newCache) {
  if (!isPlainRecord(oldCache)) return true;
  if (oldCache.version !== newCache.version) return true;
  if (oldCache.fingerprint !== newCache.fingerprint) return true;
  if (!isPlainRecord(oldCache.checkedDateByYear) || !isPlainRecord(oldCache.retryAfterByYear)) {
    return true;
  }
  const oldYearKeys = Object.keys(oldCache.years || {}).sort().join(",");
  const newYearKeys = Object.keys(newCache.years || {}).sort().join(",");
  if (oldYearKeys !== newYearKeys) return true;
  if (!shallowEqualRecord(oldCache.checkedDateByYear, newCache.checkedDateByYear)) return true;
  if (!shallowEqualRecord(oldCache.retryAfterByYear, newCache.retryAfterByYear)) return true;
  return false;
}

function buildOfficialCacheRecord(years, checkedDateByYear, retryAfterByYear, currentYear, todayIso, nowMs) {
  const keepSet = new Set(officialRequiredYears(currentYear, todayIso));
  const prunedYears = pruneOfficialYears(years, keepSet);
  const prunedChecked = pruneCheckedDateByYear(checkedDateByYear, prunedYears);
  const prunedRetry = pruneRetryAfterByYear(retryAfterByYear, keepSet, nowMs);
  return {
    version: OFFICIAL_HOLIDAY_STORAGE_VERSION,
    fingerprint: buildOfficialFingerprint(prunedYears),
    checkedDateByYear: prunedChecked,
    retryAfterByYear: prunedRetry,
    years: prunedYears
  };
}

function readOfficialHolidayCache(currentYear, todayIso, nowMs) {
  const raw = surgeStorage.getJSON(OFFICIAL_HOLIDAY_KEY);
  if (!raw || typeof raw !== "object" || raw.version !== OFFICIAL_HOLIDAY_STORAGE_VERSION) {
    return null;
  }
  if (!raw.years || typeof raw.years !== "object") {
    return null;
  }

  const trusted = isTrustedOfficialCacheYears(raw.years);
  const trustedYears = trusted ? raw.years : sanitizeOfficialYears(raw.years);

  const normalized = buildOfficialCacheRecord(
    trustedYears,
    raw.checkedDateByYear,
    raw.retryAfterByYear,
    currentYear,
    todayIso,
    nowMs
  );

  if (!trusted || shouldSaveOfficialCache(raw, normalized)) {
    surgeStorage.setJSON(OFFICIAL_HOLIDAY_KEY, normalized);
  }
  return normalized;
}

function isOfficialYearCacheFresh(cache, year, todayIso) {
  const yearKey = String(year);
  const yearData = cache?.years?.[yearKey];
  if (!yearData || !Array.isArray(yearData.days) || yearData.days.length === 0) {
    return false;
  }
  const checkedDate = cache?.checkedDateByYear?.[yearKey];
  const checkedMs = isoToMs(checkedDate);
  const todayMs = isoToMs(todayIso);
  if (!Number.isFinite(checkedMs) || !Number.isFinite(todayMs)) {
    return false;
  }
  const diff = todayMs - checkedMs;
  return diff >= 0 && diff < OFFICIAL_REFRESH_INTERVAL_MS;
}

function isOfficialYearRetryBlocked(cache, year, nowMs) {
  const retryAt = Number(cache?.retryAfterByYear?.[String(year)]);
  return Number.isFinite(retryAt) && retryAt > nowMs;
}

function resolveOfficialRefreshPlan(cache, currentYear, todayIso, nowMs, hasCachedBaseData, forceStaleRefresh) {
  const requiredYears = officialRequiredYears(currentYear, todayIso);
  const missingRequiredYears = [];
  const staleRequiredYears = [];

  for (const year of requiredYears) {
    const yearKey = String(year);
    const hasDays = Boolean(cache?.years?.[yearKey]?.days?.length);
    if (!hasDays) {
      missingRequiredYears.push(year);
    } else if (!isOfficialYearCacheFresh(cache, year, todayIso)) {
      staleRequiredYears.push(year);
    }
  }

  const fetchableMissing = missingRequiredYears.filter(y => !isOfficialYearRetryBlocked(cache, y, nowMs));
  const fetchableStale = staleRequiredYears.filter(y => !isOfficialYearRetryBlocked(cache, y, nowMs));
  const blockingYearsToFetch = [...fetchableMissing, ...fetchableStale];

  const shouldRefresh =
    fetchableMissing.length > 0 ||
    (blockingYearsToFetch.length > 0 && (!hasCachedBaseData || forceStaleRefresh));

  return {
    requiredYears,
    blockingYearsToFetch: shouldRefresh ? blockingYearsToFetch : []
  };
}

async function fetchOfficialHolidayYear(year, timeoutSec) {
  const url = `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`;
  const data = await httpGetJSON(url, timeoutSec);
  return normalizeHolidayCnYearData(data, year);
}

async function refreshOfficialHolidayYears(oldCache, yearsToFetch, currentYear, todayIso, nowMs, timeoutSec) {
  const years = { ...(oldCache?.years || {}) };
  const checkedDateByYear = { ...(oldCache?.checkedDateByYear || {}) };
  const retryAfterByYear = { ...(oldCache?.retryAfterByYear || {}) };

  const settled = await Promise.allSettled(
    yearsToFetch.map(async year => ({
      year,
      data: await fetchOfficialHolidayYear(year, timeoutSec)
    }))
  );

  for (let i = 0; i < settled.length; i++) {
    const year = yearsToFetch[i];
    const key = String(year);
    const item = settled[i];
    if (item.status === "fulfilled") {
      years[key] = item.value.data;
      checkedDateByYear[key] = todayIso;
      delete retryAfterByYear[key];
    } else {
      retryAfterByYear[key] = nowMs + OFFICIAL_FAILED_RETRY_INTERVAL_MS;
      warnLog(`failed to fetch holiday-cn ${year}:`, item.reason);
    }
  }

  const nextCache = buildOfficialCacheRecord(
    years,
    checkedDateByYear,
    retryAfterByYear,
    currentYear,
    todayIso,
    nowMs
  );

  if (shouldSaveOfficialCache(oldCache, nextCache)) {
    surgeStorage.setJSON(OFFICIAL_HOLIDAY_KEY, nextCache);
  }
  return nextCache;
}

function buildOfficialHolidayRangesFromNormalizedDays(days) {
  if (!Array.isArray(days) || days.length === 0) return [];
  const offDays = [];
  for (const day of days) {
    if (
      !day ||
      day.isOffDay !== true ||
      typeof day.name !== "string" ||
      !day.name.trim() ||
      typeof day.date !== "string"
    ) {
      continue;
    }
    const ms = Number.isFinite(day.ms) ? day.ms : isoToMs(day.date);
    if (!Number.isFinite(ms)) continue;
    offDays.push({
      name: day.name.trim(),
      date: day.date,
      isOffDay: true,
      ms
    });
  }

  offDays.sort((a, b) => a.ms - b.ms);
  const groups = [];
  for (const day of offDays) {
    const last = groups[groups.length - 1];
    if (last && last.name === day.name && day.ms - last.endMs === DAY_MS) {
      last.end = day.date;
      last.endMs = day.ms;
      last.duration += 1;
    } else if (!last || last.name !== day.name || last.endMs !== day.ms) {
      groups.push({
        name: day.name,
        start: day.date,
        end: day.date,
        startMs: day.ms,
        endMs: day.ms,
        duration: 1
      });
    }
  }

  return groups.map(group => ({
    name: group.name,
    start: group.start,
    end: group.end,
    startMs: group.startMs,
    endMs: group.endMs,
    startYMD: msToYMD(group.startMs),
    duration: group.duration
  }));
}

function buildOfficialHolidayRangeCache(officialHolidayCache) {
  const years = officialHolidayCache?.years;
  if (!years || typeof years !== "object") return [];
  const allDays = [];
  for (const yearData of Object.values(years)) {
    if (!yearData || !Array.isArray(yearData.days)) continue;
    for (const day of yearData.days) {
      allDays.push(day);
    }
  }
  return buildOfficialHolidayRangesFromNormalizedDays(allDays);
}

function isValidOfficialRange(range) {
  return Boolean(
    range &&
      typeof range.name === "string" &&
      range.name.trim() &&
      Number.isFinite(Number(range.startMs)) &&
      Number.isFinite(Number(range.endMs)) &&
      Number(range.duration) >= 1
  );
}

function officialRangeOverlapsYear(range, year) {
  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year, 11, 31);
  return range.startMs <= yearEnd && range.endMs >= yearStart;
}

function getOfficialLegalHolidaysFromRanges(officialRanges, year) {
  if (!Array.isArray(officialRanges) || officialRanges.length === 0) return null;
  const rows = officialRanges
    .filter(range => isValidOfficialRange(range) && officialRangeOverlapsYear(range, year))
    .map(range => {
      const startMs = Number(range.startMs);
      const ymd = range.startYMD || msToYMD(startMs);
      return [range.name.trim(), ymd, Number(range.duration), "official", startMs];
    })
    .filter(row => row[1]);
  return rows.length > 0 ? rows : null;
}

function officialRowDistanceToFallback(row, fallbackMs) {
  const startMs = Number.isFinite(Number(row?.[4])) ? Number(row[4]) : slashYMDToMs(row?.[1]);
  const duration = Number(row?.[2]) || 1;
  if (!Number.isFinite(startMs)) return Infinity;
  if (!Number.isFinite(fallbackMs)) return 0;
  const endMs = startMs + (Math.max(1, duration) - 1) * DAY_MS;
  if (fallbackMs >= startMs && fallbackMs <= endMs) return 0;
  return Math.min(Math.abs(fallbackMs - startMs), Math.abs(fallbackMs - endMs));
}

function toHolidayRowMeta(row) {
  if (
    !Array.isArray(row) ||
    typeof row[0] !== "string" ||
    !row[0].trim() ||
    typeof row[1] !== "string"
  ) {
    return null;
  }
  const name = row[0].trim();
  const parts = splitHolidayNames(name);
  const startMsFromRow = Number(row[4]);
  return {
    row,
    name,
    parts,
    partSet: new Set(parts),
    startMs: Number.isFinite(startMsFromRow) ? startMsFromRow : slashYMDToMs(row[1])
  };
}

function buildHolidayRowMetas(rows, keepInvalid = false) {
  if (!Array.isArray(rows)) return [];
  const metas = [];
  for (const row of rows) {
    const meta = toHolidayRowMeta(row);
    if (meta) {
      metas.push(meta);
    } else if (keepInvalid) {
      metas.push({
        row,
        name: "",
        parts: EMPTY_HOLIDAY_NAME_PARTS,
        partSet: null,
        startMs: NaN
      });
    }
  }
  return metas;
}

function findBestOfficialMatchIndex(officialRows, usedOfficialIndexes, fallback) {
  let bestIndex = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < officialRows.length; i++) {
    if (usedOfficialIndexes.has(i)) continue;
    const official = officialRows[i];
    if (!partsIntersect(official.parts, fallback.partSet)) continue;
    const distance = officialRowDistanceToFallback(official.row, fallback.startMs);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function mergeLegalHolidays(fallbackLegal, officialLegal) {
  if (!Array.isArray(fallbackLegal)) {
    return Array.isArray(officialLegal) ? [...officialLegal] : [];
  }
  if (!Array.isArray(officialLegal) || officialLegal.length === 0) {
    return [...fallbackLegal];
  }
  const officialRows = buildHolidayRowMetas(officialLegal);
  if (officialRows.length === 0) return [...fallbackLegal];

  const fallbackRows = buildHolidayRowMetas(fallbackLegal, true);
  const merged = [];
  const usedOfficialIndexes = new Set();
  const coveredFallbackTokens = new Set();
  const fallbackTokenSet = new Set();

  for (const fb of fallbackRows) {
    for (const part of fb.parts) fallbackTokenSet.add(part);
  }

  for (const fb of fallbackRows) {
    if (!fb.name) {
      merged.push(fb.row);
      continue;
    }
    if (holidayNameMatchesTokenSet(fb.name, coveredFallbackTokens)) {
      continue;
    }
    const bestIndex = findBestOfficialMatchIndex(officialRows, usedOfficialIndexes, fb);
    if (bestIndex >= 0) {
      const official = officialRows[bestIndex];
      usedOfficialIndexes.add(bestIndex);
      for (const part of official.parts) coveredFallbackTokens.add(part);
      merged.push(official.row);
    } else {
      merged.push(fb.row);
    }
  }

  for (let i = 0; i < officialRows.length; i++) {
    if (usedOfficialIndexes.has(i)) continue;
    if (!partsIntersect(officialRows[i].parts, fallbackTokenSet)) {
      merged.push(officialRows[i].row);
    }
  }
  return merged;
}

function getOfficialDayInfo(officialHolidayCache, todayIso) {
  const years = officialHolidayCache?.years;
  if (!years || typeof years !== "object" || !todayIso) return null;
  const yearKey = todayIso.slice(0, 4);
  const candidates = [];
  if (years[yearKey]?.days) candidates.push(years[yearKey].days);
  for (const [k, v] of Object.entries(years)) {
    if (k !== yearKey && Array.isArray(v?.days)) {
      candidates.push(v.days);
    }
  }

  let matchedWorkday = null;
  for (const days of candidates) {
    for (const day of days) {
      if (day?.date !== todayIso) continue;
      if (day.isOffDay === true) return day;
      if (!matchedWorkday && day.isOffDay === false) matchedWorkday = day;
    }
  }
  return matchedWorkday;
}

function parseExclusiveDateSpec(rawDate) {
  let raw = String(rawDate ?? "").trim();
  if (!raw) return null;

  let calendar = "solar";
  if (LUNAR_PREFIX_RE.test(raw)) {
    calendar = "lunar";
    raw = raw.replace(LUNAR_PREFIX_RE, "").trim();
  }
  // 兼容连字符写法（如 5-20 / 2026-10-1）
  raw = raw.replace(/-/g, "/");

  const annualMatch = ANNUAL_SLASH_DATE_RE.exec(raw);
  if (annualMatch) {
    const month = Number(annualMatch[1]);
    const day = Number(annualMatch[2]);
    if (calendar === "lunar") {
      if (month < 1 || month > 12 || day < 1 || day > 30) return null;
      return { calendar: "lunar", kind: "annual", month, day };
    }
    if (!isValidMonthDay(2000, month, day)) return null;
    return { calendar: "solar", kind: "annual", month, day };
  }

  const onceMatch = ONCE_SLASH_DATE_RE.exec(raw);
  if (onceMatch) {
    const year = Number(onceMatch[1]);
    const month = Number(onceMatch[2]);
    const day = Number(onceMatch[3]);
    if (calendar === "lunar") {
      if (!isValidLunarYear(year) || month < 1 || month > 12 || day < 1 || day > 30) {
        return null;
      }
      return { calendar: "lunar", kind: "once", year, month, day };
    }
    if (year < 1900 || year > 9999 || !isValidMonthDay(year, month, day)) return null;
    return { calendar: "solar", kind: "once", year, month, day };
  }

  return null;
}

function parseCountdownUserConfig(normalizedEnv) {
  const enablePrioritySort = normalizedEnv.ENABLE_PRIORITY_SORT !== "0";
  const enableExclusiveWeight = normalizedEnv.ENABLE_EXCLUSIVE_WEIGHT !== "0";
  const pinnedHolidays = Array.from(
    new Set(splitNameList(normalizedEnv.PINNED_HOLIDAY || ""))
  );

  const customDays = [];
  for (let i = 1; i <= 6; i++) {
    const name = String(normalizedEnv[`EXCLUSIVE_NAME_${i}`] ?? "").trim();
    const dateStr = String(normalizedEnv[`EXCLUSIVE_DATE_${i}`] ?? "").trim();
    const spec = parseExclusiveDateSpec(dateStr);
    if (name && spec) {
      customDays.push({ name, spec });
    }
  }

  return {
    enablePrioritySort,
    enableExclusiveWeight,
    pinnedHolidays,
    customDays
  };
}

function createLunarToSolarConverter() {
  return (y, m, d) => {
    if (!isValidLunarYear(y) || !Number.isInteger(m) || m < 1 || m > 12) return null;
    const maxDay = Lunar.mDays(y, m);
    if (!Number.isInteger(d) || d < 1 || d > maxDay) return null;
    ensureLunarCumulative(y);
    let off = lunarCumulativeCache.off[y - MIN_LUNAR_YEAR];
    const info = Lunar.info[y - MIN_LUNAR_YEAR];
    const lp = info & 0xf;
    for (let i = 1; i < m; i++) {
      off += Lunar.mDays(y, i);
      if (lp > 0 && i === lp) {
        off += info & 0x10000 ? 30 : 29;
      }
    }
    return msToYMD(LUNAR_BASE_MS + (off + d - 1) * DAY_MS);
  };
}

function getSolarTermYMD(y, n) {
  if (!Number.isInteger(y) || y < 1900 || y > 2100) return null;
  const termDate = Lunar.term(y, n);
  const bjTerm = new Date(termDate.getTime() + BJ_OFFSET_MS);
  return YMD(bjTerm.getUTCFullYear(), bjTerm.getUTCMonth() + 1, bjTerm.getUTCDate());
}

function wDay(y, m, nth, weekday) {
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  return isValidMonthDay(y, m, day) ? YMD(y, m, day) : null;
}

function resolveLunarExclusiveYMD(l2s, year, month, day, allowShortMonthFallback = false) {
  if (!isValidLunarYear(year)) return null;
  const maxDay = Lunar.mDays(year, month);
  if (!maxDay) return null;
  const actualDay = allowShortMonthFallback && day === 30 && maxDay === 29 ? 29 : day;
  if (actualDay > maxDay) return null;
  return l2s(year, month, actualDay);
}

function buildYearFestivals(y, officialRanges, customDays, l2s) {
  const fallbackLegal = [
    ["元旦", YMD(y, 1, 1), 1],
    ["春节", l2s(y, 1, 1), 3],
    ["清明节", getSolarTermYMD(y, 7), 1],
    ["劳动节", YMD(y, 5, 1), 1],
    ["端午节", l2s(y, 5, 5), 1],
    ["中秋节", l2s(y, 8, 15), 1],
    ["国庆节", YMD(y, 10, 1), 3]
  ];

  const officialLegal = getOfficialLegalHolidaysFromRanges(officialRanges, y);
  const legal = mergeLegalHolidays(fallbackLegal, officialLegal);

  const chuxiYMD = isValidLunarYear(y) ? l2s(y, 12, Lunar.mDays(y, 12)) : null;
  const folk = [
    ["元宵节", l2s(y, 1, 15), 1],
    ["龙抬头", l2s(y, 2, 2), 1],
    ["七夕节", l2s(y, 7, 7), 1],
    ["中元节", l2s(y, 7, 15), 1],
    ["重阳节", l2s(y, 9, 9), 1],
    ["寒衣节", l2s(y, 10, 1), 1],
    ["腊八节", l2s(y, 12, 8), 1],
    ["小年", l2s(y, 12, 23), 1],
    ["除夕", chuxiYMD, 1]
  ];

  const intl = [
    ["情人节", YMD(y, 2, 14), 1],
    ["妇女节", YMD(y, 3, 8), 1],
    ["母亲节", wDay(y, 5, 2, 0), 1],
    ["儿童节", YMD(y, 6, 1), 1],
    ["父亲节", wDay(y, 6, 3, 0), 1],
    ["万圣节", YMD(y, 10, 31), 1],
    ["感恩节", wDay(y, 11, 4, 4), 1],
    ["平安夜", YMD(y, 12, 24), 1],
    ["圣诞节", YMD(y, 12, 25), 1]
  ];

  const exclusive = [];
  for (const item of customDays) {
    if (item.spec.kind !== "annual") continue;
    let ymd = null;
    if (item.spec.calendar === "lunar") {
      ymd = resolveLunarExclusiveYMD(l2s, y, item.spec.month, item.spec.day, true);
    } else if (isValidMonthDay(y, item.spec.month, item.spec.day)) {
      ymd = YMD(y, item.spec.month, item.spec.day);
    }
    if (ymd) {
      exclusive.push([item.name, ymd, 1, "custom"]);
    }
  }

  return { legal, folk, intl, exclusive };
}

function createPriorityResolver(enablePrioritySort, enableExclusiveWeight) {
  return (cat, name, sourceKind) => {
    if (!enablePrioritySort) return 1;
    if (sourceKind === "custom") {
      return enableExclusiveWeight ? 9 : BASE_PRIORITY[cat] ?? 2;
    }
    return getSpecialHolidayPriority(name) ?? BASE_PRIORITY[cat] ?? 1;
  };
}

function compareTodayItems(a, b) {
  return (
    b.priority - a.priority ||
    b.diff - a.diff ||
    String(a.name).localeCompare(String(b.name))
  );
}

function addTodayCountdownItem(state, name, diff, priority, duration = 1) {
  const key = String(name);
  const nextItem = {
    name,
    diff,
    duration: Math.max(1, Number(duration) || 1),
    priority: priority + 100
  };
  const prev = state.todayItemMap.get(key);
  if (
    !prev ||
    nextItem.priority > prev.priority ||
    (nextItem.priority === prev.priority && nextItem.diff > prev.diff) ||
    (nextItem.priority === prev.priority &&
      nextItem.diff === prev.diff &&
      nextItem.duration > prev.duration)
  ) {
    state.todayItemMap.set(key, nextItem);
  }
}

function addCategoryCountdownItem(state, cat, name, diff, priority, duration = 1) {
  const bucket = state.rawResult[cat];
  if (!bucket) return;
  const key = String(name);
  const nextItem = {
    name,
    diff,
    duration: Math.max(1, Number(duration) || 1),
    priority
  };
  const prev = bucket.get(key);
  if (
    !prev ||
    nextItem.diff < prev.diff ||
    (nextItem.diff === prev.diff && nextItem.priority > prev.priority)
  ) {
    bucket.set(key, nextItem);
  }
}

function updatePinnedCountdown(state, name, diff, duration) {
  if (diff <= 0 || state.pinnedHolidayPartsMap.size === 0) return;
  const nameParts = splitHolidayNames(name);
  if (nameParts.length === 0) return;
  const namePartSet = new Set(nameParts);

  for (const [pinnedName, pinnedParts] of state.pinnedHolidayPartsMap.entries()) {
    if (!partsIntersect(pinnedParts, namePartSet)) continue;
    const prev = state.pinnedMap.get(pinnedName);
    if (!prev || diff < prev.diff) {
      state.pinnedMap.set(pinnedName, {
        name: pinnedName,
        diff,
        duration: Math.max(1, Number(duration) || 1)
      });
    }
  }
}

function finalizeCountdownResult(state, enablePrioritySort) {
  const sortedToday = Array.from(state.todayItemMap.values()).sort(compareTodayItems);
  const dedupedToday = dedupeHolidayItemsByToken(sortedToday);
  const todayItems = sortedToday.map(toPublicCountdownItem);
  const todayNoticeText = dedupedToday.length > 0 ? formatTodayFestGroup(dedupedToday) : "";

  const todayFestTokenSet = new Set();
  for (const item of dedupedToday) {
    addHolidayNameTokens(todayFestTokenSet, item.name);
  }

  const pinnedData = Array.from(state.pinnedMap.values())
    .filter(item => !holidayNameMatchesTokenSet(item.name, todayFestTokenSet))
    .sort((a, b) => {
      const diffCmp = a.diff - b.diff;
      if (diffCmp !== 0) return diffCmp;
      const orderA = state.pinnedOrderMap.get(a.name) ?? Number.MAX_SAFE_INTEGER;
      const orderB = state.pinnedOrderMap.get(b.name) ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB || String(a.name).localeCompare(String(b.name));
    })
    .map(toPublicCountdownItem);

  const activePinnedTokenSet = new Set();
  for (const item of pinnedData) {
    addHolidayNameTokens(activePinnedTokenSet, item.name);
  }

  const result = {};
  for (const cat of CATEGORY_KEYS) {
    const items = Array.from(state.rawResult[cat].values())
      .filter(
        item =>
          !holidayNameMatchesTokenSet(item.name, todayFestTokenSet) &&
          !holidayNameMatchesTokenSet(item.name, activePinnedTokenSet)
      )
      .sort((a, b) => {
        const diffCmp = a.diff - b.diff;
        if (diffCmp !== 0) return diffCmp;
        if (enablePrioritySort) {
          const prioCmp = b.priority - a.priority;
          if (prioCmp !== 0) return prioCmp;
        }
        return String(a.name).localeCompare(String(b.name));
      })
      .slice(0, CATEGORY_CACHE_LIMIT)
      .map(toPublicCountdownItem);
    result[cat] = items;
  }

  return {
    result,
    todayNoticeText,
    pinnedData,
    todayItems
  };
}

function buildCountdownData(dateCtx, normalizedEnv, officialHolidayCache) {
  const userConfig = parseCountdownUserConfig(normalizedEnv);
  const resolvePriority = createPriorityResolver(
    userConfig.enablePrioritySort,
    userConfig.enableExclusiveWeight
  );
  const officialRanges = buildOfficialHolidayRangeCache(officialHolidayCache);
  const l2s = createLunarToSolarConverter();

  const pinnedHolidayPartsMap = new Map();
  const pinnedOrderMap = new Map();
  userConfig.pinnedHolidays.forEach((pinned, idx) => {
    const parts = splitHolidayNames(pinned);
    if (parts.length > 0) {
      pinnedHolidayPartsMap.set(pinned, parts);
      pinnedOrderMap.set(pinned, idx);
    }
  });

  const state = {
    rawResult: {
      legal: new Map(),
      folk: new Map(),
      intl: new Map(),
      exclusive: new Map()
    },
    todayItemMap: new Map(),
    pinnedMap: new Map(),
    pinnedOrderMap,
    pinnedHolidayPartsMap
  };

  const slashCache = new Map();
  const parseYMD = dateStr => {
    if (!dateStr) return null;
    if (slashCache.has(dateStr)) return slashCache.get(dateStr);
    const parsed = parseSlashYMDParts(dateStr);
    slashCache.set(dateStr, parsed);
    return parsed;
  };

  const addCountdownFestival = (cat, row) => {
    if (!Array.isArray(row)) return;
    const name = typeof row[0] === "string" ? row[0].trim() : "";
    const dateStr = typeof row[1] === "string" ? row[1].trim() : "";
    if (!name || !dateStr) return;

    const safeDuration = Math.max(1, Number(row[2]) || 1);
    const sourceKind = row[3] || "builtin";
    const msFromRow = Number(row[4]);
    let dateMs = Number.isFinite(msFromRow) ? msFromRow : NaN;
    if (!Number.isFinite(dateMs)) {
      const parsed = parseYMD(dateStr);
      if (!parsed) return;
      dateMs = parsed.ms;
    }

    const diff = Math.round((dateMs - dateCtx.todayMs) / DAY_MS);
    if (diff <= -safeDuration) return;

    const priority = resolvePriority(cat, name, sourceKind);
    if (diff <= 0) {
      addTodayCountdownItem(state, name, diff, priority, safeDuration);
    } else {
      addCategoryCountdownItem(state, cat, name, diff, priority, safeDuration);
      updatePinnedCountdown(state, name, diff, safeDuration);
    }
  };

  const yearsToScan = [dateCtx.Y - 1, dateCtx.Y, dateCtx.Y + 1];
  for (const y of yearsToScan) {
    const festivals = buildYearFestivals(y, officialRanges, userConfig.customDays, l2s);
    for (const cat of CATEGORY_KEYS) {
      for (const row of festivals[cat]) {
        addCountdownFestival(cat, row);
      }
    }
  }

  for (const item of userConfig.customDays) {
    if (item.spec.kind !== "once") continue;
    let ymd = null;
    if (item.spec.calendar === "lunar") {
      ymd = resolveLunarExclusiveYMD(l2s, item.spec.year, item.spec.month, item.spec.day);
    } else {
      ymd = YMD(item.spec.year, item.spec.month, item.spec.day);
    }
    if (ymd) {
      addCountdownFestival("exclusive", [item.name, ymd, 1, "custom"]);
    }
  }

  return finalizeCountdownResult(state, userConfig.enablePrioritySort);
}

function isValidCountdownItem(item) {
  return Boolean(
    item &&
      typeof item === "object" &&
      typeof item.name === "string" &&
      item.name.trim() &&
      Number.isFinite(Number(item.diff)) &&
      Number.isFinite(Number(item.duration))
  );
}

function isValidBaseDailyPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (!payload.result || typeof payload.result !== "object") return false;
  for (const cat of CATEGORY_KEYS) {
    if (!Array.isArray(payload.result[cat])) return false;
    if (!payload.result[cat].every(isValidCountdownItem)) return false;
  }
  if (typeof payload.todayNoticeText !== "string") return false;
  if (!Array.isArray(payload.pinnedData) || !payload.pinnedData.every(isValidCountdownItem)) {
    return false;
  }
  if (!Array.isArray(payload.todayItems) || !payload.todayItems.every(isValidCountdownItem)) {
    return false;
  }
  return true;
}

function buildCompositeEnvFingerprint(dataEnvFingerprint, officialHolidayCache) {
  const officialFp = officialHolidayCache?.fingerprint || "none";
  return `${dataEnvFingerprint}|official=${officialFp}`;
}

function createDailyCacheReader(todayStr) {
  let loaded = false;
  let record = null;

  const loadRecord = () => {
    if (!loaded) {
      record = surgeStorage.getJSON(BASE_CACHE_KEY);
      loaded = true;
    }
    return record;
  };

  return {
    read(envFingerprint) {
      const stored = loadRecord();
      if (!stored || typeof stored !== "object") return null;
      if (stored.version !== DAILY_CACHE_VERSION) return null;
      if (stored.date !== todayStr) return null;
      if (stored.envFingerprint !== envFingerprint) return null;
      if (!isValidBaseDailyPayload(stored.payload)) return null;
      return stored.payload;
    },
    save(envFingerprint, payload) {
      const nextRecord = {
        version: DAILY_CACHE_VERSION,
        date: todayStr,
        envFingerprint,
        payload
      };
      if (surgeStorage.setJSON(BASE_CACHE_KEY, nextRecord)) {
        loaded = true;
        record = nextRecord;
      }
    }
  };
}

function notifyTodayIfNeeded(enableNotify, dateCtx, todayItems, isCron) {
  if (!enableNotify) return { sent: false, reason: "disabled" };
  if (typeof $notification === "undefined" || !$notification?.post) {
    return { sent: false, reason: "unavailable" };
  }
  if (!isCron && dateCtx.hour < NOTIFY_PANEL_START_HOUR) {
    return { sent: false, reason: "before_morning_window" };
  }
  if (!Array.isArray(todayItems) || todayItems.length === 0) {
    return { sent: false, reason: "no_today_items" };
  }

  const todayIso = dateCtx.todayIso;
  const todayStartNames = Array.from(
    new Set(
      todayItems
        .filter(item => Number(item.diff) === 0 && typeof item.name === "string" && item.name.trim())
        .map(item => item.name.trim())
    )
  );
  if (todayStartNames.length === 0) {
    return { sent: false, reason: "no_first_day_items" };
  }

  const nowMs = Date.now();
  const prevState = surgeStorage.getJSON(NOTIFY_KEY);
  const sameDay = prevState && prevState.date === todayIso;
  const prevNotified = sameDay
    ? Array.isArray(prevState.notifiedNames)
      ? prevState.notifiedNames
      : prevState.failed !== true && Array.isArray(prevState.names)
        ? prevState.names
        : []
    : [];

  if (sameDay && prevState.failed === true && Number(prevState.retryAfter) > nowMs) {
    return { sent: false, reason: "retry_backoff" };
  }

  const notifiedSet = new Set(prevNotified);
  const notifiedTokenSet = new Set();
  for (const name of prevNotified) {
    addHolidayNameTokens(notifiedTokenSet, name);
  }

  const pendingNames = todayStartNames.filter(
    name => !notifiedSet.has(name) && !holidayNameMatchesTokenSet(name, notifiedTokenSet)
  );
  if (pendingNames.length === 0) {
    return { sent: false, reason: "already_notified" };
  }

  try {
    $notification.post("✨ 今日提醒", "", pendingNames.join("、"), { sound: true });
    const mergedNotified = Array.from(new Set([...prevNotified, ...pendingNames]));
    surgeStorage.setJSON(NOTIFY_KEY, {
      date: todayIso,
      names: todayStartNames,
      notifiedNames: mergedNotified,
      time: nowMs,
      failed: false
    });
    return { sent: true, names: pendingNames };
  } catch (e) {
    surgeStorage.setJSON(NOTIFY_KEY, {
      date: todayIso,
      names: todayStartNames,
      notifiedNames: prevNotified,
      time: nowMs,
      failed: true,
      retryAfter: nowMs + NOTIFY_FAILED_RETRY_INTERVAL_MS,
      error: truncateByCodePoint(e?.message || String(e), 120)
    });
    warnLog("failed to post notification:", e);
    return { sent: false, reason: "error" };
  }
}

function resolvePanelIconColor(enableAutoTheme, dateCtx, officialHolidayCache, todayItems) {
  if (!enableAutoTheme) return ICON_COLORS.workday;
  if (Array.isArray(todayItems) && todayItems.length > 0) {
    return ICON_COLORS.festival;
  }
  const officialDayInfo = getOfficialDayInfo(officialHolidayCache, dateCtx.todayIso);
  if (officialDayInfo) {
    return officialDayInfo.isOffDay ? ICON_COLORS.offday : ICON_COLORS.workday;
  }
  return dateCtx.isWeekend ? ICON_COLORS.offday : ICON_COLORS.workday;
}

function buildPanelOutput(baseData, enableAutoTheme, dateCtx, officialHolidayCache) {
  const title = baseData.todayNoticeText
    ? `✨ ${baseData.todayNoticeText}`
    : RANDOM_NOTICES[Math.floor(Math.random() * RANDOM_NOTICES.length)];

  const lines = [];
  const stickyText = buildPinnedStickyText(baseData.pinnedData);
  if (stickyText) {
    lines.push(`📌 置顶：${stickyText}`);
  }

  for (const cfg of CATEGORY_CONFIG) {
    const items = (baseData.result?.[cfg.key] || []).slice(0, CATEGORY_DISPLAY_LIMIT);
    if (items.length === 0) continue;
    lines.push(`${cfg.emoji} ${cfg.label}：${items.map(formatDisplayItem).join("，")}`);
  }

  const content = lines.length > 0 ? lines.join("\n") : "近期暂无倒计时";
  const iconColor = resolvePanelIconColor(
    enableAutoTheme,
    dateCtx,
    officialHolidayCache,
    baseData.todayItems
  );

  return {
    title,
    content,
    icon: "hourglass",
    "icon-color": iconColor
  };
}

async function runTimeCard() {
  const isCron = typeof $script !== "undefined" && $script?.type === "cron";
  const isManualRefresh = typeof $trigger !== "undefined" && $trigger === "button";
  const now = new Date();
  const nowMs = now.getTime();
  const dateCtx = getBeijingDateContext(now);

  const rawEnv = parseSurgeArgument(typeof $argument !== "undefined" ? $argument : "");
  const normalizedEnv = buildNormalizedEnv(rawEnv);
  const dataEnvFingerprint = buildEnvFingerprintFromNormalized(normalizedEnv);
  const enableAutoTheme = normalizedEnv.ENABLE_AUTO_THEME !== "0";
  const enableNotify = normalizedEnv.ENABLE_NOTIFY !== "0";

  const dailyCache = createDailyCacheReader(dateCtx.todayStr);
  let officialHolidayCache = readOfficialHolidayCache(dateCtx.Y, dateCtx.todayIso, nowMs);

  const readBaseByOfficialState = () => {
    const envFingerprint = buildCompositeEnvFingerprint(dataEnvFingerprint, officialHolidayCache);
    return {
      envFingerprint,
      cachedBaseData: dailyCache.read(envFingerprint)
    };
  };

  let { envFingerprint, cachedBaseData } = readBaseByOfficialState();
  const fallbackCachedBaseData = cachedBaseData;
  const fallbackEnvFingerprint = envFingerprint;

  const canFetchOfficial = typeof $httpClient !== "undefined" && Boolean($httpClient?.get);
  if (canFetchOfficial) {
    const plan = resolveOfficialRefreshPlan(
      officialHolidayCache,
      dateCtx.Y,
      dateCtx.todayIso,
      nowMs,
      Boolean(cachedBaseData),
      isCron || isManualRefresh
    );
    if (plan.blockingYearsToFetch.length > 0) {
      const timeoutSec = isCron ? CRON_HTTP_TIMEOUT_S : PANEL_HTTP_TIMEOUT_S;
      try {
        officialHolidayCache = await refreshOfficialHolidayYears(
          officialHolidayCache,
          plan.blockingYearsToFetch,
          dateCtx.Y,
          dateCtx.todayIso,
          nowMs,
          timeoutSec
        );
      } catch (e) {
        warnLog("official holiday refresh error:", e);
      }
      ({ envFingerprint, cachedBaseData } = readBaseByOfficialState());
      if (!cachedBaseData && fallbackCachedBaseData && envFingerprint === fallbackEnvFingerprint) {
        cachedBaseData = fallbackCachedBaseData;
      }
    }
  }

  let baseData = cachedBaseData;
  if (!baseData) {
    baseData = buildCountdownData(dateCtx, normalizedEnv, officialHolidayCache);
    dailyCache.save(envFingerprint, baseData);
  }

  const notifyRes = notifyTodayIfNeeded(enableNotify, dateCtx, baseData.todayItems, isCron);

  if (isCron) {
    console.log(
      `[TimeCard] cron done (${dateCtx.todayIso}), today=${baseData.todayNoticeText || "none"}, notify=${notifyRes.sent ? notifyRes.names.join("、") : notifyRes.reason}`
    );
    $done();
    return;
  }

  $done(buildPanelOutput(baseData, enableAutoTheme, dateCtx, officialHolidayCache));
}

(async () => {
  try {
    await runTimeCard();
  } catch (e) {
    warnLog("unhandled error:", e);
    const isCron = typeof $script !== "undefined" && $script?.type === "cron";
    if (isCron) {
      $done();
    } else {
      $done({
        title: "时光倒数加载失败",
        content: truncateByCodePoint(e?.message || "请检查脚本或参数配置", 80),
        icon: "exclamationmark.triangle.fill",
        "icon-color": ICON_COLORS.error
      });
    }
  }
})();