/**
 * =========================================
 * 📌 时光倒数 (Countdown) 小组件
 *
 * ✨ 主要功能：
 * • 尺寸适配：支持 Small、Medium、Large 三种组件尺寸，区分紧凑列表与定宽多行列表排版。
 * • 节日计算：内置农历算法数组，支持计算法定节假日、民俗节日、国际节日、金融交割/行权日的倒计时。
 * • 官方假期：法定分类优先拉取 NateScarlet/holiday-cn 上一年、当前年与下一年数据，按实际放假安排展示。
 * • 时区基准：采用 UTC+8 固定时区进行绝对时间计算。
 * • 自定义配置：支持通过环境变量设置最多 6 个专属纪念日，支持修改清明节及春/秋假的起始日期。
 * • 排序与显示：支持按倒数天数及分类优先级进行排序，支持指定节日跨分类置顶。
 * • 状态响应：根据工作日、周末、节假日当天状态切换背景渐变色；当天节日提示于中大号标题栏显示，小号于分类行内显示。
 * • 当天提醒：节日 / 专属日期 / 金融日期当天弹窗提醒，每天只弹一次。
 *
 * 🔗 作者: https://github.com/jnlaoshu/MySelf/tree/1c35eedff4e052e7dc4e9d87105e32f2490617cf/Egern/Widget
 * ⏱️ 更新时间: 2026.04.01 01:40
 * =========================================
 */

const RANDOM_NOTICES = [
  " 距离放假，还要摸鱼多少天？", " 坚持住，就快放假啦！", " 上班好累呀，下顿吃啥？",
  " 努力，我还能加班24小时！", " 躺平中，等放假", " 施主请回，此饼不吃",
  " 只有摸鱼才是赚老板的钱", " 小乌龟慢慢爬", " 加油，明天会更好！",
  " 生活本该如此轻松", " 好累，但还能坚持一会儿", " 快放假啦，期待放松的时光",
  " 给自己加个鸡腿！", " 佛系上班，一切随缘", " 我的理想是：不上班还有钱",
  " 放弃幻想，认清现状，低调搬砖", " 生活碎片，拼凑成诗", " 慢慢走，沿途的花都开了",
  " 没什么期待，也就没什么失望", " 所谓的成长，就是学会不抱希望",
  " 只要努力工作，老板的午餐就是我的", " 今天的任务是：不干活！", " 用力生活，用力摸鱼"
];

const C = {
  bgWorkday: [{ light: "#FFFFFF", dark: "#1C1C1E" }, { light: "#F2F2F7", dark: "#0C0C0E" }],
  bgWeekend: [{ light: "#F4F8FF", dark: "#111827" }, { light: "#E6F2FF", dark: "#0B0F19" }],
  bgFest: [{ light: "#FFFFFF", dark: "#1C1C1E" }, { light: "#F2F2F7", dark: "#0C0C0E" }],
  main: { light: "#1C1C1E", dark: "#FFFFFF" },
  sub: { light: "#48484A", dark: "#D1D1D6" },
  muted: { light: "#8E8E93", dark: "#8E8E93" },
  gold: { light: "#B58A28", dark: "#D6A53A" },
  red: { light: "#CA3B32", dark: "#FF453A" },
  blue: { light: "#3A5F85", dark: "#5E8EB8" },
  blue2: { light: "#007AFF", dark: "#0A84FF" },
  teal: { light: "#628C7B", dark: "#73A491" },
  green: { light: "#34C759", dark: "#30D158" },
  purple: { light: "#D14FE2", dark: "#CA31E1" },
  transparent: "#00000000"
};

const CATEGORY_CONFIG = [
  { key: "legal", label: "法定", icon: "building.columns.fill", color: C.red },
  { key: "folk", label: "民俗", icon: "moon.stars.fill", color: C.gold },
  { key: "intl", label: "国际", icon: "globe.americas.fill", color: C.blue },
  { key: "exclusive", label: "专属", icon: "gift.fill", color: C.teal }
];

const basePriority = {
  legal: 3,
  folk: 2,
  intl: 1,
  exclusive: 2
};

const specialPriority = {
  春节: 10,
  国庆节: 9,
  交割: 8,
  行权: 8,
  元旦: 7,
  清明节: 7,
  端午节: 7,
  中秋节: 7,
  春假: 6,
  秋假: 6,
  除夕: 6
};

const DAY_MS = 86400000;
const HTTP_TIMEOUT_MS = 5000;
const OFFICIAL_REFRESH_INTERVAL_MS = 3 * DAY_MS;
const OFFICIAL_FAILED_RETRY_INTERVAL_MS = DAY_MS;
const NOTIFY_LOCK_TTL_MS = 2 * 60 * 1000;

const DISPLAY_LINE_MAX_WIDTH = {
  medium: 45,
  large: 36
};

const mkText = (text, size, weight, color, opts = {}) => ({
  type: "text",
  text: String(text ?? ""),
  font: { size, weight },
  textColor: color,
  ...opts
});

const mkRow = (children, gap = 4, opts = {}) => ({
  type: "stack",
  direction: "row",
  alignItems: "center",
  gap,
  children,
  ...opts
});

const mkIcon = (src, color, size = 13) => ({
  type: "image",
  src: `sf-symbol:${src}`,
  color,
  width: size,
  height: size
});

const mkSpacer = length =>
  length != null ? { type: "spacer", length } : { type: "spacer" };

const pad2 = n => String(n).padStart(2, "0");

const YMD = (y, m, d) =>
  `${y}/${pad2(m)}/${pad2(d)}`;

const msToYMD = ms => {
  if (!Number.isFinite(ms)) return null;

  const date = new Date(ms);

  return YMD(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );
};

const DISPLAY_NAME_MAP = {
  端午节: "🐲",
  七夕节: "💘",
  万圣节: "🎃"
};

const displayName = name => DISPLAY_NAME_MAP[name] ?? name;

const formatPeriodStr = (label, diff, duration = 1) => {
  if (diff === 0) {
    return `今日 ${label}`;
  }

  const total = Math.max(1, Number(duration) || 1);

  if (diff < 0 && total > 1) {
    const dayIndex = Math.floor(Math.abs(diff)) + 1;

    return dayIndex >= total
      ? `${label}最后一天`
      : `${label}第${dayIndex}天`;
  }

  return `${label} ${diff}天`;
};

const formatItemStr = (name, diff, duration = 1) =>
  formatPeriodStr(displayName(name), diff, duration);

const formatDisplayItem = item => {
  if (item?.status === "ended") {
    return `${displayName(item.name)}已结束`;
  }

  return formatItemStr(item.name, item.diff, item.duration);
};

const formatTodayFestGroup = items => {
  let todayPrefixUsed = false;

  const parts = items.slice(0, 2).map(item => {
    if (item.diff === 0) {
      if (!todayPrefixUsed) {
        todayPrefixUsed = true;
        return `今日 ${item.name}`;
      }

      return item.name;
    }

    return formatPeriodStr(item.name, item.diff, item.duration);
  });

  return `${parts.join("、")}${items.length > 2 ? "…" : ""}`;
};

const splitTextToLines = (str, maxW) => {
  const lines = [];
  let line = "";
  let w = 0;
  const tokens = str?.match(/[\d\/a-zA-Z.\-]+|./gu) || [];

  for (const token of tokens) {
    const tw = token.length > 1
      ? token.length * 1.1
      : token.charCodeAt(0) > 255
        ? 2
        : 1.1;

    if (w + tw > maxW && line) {
      const cleaned = line.replace(/^[，\s]+|[，\s]+$/g, "");
      if (cleaned) lines.push(cleaned);
      line = token;
      w = tw;
    } else {
      line += token;
      w += tw;
    }
  }

  if (line) {
    const cleaned = line.replace(/^[，\s]+|[，\s]+$/g, "");
    if (cleaned) lines.push(cleaned);
  }

  return lines;
};

function buildDisplayText(result, cat, limit) {
  return (result?.[cat] || [])
    .slice(0, limit)
    .map(formatDisplayItem)
    .join("，");
}

function buildDisplayCache(result) {
  const cache = {};

  for (const cfg of CATEGORY_CONFIG) {
    const mediumText = buildDisplayText(result, cfg.key, 3);
    const largeText = buildDisplayText(result, cfg.key, 7);

    cache[cfg.key] = {
      mediumText,
      largeText,
      mediumLines: splitTextToLines(mediumText, DISPLAY_LINE_MAX_WIDTH.medium),
      largeLines: splitTextToLines(largeText, DISPLAY_LINE_MAX_WIDTH.large)
    };
  }

  return cache;
}

function groupTodayItemsByCat(items) {
  const grouped = {};

  for (const cfg of CATEGORY_CONFIG) {
    grouped[cfg.key] = [];
  }

  for (const item of items || []) {
    if (!item || typeof item.cat !== "string") continue;

    if (!grouped[item.cat]) {
      grouped[item.cat] = [];
    }

    grouped[item.cat].push(item);
  }

  return grouped;
}

const Lunar = {
  info: [
    0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
    0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
    0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
    0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
    0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
    0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
    0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
    0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
    0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
    0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,
    0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
    0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
    0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
    0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
    0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
    0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
    0x092e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
    0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
    0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
    0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
    0x0d520
  ],

  term(y, n) {
    return new Date(
      31556925974.7 * (y - 1900) +
      [
        0,21208,42467,63836,85337,107014,128867,150921,
        173149,195551,218072,240693,263343,285989,308563,
        331033,353350,375494,397447,419210,440795,462224,
        483532,504758
      ][n - 1] * 60000 +
      Date.UTC(1900, 0, 6, 2, 5)
    );
  },

  lDays(y) {
    if (!isValidLunarYear(y)) return 0;

    let s = 348;
    const info = this.info[y - 1900];

    for (let i = 0x8000; i > 0x8; i >>= 1) {
      s += info & i ? 1 : 0;
    }

    return s + ((info & 0xf) ? ((info & 0x10000) ? 30 : 29) : 0);
  },

  mDays(y, m) {
    if (!isValidLunarYear(y) || m < 1 || m > 12) return 0;
    return this.info[y - 1900] & (0x10000 >> m) ? 30 : 29;
  }
};

const MIN_LUNAR_YEAR = 1900;
const MAX_LUNAR_YEAR = 1900 + Lunar.info.length - 1;

function isValidLunarYear(y) {
  return Number.isInteger(y) && y >= MIN_LUNAR_YEAR && y <= MAX_LUNAR_YEAR;
}

let lunarCumulativeCache = {
  maxYear: MIN_LUNAR_YEAR - 1,
  nextOffset: 0,
  off: []
};

function ensureLunarCumulative(maxYear) {
  const safeMaxYear = Math.min(maxYear, MAX_LUNAR_YEAR);

  if (lunarCumulativeCache.maxYear >= safeMaxYear) {
    return;
  }

  for (let y = lunarCumulativeCache.maxYear + 1; y <= safeMaxYear; y++) {
    lunarCumulativeCache.off[y - MIN_LUNAR_YEAR] = lunarCumulativeCache.nextOffset;
    lunarCumulativeCache.nextOffset += Lunar.lDays(y);
  }

  lunarCumulativeCache.maxYear = safeMaxYear;
}

const CACHE_ENV_KEYS = Object.freeze([
  "SHOW_SCHOOL_HOLIDAYS",
  "SHOW_FINANCE_DATES",
  "ENABLE_PRIORITY_SORT",
  "ENABLE_EXCLUSIVE_WEIGHT",

  "SPRING_BREAK_DATE",
  "AUTUMN_BREAK_DATE",
  "QINGMING_DATE",
  "PINNED_HOLIDAY",

  "EXCLUSIVE_NAME",
  "EXCLUSIVE_DATE",

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
]);

const CACHE_BOOL_ENV_KEYS = new Set([
  "SHOW_SCHOOL_HOLIDAYS",
  "SHOW_FINANCE_DATES",
  "ENABLE_PRIORITY_SORT",
  "ENABLE_EXCLUSIVE_WEIGHT"
]);

const BOOL_FALSE_VALUES = new Set([
  "false",
  "0",
  "no",
  "off",
  "disabled"
]);

const BOOL_TRUE_VALUES = new Set([
  "true",
  "1",
  "yes",
  "on",
  "enabled"
]);

function parseBoolValue(value, defaultVal = true) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return defaultVal;
  }

  const s = String(value).trim().toLowerCase();

  if (BOOL_FALSE_VALUES.has(s)) return false;
  if (BOOL_TRUE_VALUES.has(s)) return true;

  return defaultVal;
}

function normalizeCacheEnvValue(key, value) {
  if (CACHE_BOOL_ENV_KEYS.has(key)) {
    return parseBoolValue(value, true) ? "1" : "0";
  }

  if (value === undefined || value === null) {
    return "";
  }

  const s = String(value).trim();

  if (key === "PINNED_HOLIDAY") {
    return s
      .split(",")
      .map(v => v.trim())
      .filter(Boolean)
      .join(",");
  }

  return s;
}

function buildEnvFingerprint(env) {
  return CACHE_ENV_KEYS
    .map(key => `${key}=${normalizeCacheEnvValue(key, env?.[key])}`)
    .join("|");
}

const VALID_CATEGORY_KEYS = new Set(CATEGORY_CONFIG.map(cfg => cfg.key));

function isValidCountdownItem(item) {
  if (!item || typeof item !== "object") return false;
  if (typeof item.name !== "string") return false;

  if (
    typeof item.diff !== "number" ||
    !Number.isFinite(item.diff)
  ) {
    return false;
  }

  if (
    item.duration !== undefined &&
    (
      typeof item.duration !== "number" ||
      !Number.isInteger(item.duration) ||
      item.duration < 1 ||
      item.duration > 30
    )
  ) {
    return false;
  }

  if (
    typeof item.cat !== "string" ||
    !VALID_CATEGORY_KEYS.has(item.cat)
  ) {
    return false;
  }

  if (
    item.priority !== undefined &&
    (
      typeof item.priority !== "number" ||
      !Number.isFinite(item.priority)
    )
  ) {
    return false;
  }

  if (
    item.status !== undefined &&
    typeof item.status !== "string"
  ) {
    return false;
  }

  return true;
}

function isValidPinnedItem(item) {
  return (
    item &&
    typeof item === "object" &&
    typeof item.name === "string" &&
    typeof item.diff === "number" &&
    Number.isFinite(item.diff)
  );
}

function isValidStringArray(arr) {
  return Array.isArray(arr) && arr.every(v => typeof v === "string");
}

function isValidDisplayCache(displayCache) {
  if (!displayCache || typeof displayCache !== "object") {
    return false;
  }

  return CATEGORY_CONFIG.every(cfg => {
    const item = displayCache[cfg.key];

    return (
      item &&
      typeof item === "object" &&
      typeof item.mediumText === "string" &&
      typeof item.largeText === "string" &&
      isValidStringArray(item.mediumLines) &&
      isValidStringArray(item.largeLines)
    );
  });
}

function isValidCachedPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (!payload.result || typeof payload.result !== "object") return false;
  if (!Array.isArray(payload.todayItems)) return false;
  if (!Array.isArray(payload.pinnedData)) return false;
  if (!isValidDisplayCache(payload.displayCache)) return false;

  if (
    payload.todayNoticeText !== undefined &&
    typeof payload.todayNoticeText !== "string"
  ) {
    return false;
  }

  if (!payload.todayItems.every(isValidCountdownItem)) {
    return false;
  }

  if (!payload.pinnedData.every(isValidPinnedItem)) {
    return false;
  }

  return CATEGORY_CONFIG.every(cfg => {
    const arr = payload.result[cfg.key];

    return (
      Array.isArray(arr) &&
      arr.every(isValidCountdownItem)
    );
  });
}

const OFFICIAL_HOLIDAY_STORAGE_KEY = "countdown_official_holidays";
const OFFICIAL_HOLIDAY_STORAGE_VERSION = 2;

function parseISODateParts(date) {
  const match = String(date ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);

  const dt = new Date(Date.UTC(y, m - 1, d));

  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() + 1 !== m ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }

  return { y, m, d };
}

const isValidISODate = date => parseISODateParts(date) !== null;

const isoToMs = iso => {
  const parts = parseISODateParts(iso);

  return parts
    ? Date.UTC(parts.y, parts.m - 1, parts.d)
    : NaN;
};

const isoToYMD = iso => {
  const parts = parseISODateParts(iso);

  return parts
    ? YMD(parts.y, parts.m, parts.d)
    : null;
};

function hashString(str) {
  let h = 5381;

  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }

  return (h >>> 0).toString(36);
}

function warnLog(...args) {
  try {
    if (
      typeof console !== "undefined" &&
      console &&
      typeof console.warn === "function"
    ) {
      console.warn(...args);
    }
  } catch (_) {
  }
}

function buildOfficialHolidayRanges(days) {
  const offDays = days
    .filter(day =>
      day &&
      day.isOffDay === true &&
      typeof day.name === "string" &&
      day.name.trim() &&
      isValidISODate(day.date)
    )
    .map(day => {
      const ms = Number.isFinite(Number(day.ms))
        ? Number(day.ms)
        : isoToMs(day.date);

      return {
        name: day.name.trim(),
        date: day.date,
        ms
      };
    })
    .filter(day => Number.isFinite(day.ms))
    .sort((a, b) => a.ms - b.ms);

  const groups = [];

  for (const day of offDays) {
    const last = groups[groups.length - 1];

    if (
      last &&
      last.name === day.name &&
      day.ms - last.endMs === DAY_MS
    ) {
      last.end = day.date;
      last.endMs = day.ms;
      last.duration += 1;
    } else {
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
    endYMD: msToYMD(group.endMs),
    duration: group.duration
  }));
}

function normalizeHolidayCnYearData(data, year) {
  if (!data || typeof data !== "object") {
    throw new Error(`invalid official holiday data: ${year}`);
  }

  if (Number(data.year) !== Number(year)) {
    throw new Error(`official holiday year mismatch: expected ${year}, got ${data.year}`);
  }

  if (!Array.isArray(data.days)) {
    throw new Error(`official holiday days missing: ${year}`);
  }

  const days = data.days
    .filter(day =>
      day &&
      typeof day.name === "string" &&
      day.name.trim() &&
      typeof day.date === "string" &&
      typeof day.isOffDay === "boolean" &&
      isValidISODate(day.date)
    )
    .map(day => {
      const name = day.name.trim();
      const ms = isoToMs(day.date);

      return {
        name,
        date: day.date,
        isOffDay: day.isOffDay,
        ms
      };
    })
    .filter(day => Number.isFinite(day.ms))
    .sort((a, b) => a.ms - b.ms);

  return {
    days
  };
}

function readOfficialHolidayCache(ctx) {
  try {
    const cache = ctx.storage?.getJSON(OFFICIAL_HOLIDAY_STORAGE_KEY);

    if (
      cache &&
      cache.version === OFFICIAL_HOLIDAY_STORAGE_VERSION &&
      cache.years &&
      typeof cache.years === "object"
    ) {
      return cache;
    }
  } catch (e) {
    warnLog("[Countdown] failed to read official holiday cache:", e);
  }

  return null;
}

function officialRequestYears(currentYear) {
  return [currentYear - 1, currentYear, currentYear + 1];
}

function officialRequiredYears(currentYear) {
  return [currentYear - 1, currentYear];
}

function officialOptionalYears(currentYear) {
  return [currentYear + 1];
}

function pruneOfficialYears(years, currentYear) {
  const keep = new Set(officialRequestYears(currentYear).map(String));
  const pruned = {};

  for (const [year, data] of Object.entries(years || {})) {
    if (keep.has(year)) {
      pruned[year] = data;
    }
  }

  return pruned;
}

function pruneRetryAfterByYear(retryAfterByYear, currentYear) {
  const keep = new Set(officialRequestYears(currentYear).map(String));
  const pruned = {};

  for (const [year, value] of Object.entries(retryAfterByYear || {})) {
    const time = Number(value);

    if (
      keep.has(year) &&
      Number.isFinite(time) &&
      time > Date.now()
    ) {
      pruned[year] = time;
    }
  }

  return pruned;
}

function hasOfficialYearData(yearsData, year) {
  const yearData = yearsData?.[String(year)];

  return !!(
    yearData &&
    Array.isArray(yearData.days) &&
    yearData.days.length > 0
  );
}

function getMissingOfficialYears(yearsData, requestYears) {
  return requestYears
    .map(String)
    .filter(year => !hasOfficialYearData(yearsData, year));
}

function buildOfficialFingerprint(yearsData) {
  if (!yearsData || typeof yearsData !== "object") {
    return "none";
  }

  const parts = [];

  for (const year of Object.keys(yearsData).sort()) {
    const yearData = yearsData[year];

    if (!yearData || !Array.isArray(yearData.days)) continue;

    parts.push(year);

    for (const day of yearData.days) {
      parts.push(`${day.date}:${day.name}:${day.isOffDay ? 1 : 0}`);
    }
  }

  if (parts.length === 0) {
    return "none";
  }

  return hashString(parts.join("|"));
}

function isOfficialRequiredReady(yearsData, currentYear) {
  return getMissingOfficialYears(
    yearsData,
    officialRequiredYears(currentYear)
  ).length === 0;
}

function isOfficialCacheFresh(cache, todayIso, currentYear) {
  if (
    !cache ||
    !isValidISODate(cache.checkedDate) ||
    !isValidISODate(todayIso)
  ) {
    return false;
  }

  if (!isOfficialRequiredReady(cache.years, currentYear)) {
    return false;
  }

  const age = isoToMs(todayIso) - isoToMs(cache.checkedDate);

  return age >= 0 && age < OFFICIAL_REFRESH_INTERVAL_MS;
}

function isOfficialYearRetryBlocked(cache, year, now = Date.now()) {
  const retryAt = Number(cache?.retryAfterByYear?.[String(year)]);

  return Number.isFinite(retryAt) && retryAt > now;
}

function normalizeOfficialCachePayload(oldCache, years, currentYear, todayIso) {
  const requestYears = officialRequestYears(currentYear);
  const requiredYears = officialRequiredYears(currentYear);
  const optionalYears = officialOptionalYears(currentYear);

  const missingYears = getMissingOfficialYears(years, requestYears);
  const missingRequiredYears = getMissingOfficialYears(years, requiredYears);
  const optionalMissingYears = getMissingOfficialYears(years, optionalYears);

  return {
    version: OFFICIAL_HOLIDAY_STORAGE_VERSION,
    checkedDate: oldCache?.checkedDate || todayIso,
    yearsKey: requestYears.join(","),
    requiredYearsKey: requiredYears.join(","),
    complete: missingYears.length === 0,
    requiredComplete: missingRequiredYears.length === 0,
    missingYears,
    missingRequiredYears,
    optionalMissingYears,
    lastSuccessCount: Number(oldCache?.lastSuccessCount) || 0,
    fingerprint: buildOfficialFingerprint(years),
    retryAfterByYear: pruneRetryAfterByYear(
      oldCache?.retryAfterByYear,
      currentYear
    ),
    years
  };
}

async function parseHttpJson(resp) {
  if (!resp || typeof resp.json !== "function") {
    throw new Error("invalid Egern http response: response.json unavailable");
  }

  return await resp.json();
}

async function fetchOfficialHolidayYear(ctx, year) {
  if (!ctx.http || typeof ctx.http.get !== "function") {
    throw new Error("ctx.http unavailable");
  }

  const url = `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`;

  const resp = await ctx.http.get(url, {
    timeout: HTTP_TIMEOUT_MS,
    credentials: "omit",
    headers: {
      Accept: "application/json"
    }
  });

  const status = resp?.status ?? resp?.statusCode;

  if (typeof status === "number" && status >= 400) {
    throw new Error(`HTTP ${status}`);
  }

  const data = await parseHttpJson(resp);

  return normalizeHolidayCnYearData(data, year);
}

async function loadOfficialHolidayDaily(ctx, currentYear, todayIso) {
  const oldCache = readOfficialHolidayCache(ctx);

  if (!ctx.http || !ctx.storage) {
    return oldCache;
  }

  const requestYears = officialRequestYears(currentYear);
  const requiredYears = officialRequiredYears(currentYear);
  const optionalYears = officialOptionalYears(currentYear);

  const yearsKey = requestYears.join(",");
  const requiredYearsKey = requiredYears.join(",");

  const mergedYears = pruneOfficialYears(oldCache?.years || {}, currentYear);
  const retryAfterByYear = pruneRetryAfterByYear(
    oldCache?.retryAfterByYear,
    currentYear
  );

  const cacheForFreshCheck = {
    ...oldCache,
    years: mergedYears
  };

  const now = Date.now();
  const allMissingBeforeFetch = getMissingOfficialYears(
    mergedYears,
    requestYears
  );

  const requiredMissingBeforeFetch = getMissingOfficialYears(
    mergedYears,
    requiredYears
  );

  const optionalMissingBeforeFetch = getMissingOfficialYears(
    mergedYears,
    optionalYears
  );

  const requiredFresh = isOfficialCacheFresh(
    cacheForFreshCheck,
    todayIso,
    currentYear
  );

  let yearsToFetch;

  if (requiredFresh) {
    yearsToFetch = optionalMissingBeforeFetch
      .map(Number)
      .filter(year => !isOfficialYearRetryBlocked({ retryAfterByYear }, year, now));

    if (yearsToFetch.length === 0) {
      return normalizeOfficialCachePayload(
        oldCache,
        mergedYears,
        currentYear,
        todayIso
      );
    }
  } else if (requiredMissingBeforeFetch.length > 0) {
    yearsToFetch = allMissingBeforeFetch
      .map(Number)
      .filter(year => !isOfficialYearRetryBlocked({ retryAfterByYear }, year, now));

    if (yearsToFetch.length === 0) {
      return normalizeOfficialCachePayload(
        oldCache,
        mergedYears,
        currentYear,
        todayIso
      );
    }
  } else {
    yearsToFetch = requestYears
      .filter(year => !isOfficialYearRetryBlocked({ retryAfterByYear }, year, now));
  }

  const results = await Promise.allSettled(
    yearsToFetch.map(async year => {
      const data = await fetchOfficialHolidayYear(ctx, year);

      return {
        key: String(year),
        data
      };
    })
  );

  let successCount = 0;
  const successfulFetchYearSet = new Set();

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const year = yearsToFetch[i];
    const key = String(year);

    if (result.status === "fulfilled") {
      const { data } = result.value;
      mergedYears[key] = data;
      delete retryAfterByYear[key];
      successCount += 1;
      successfulFetchYearSet.add(key);
    } else {
      retryAfterByYear[key] = now + OFFICIAL_FAILED_RETRY_INTERVAL_MS;

      warnLog(
        "[Countdown] failed to fetch official holiday:",
        key,
        result.reason
      );
    }
  }

  const missingYears = getMissingOfficialYears(
    mergedYears,
    requestYears
  );

  const missingRequiredYears = getMissingOfficialYears(
    mergedYears,
    requiredYears
  );

  const optionalMissingYears = getMissingOfficialYears(
    mergedYears,
    optionalYears
  );

  const fetchedRequiredYears = yearsToFetch
    .filter(year => requiredYears.includes(year))
    .map(String);

  const allFetchedRequiredYearsSucceeded =
    fetchedRequiredYears.length > 0 &&
    fetchedRequiredYears.every(year =>
      successfulFetchYearSet.has(year)
    );

  const checkedDate = allFetchedRequiredYearsSucceeded
    ? todayIso
    : oldCache?.checkedDate || todayIso;

  const newCache = {
    version: OFFICIAL_HOLIDAY_STORAGE_VERSION,
    checkedDate,
    lastAttemptDate: todayIso,
    yearsKey,
    requiredYearsKey,
    complete: missingYears.length === 0,
    requiredComplete: missingRequiredYears.length === 0,
    missingYears,
    missingRequiredYears,
    optionalMissingYears,
    lastSuccessCount: successCount,
    fingerprint: buildOfficialFingerprint(mergedYears),
    retryAfterByYear: pruneRetryAfterByYear(
      retryAfterByYear,
      currentYear
    ),
    years: mergedYears
  };

  try {
    ctx.storage.setJSON(OFFICIAL_HOLIDAY_STORAGE_KEY, newCache);
  } catch (e) {
    warnLog("[Countdown] failed to save official holiday cache:", e);
  }

  return newCache;
}

function isValidOfficialRange(range) {
  if (!range || typeof range !== "object") return false;
  if (typeof range.name !== "string" || !range.name.trim()) return false;
  if (!isValidISODate(range.start)) return false;

  const duration = Number(range.duration);
  return Number.isInteger(duration) && duration >= 1 && duration <= 30;
}

function slashYMDToMs(dateStr) {
  const match = String(dateStr ?? "").match(
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/
  );

  if (!match) {
    return NaN;
  }

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);

  const dt = new Date(Date.UTC(y, m - 1, d));

  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() + 1 !== m ||
    dt.getUTCDate() !== d
  ) {
    return NaN;
  }

  return Date.UTC(y, m - 1, d);
}

function officialRangeOverlapsYear(range, year) {
  const duration = Number(range.duration);
  const startMs = Number.isFinite(Number(range.startMs))
    ? Number(range.startMs)
    : isoToMs(range.start);

  if (
    !Number.isFinite(startMs) ||
    !Number.isInteger(duration) ||
    duration < 1
  ) {
    return false;
  }

  const endMs = Number.isFinite(Number(range.endMs))
    ? Number(range.endMs)
    : startMs + (duration - 1) * DAY_MS;

  const yearStartMs = Date.UTC(year, 0, 1);
  const yearEndMs = Date.UTC(year, 11, 31);

  return startMs <= yearEndMs && endMs >= yearStartMs;
}

function buildOfficialHolidayRangeCache(officialHolidayCache) {
  const years = officialHolidayCache?.years;

  if (!years || typeof years !== "object") {
    return [];
  }

  const allDays = [];

  for (const yearData of Object.values(years)) {
    if (!yearData || !Array.isArray(yearData.days)) continue;

    for (const day of yearData.days) {
      allDays.push(day);
    }
  }

  return buildOfficialHolidayRanges(allDays);
}

function getOfficialLegalHolidaysFromRanges(officialRanges, year) {
  if (!Array.isArray(officialRanges) || officialRanges.length === 0) {
    return null;
  }

  const rows = officialRanges
    .filter(range =>
      isValidOfficialRange(range) &&
      officialRangeOverlapsYear(range, year)
    )
    .map(range => {
      const startMs = Number.isFinite(Number(range.startMs))
        ? Number(range.startMs)
        : isoToMs(range.start);

      const ymd = range.startYMD || msToYMD(startMs) || isoToYMD(range.start);

      return [
        range.name.trim(),
        ymd,
        Number(range.duration),
        "official",
        startMs
      ];
    })
    .filter(row => row[1]);

  return rows.length > 0 ? rows : null;
}

function officialRowDistanceToFallback(row, fallbackMs) {
  const startMs = Number.isFinite(Number(row?.[4]))
    ? Number(row[4])
    : slashYMDToMs(row?.[1]);

  const duration = Number(row?.[2]) || 1;

  if (!Number.isFinite(startMs)) {
    return Infinity;
  }

  if (!Number.isFinite(fallbackMs)) {
    return 0;
  }

  const endMs = startMs + (Math.max(1, duration) - 1) * DAY_MS;

  if (fallbackMs >= startMs && fallbackMs <= endMs) {
    return 0;
  }

  return Math.min(
    Math.abs(fallbackMs - startMs),
    Math.abs(fallbackMs - endMs)
  );
}

function mergeLegalHolidays(fallbackLegal, officialLegal) {
  if (!Array.isArray(fallbackLegal)) {
    return Array.isArray(officialLegal) ? [...officialLegal] : [];
  }

  if (!Array.isArray(officialLegal) || officialLegal.length === 0) {
    return [...fallbackLegal];
  }

  const officialRows = officialLegal.filter(row =>
    Array.isArray(row) &&
    typeof row[0] === "string" &&
    row[0].trim() &&
    typeof row[1] === "string"
  );

  if (officialRows.length === 0) {
    return [...fallbackLegal];
  }

  const usedOfficialIndexes = new Set();
  const fallbackNames = new Set(
    fallbackLegal
      .map(row => String(row?.[0] ?? "").trim())
      .filter(Boolean)
  );

  const merged = fallbackLegal.map(row => {
    const name = String(row?.[0] ?? "").trim();

    if (!name) {
      return row;
    }

    const fallbackMs = slashYMDToMs(row?.[1]);

    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < officialRows.length; i++) {
      if (usedOfficialIndexes.has(i)) continue;

      const officialName = String(officialRows[i]?.[0] ?? "").trim();

      if (officialName !== name) continue;

      const distance = officialRowDistanceToFallback(
        officialRows[i],
        fallbackMs
      );

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      usedOfficialIndexes.add(bestIndex);
      return officialRows[bestIndex];
    }

    return row;
  });

  for (let i = 0; i < officialRows.length; i++) {
    if (usedOfficialIndexes.has(i)) continue;

    const name = String(officialRows[i]?.[0] ?? "").trim();

    if (!fallbackNames.has(name)) {
      merged.push(officialRows[i]);
    }
  }

  return merged;
}

function buildOfficialDayIndex(officialHolidayCache) {
  const index = new Map();
  const years = officialHolidayCache?.years;

  if (!years || typeof years !== "object") {
    return index;
  }

  for (const yearData of Object.values(years)) {
    if (!yearData || !Array.isArray(yearData.days)) continue;

    for (const day of yearData.days) {
      if (
        day &&
        typeof day.date === "string" &&
        isValidISODate(day.date)
      ) {
        index.set(day.date, day);
      }
    }
  }

  return index;
}

export default async function (ctx = {}) {
  const env = ctx.env ?? {};

  const scriptName = String(ctx.script?.name || "countdown");
  const storageScope = `countdown:${hashString(scriptName)}`;
  const envStorageFingerprint = buildEnvFingerprint(env);
  const envStorageId = hashString(envStorageFingerprint);

  const getBool = (key, defaultVal = true) =>
    parseBoolValue(env[key], defaultVal);

  const enableWeekendTheme = getBool("ENABLE_WEEKEND_THEME", true);

  const family = (ctx.widgetFamily || "systemMedium").toLowerCase();
  const isSmall = family.includes("small");
  const isLarge = family.includes("large");

  const bjDate = new Date(Date.now() + 8 * 3600000);
  const Y = bjDate.getUTCFullYear();
  const M = bjDate.getUTCMonth() + 1;
  const D = bjDate.getUTCDate();
  const currentHour = bjDate.getUTCHours();
  const currentDay = bjDate.getUTCDay();
  const todayMs = Date.UTC(Y, M - 1, D);
  const todayIso = `${Y}-${pad2(M)}-${pad2(D)}`;

  const nextRefreshMs =
    currentHour < 15
      ? Date.UTC(Y, M - 1, D, 15, 1) - 8 * 3600000
      : Date.UTC(Y, M - 1, D + 1, 0, 1) - 8 * 3600000;

  const withRefresh = widget => ({
    ...widget,
    refreshAfter: new Date(nextRefreshMs).toISOString()
  });

  const officialHolidayCache = await loadOfficialHolidayDaily(
    ctx,
    Y,
    todayIso
  );

  const officialRanges = buildOfficialHolidayRangeCache(officialHolidayCache);

  const officialDayIndex = enableWeekendTheme
    ? buildOfficialDayIndex(officialHolidayCache)
    : new Map();

  const officialFingerprint =
    officialHolidayCache?.fingerprint
      ? `official=${officialHolidayCache.fingerprint}`
      : "official=none";

  const envFingerprint = `${envStorageFingerprint}|${officialFingerprint}`;

  const CACHE_KEY = `${storageScope}:daily:${envStorageId}`;
  const NOTIFY_KEY = `${storageScope}:notify:${envStorageId}`;
  const CACHE_VERSION = 7;
  const timePhase = currentHour >= 15 ? "after3pm" : "before3pm";
  const todayStr = `${Y}_${M}_${D}_${timePhase}`;

  let cachedData = null;

  if (ctx.storage) {
    try {
      const stored = ctx.storage.getJSON(CACHE_KEY);

      if (
        stored &&
        stored.version === CACHE_VERSION &&
        stored.date === todayStr &&
        stored.envFingerprint === envFingerprint &&
        isValidCachedPayload(stored.payload)
      ) {
        cachedData = stored.payload;
      }
    } catch (e) {
      warnLog("[Countdown] failed to read daily cache:", e);
    }
  }

  let result;
  let todayNoticeText;
  let pinnedData;
  let todayItems;
  let displayCache;

  if (cachedData) {
    ({
      result,
      todayNoticeText,
      pinnedData,
      todayItems,
      displayCache
    } = cachedData);
  } else {
    const getStr = (key, defaultVal = "") =>
      String(env[key] ?? defaultVal).trim();

    const showSchoolHolidays = getBool("SHOW_SCHOOL_HOLIDAYS", true);
    const showFinanceDates = getBool("SHOW_FINANCE_DATES", true);
    const enablePrioritySort = getBool("ENABLE_PRIORITY_SORT", true);
    const enableExclusiveWeight = getBool("ENABLE_EXCLUSIVE_WEIGHT", true);

    const springDateStr = getStr("SPRING_BREAK_DATE");
    const autumnDateStr = getStr("AUTUMN_BREAK_DATE");
    const qingmingDateStr = getStr("QINGMING_DATE", "");

    const pinnedHolidays = getStr("PINNED_HOLIDAY")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    const pinnedHolidaySet = new Set(pinnedHolidays);

    const isValidMonthDay = (y, m, d) => {
      if (!Number.isInteger(m) || !Number.isInteger(d)) return false;
      if (m < 1 || m > 12) return false;

      const maxDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return d >= 1 && d <= maxDay;
    };

    const parseExclusiveDateSpec = raw => {
      const s = String(raw ?? "").trim();

      let m = s.match(/^(\d{1,2})\/(\d{1,2})$/);

      if (m) {
        const month = Number(m[1]);
        const day = Number(m[2]);

        if (!isValidMonthDay(2000, month, day)) {
          return null;
        }

        return {
          type: "annual",
          month,
          day
        };
      }

      m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);

      if (m) {
        const year = Number(m[1]);
        const month = Number(m[2]);
        const day = Number(m[3]);

        if (year < 1900 || year > 9999) {
          return null;
        }

        if (!isValidMonthDay(year, month, day)) {
          return null;
        }

        return {
          type: "once",
          year,
          month,
          day
        };
      }

      return null;
    };

    const getCustomDate = (y, dateStr, fallbackFn) => {
      if (!dateStr || typeof dateStr !== "string") {
        return fallbackFn ? fallbackFn() : null;
      }

      const parts = dateStr.split("/").map(Number);

      if (parts.length !== 2) {
        return fallbackFn ? fallbackFn() : null;
      }

      const [m, d] = parts;

      if (!isValidMonthDay(y, m, d)) {
        return fallbackFn ? fallbackFn() : null;
      }

      return YMD(y, m, d);
    };

    const customDays = [1, 2, 3, 4, 5, 6]
      .map(i => {
        const legacyName = i === 1 ? getStr("EXCLUSIVE_NAME") : "";
        const legacyDate = i === 1 ? getStr("EXCLUSIVE_DATE") : "";

        const name = getStr(`EXCLUSIVE_NAME_${i}`) || legacyName;
        const date = getStr(`EXCLUSIVE_DATE_${i}`) || legacyDate;

        return {
          name,
          spec: parseExclusiveDateSpec(date)
        };
      })
      .filter(item => item.name && item.spec);

    const getFinanceDate = (y, monthIndex, nth, targetDow) => {
      const firstDow = new Date(Date.UTC(y, monthIndex, 1)).getUTCDay();

      return Date.UTC(
        y,
        monthIndex,
        1 + ((targetDow - firstDow + 7) % 7) + (nth - 1) * 7
      );
    };

    const lunarToSolarCache = new Map();

    const l2s = (y, m, d) => {
      const cacheKey = `${y}-${m}-${d}`;

      if (lunarToSolarCache.has(cacheKey)) {
        return lunarToSolarCache.get(cacheKey);
      }

      let resultDate = null;

      if (
        isValidLunarYear(y) &&
        Number.isInteger(m) &&
        m >= 1 &&
        m <= 12
      ) {
        const monthDays = Lunar.mDays(y, m);

        if (
          Number.isInteger(d) &&
          d >= 1 &&
          d <= monthDays
        ) {
          ensureLunarCumulative(y);

          let off = lunarCumulativeCache.off[y - MIN_LUNAR_YEAR] ?? 0;
          const info = Lunar.info[y - 1900];
          const leapMonth = info & 0xf;

          for (let i = 1; i < m; i++) {
            off += Lunar.mDays(y, i);

            if (leapMonth > 0 && i === leapMonth) {
              off += info & 0x10000 ? 30 : 29;
            }
          }

          const date = new Date(
            Date.UTC(1900, 0, 31) + (off + d - 1) * DAY_MS
          );

          resultDate = YMD(
            date.getUTCFullYear(),
            date.getUTCMonth() + 1,
            date.getUTCDate()
          );
        }
      }

      lunarToSolarCache.set(cacheKey, resultDate);
      return resultDate;
    };

    const getFests = y => {
      const term = n => {
        if (!isValidLunarYear(y)) return null;

        const bjT = new Date(Lunar.term(y, n).getTime() + 8 * 3600000);

        return YMD(
          bjT.getUTCFullYear(),
          bjT.getUTCMonth() + 1,
          bjT.getUTCDate()
        );
      };

      const wDay = (m, n, w) => {
        const x = w - new Date(Date.UTC(y, m - 1, 1)).getUTCDay();

        return YMD(
          y,
          m,
          1 + (x < 0 ? x + 7 : x) + (n - 1) * 7
        );
      };

      const qmDateStr = getCustomDate(y, qingmingDateStr, () => term(7));

      const fallbackLegal = [
        ["元旦", YMD(y, 1, 1), 1],
        ["春节", l2s(y, 1, 1), 3],
        ["清明节", qmDateStr, 1],
        ["劳动节", YMD(y, 5, 1), 1],
        ["端午节", l2s(y, 5, 5), 1],
        ["中秋节", l2s(y, 8, 15), 1],
        ["国庆节", YMD(y, 10, 1), 3]
      ];

      const officialLegal = getOfficialLegalHolidaysFromRanges(
        officialRanges,
        y
      );

      const legal = mergeLegalHolidays(fallbackLegal, officialLegal);

      if (showSchoolHolidays) {
        const springDate = getCustomDate(y, springDateStr, () => {
          if (!qmDateStr) return null;

          const [qy, qm, qd] = qmDateStr.split("/").map(Number);
          const s = new Date(Date.UTC(qy, qm - 1, qd - 3));

          return YMD(
            s.getUTCFullYear(),
            s.getUTCMonth() + 1,
            s.getUTCDate()
          );
        });

        if (springDate) {
          legal.push(["春假", springDate, 3]);
        }

        const autumnDate = getCustomDate(y, autumnDateStr, () => {
          const nov1 = new Date(Date.UTC(y, 10, 1));

          return YMD(
            y,
            11,
            1 + ((3 - nov1.getUTCDay() + 7) % 7) + 7
          );
        });

        if (autumnDate) {
          legal.push(["秋假", autumnDate, 3]);
        }
      }

      return {
        legal,

        exclusive: customDays
          .filter(item => item.spec.type === "annual")
          .map(item => {
            const { month, day } = item.spec;

            return [
              item.name,
              isValidMonthDay(y, month, day) ? YMD(y, month, day) : null,
              1,
              "custom"
            ];
          }),

        folk: [
          ["元宵节", l2s(y, 1, 15), 1],
          ["龙抬头", l2s(y, 2, 2), 1],
          ["七夕节", l2s(y, 7, 7), 1],
          ["中元节", l2s(y, 7, 15), 1],
          ["重阳节", l2s(y, 9, 9), 1],
          ["寒衣节", l2s(y, 10, 1), 1],
          ["腊八节", l2s(y, 12, 8), 1],
          ["小年", l2s(y, 12, 23), 1],
          ["除夕", l2s(y, 12, Lunar.mDays(y, 12)), 1]
        ],

        intl: [
          ["情人节", YMD(y, 2, 14), 1],
          ["妇女节", YMD(y, 3, 8), 1],
          ["母亲节", wDay(5, 2, 0), 1],
          ["儿童节", YMD(y, 6, 1), 1],
          ["父亲节", wDay(6, 3, 0), 1],
          ["万圣节", YMD(y, 10, 31), 1],
          ["感恩节", wDay(11, 4, 4), 1],
          ["平安夜", YMD(y, 12, 24), 1],
          ["圣诞节", YMD(y, 12, 25), 1]
        ]
      };
    };

    const getPriority = (name, cat, sourceKind) => {
      if (!enablePrioritySort) return 1;

      if (sourceKind === "custom") {
        return enableExclusiveWeight
          ? 9
          : basePriority[cat] ?? 1;
      }

      return specialPriority[name] ?? basePriority[cat] ?? 1;
    };

    const isInFestivalPeriod = (diff, duration) =>
      diff <= 0 && diff > -duration;

    const rawResult = {
      legal: new Map(),
      folk: new Map(),
      intl: new Map(),
      exclusive: new Map()
    };

    const todayFests = [];
    const todayFinance = [];
    const todayFinanceEnded = [];
    const todayFestSet = new Set();
    const todayItemKeySet = new Set();
    const pinnedMap = new Map();

    todayItems = [];

    const updatePinned = (name, diff) => {
      if (!pinnedHolidaySet.has(name) || diff > 200) {
        return;
      }

      const oldPinnedDiff = pinnedMap.get(name);

      if (oldPinnedDiff === undefined || diff < oldPinnedDiff) {
        pinnedMap.set(name, diff);
      }
    };

    const addTodayItem = (name, diff, priority, cat, duration = 1, status = "") => {
      const key = `${cat}:${name}:${status || "active"}`;

      if (todayItemKeySet.has(key)) return;

      todayItemKeySet.add(key);

      todayItems.push({
        name,
        diff,
        duration,
        priority: priority + 100,
        cat,
        ...(status ? { status } : {})
      });
    };

    const addFestival = (cat, name, dateStr, duration = 1, sourceKind = "") => {
      if (!name || !dateStr) return;

      const [yy, mm, dd] = dateStr.split("/").map(Number);

      if (!Number.isInteger(yy) || !isValidMonthDay(yy, mm, dd)) {
        return;
      }

      const diff = (Date.UTC(yy, mm - 1, dd) - todayMs) / DAY_MS;
      const priority = getPriority(name, cat, sourceKind);

      if (isInFestivalPeriod(diff, duration)) {
        if (!todayFestSet.has(name)) {
          todayFestSet.add(name);

          todayFests.push({
            name,
            diff,
            duration
          });
        }

        addTodayItem(name, diff, priority, cat, duration);
        return;
      }

      if (diff > 0) {
        updatePinned(name, diff);

        const old = rawResult[cat].get(name);

        if (!old || diff < old.diff) {
          rawResult[cat].set(name, {
            name,
            diff,
            duration,
            priority,
            cat
          });
        }
      }
    };

    const yearsToScan = [Y - 1, Y, Y + 1];

    for (const y of yearsToScan) {
      const f = getFests(y);

      for (const cat of Object.keys(rawResult)) {
        for (const [name, dateStr, duration = 1, sourceKind = ""] of f[cat]) {
          addFestival(cat, name, dateStr, duration, sourceKind);
        }
      }
    }

    for (const item of customDays) {
      if (item.spec.type !== "once") continue;

      const { year, month, day } = item.spec;

      addFestival(
        "exclusive",
        item.name,
        YMD(year, month, day),
        1,
        "custom"
      );
    }

    if (showFinanceDates) {
      const processFinance = (name, nth, dow) => {
        const priority = getPriority(name, "exclusive");
        const thisMonthDate = getFinanceDate(Y, M - 1, nth, dow);

        if (todayMs === thisMonthDate) {
          if (currentHour < 15) {
            todayFinance.push(name);
            addTodayItem(name, 0, priority, "exclusive", 1);
          } else {
            todayFinanceEnded.push(name);
            addTodayItem(name, 0, priority, "exclusive", 1, "ended");
          }

          return;
        }

        const targetDate = todayMs > thisMonthDate
          ? getFinanceDate(
              M === 12 ? Y + 1 : Y,
              M === 12 ? 0 : M,
              nth,
              dow
            )
          : thisMonthDate;

        const diff = (targetDate - todayMs) / DAY_MS;

        if (diff > 0) {
          updatePinned(name, diff);

          rawResult.exclusive.set(name, {
            name,
            diff,
            duration: 1,
            priority,
            cat: "exclusive"
          });
        }
      };

      processFinance("交割", 3, 5);
      processFinance("行权", 4, 3);
    }

    result = {};

    Object.keys(rawResult).forEach(cat => {
      result[cat] = Array.from(rawResult[cat].values())
        .filter(i => !pinnedMap.has(i.name) && !todayFestSet.has(i.name))
        .sort((a, b) => {
          if (a.diff !== b.diff) return a.diff - b.diff;
          return enablePrioritySort ? b.priority - a.priority : 0;
        })
        .slice(0, 7);
    });

    const todayNoticeParts = [];

    if (todayFests.length > 0) {
      todayNoticeParts.push(formatTodayFestGroup(todayFests));
    }

    if (todayFinance.length > 0) {
      todayNoticeParts.push(`今日 ${todayFinance.join("·")}`);
    }

    if (todayFinanceEnded.length > 0) {
      todayNoticeParts.push(
        todayFinanceEnded
          .map(name => `${name}已结束`)
          .join("·")
      );
    }

    todayNoticeText = todayNoticeParts.join(" ｜ ");

    pinnedData = pinnedHolidays
      .filter(n => pinnedMap.has(n))
      .map(n => ({
        name: n,
        diff: pinnedMap.get(n)
      }));

    displayCache = buildDisplayCache(result);

    if (ctx.storage) {
      try {
        ctx.storage.setJSON(CACHE_KEY, {
          version: CACHE_VERSION,
          date: todayStr,
          envFingerprint,
          payload: {
            result,
            todayNoticeText,
            pinnedData,
            todayItems,
            displayCache
          }
        });
      } catch (e) {
        warnLog("[Countdown] failed to save daily cache:", e);
      }
    }
  }

  if (!displayCache || !isValidDisplayCache(displayCache)) {
    displayCache = buildDisplayCache(result);
  }

  const todayItemsByCat = groupTodayItemsByCat(todayItems);

  const stickyParts = (pinnedData || []).map(p => `${p.name} ${p.diff}天`);
  const stickyText = stickyParts.join("·");

  if (
    typeof ctx.notify === "function" &&
    ctx.storage &&
    Array.isArray(todayItems) &&
    todayItems.length > 0
  ) {
    const notifyDate = `${Y}-${pad2(M)}-${pad2(D)}`;
    const notifyKey = NOTIFY_KEY;

    try {
      const notifyItems = todayItems
        .filter(i => i.diff === 0 && i.status !== "ended")
        .slice()
        .sort((a, b) => {
          if ((b.priority ?? 0) !== (a.priority ?? 0)) {
            return (b.priority ?? 0) - (a.priority ?? 0);
          }

          return (a.diff ?? 0) - (b.diff ?? 0);
        });

      const notifyNames = [
        ...new Set(
          notifyItems
            .map(i => i.name)
            .filter(Boolean)
        )
      ];

      if (notifyNames.length > 0) {
        const now = Date.now();
        const notified = ctx.storage.getJSON(notifyKey) || {};

        const lockFresh =
          notified.lockDate === notifyDate &&
          Number.isFinite(Number(notified.lockTime)) &&
          now - Number(notified.lockTime) < NOTIFY_LOCK_TTL_MS;

        if (notified.date !== notifyDate && !lockFresh) {
          const lockedState = {
            ...notified,
            lockDate: notifyDate,
            lockTime: now
          };

          ctx.storage.setJSON(notifyKey, lockedState);

          try {
            await Promise.resolve(ctx.notify({
              title: "✨ 今日提醒",
              body: notifyNames.join("、"),
              sound: true
            }));

            ctx.storage.setJSON(notifyKey, {
              date: notifyDate,
              names: notifyNames,
              time: Date.now()
            });
          } catch (e) {
            warnLog("[Countdown] notify failed:", e);

            ctx.storage.setJSON(notifyKey, {
              ...lockedState,
              failedDate: notifyDate,
              failedTime: Date.now()
            });
          }
        }
      }
    } catch (e) {
      warnLog("[Countdown] notify process failed:", e);
    }
  }

  const officialTodayInfo = enableWeekendTheme
    ? officialDayIndex.get(todayIso) || null
    : null;

  const isOfficialOffDay = officialTodayInfo?.isOffDay === true;
  const isOfficialAdjustedWorkday = officialTodayInfo?.isOffDay === false;

  const themeKey =
    todayItems && todayItems.length > 0
      ? "fest"
      : enableWeekendTheme &&
        (
          isOfficialOffDay ||
          (!isOfficialAdjustedWorkday && (currentDay === 0 || currentDay === 6))
        )
        ? "weekend"
        : "workday";

  const backgroundGradient = {
    type: "linear",
    colors:
      themeKey === "fest"
        ? C.bgFest
        : themeKey === "weekend"
          ? C.bgWeekend
          : C.bgWorkday,
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1, y: 1 }
  };

  if (isSmall) {
    const smallRows = CATEGORY_CONFIG
      .map(cfg => {
        const catTodayItems = todayItemsByCat[cfg.key] || [];
        const fests = [...catTodayItems, ...(result[cfg.key] || [])].slice(0, 2);

        if (fests.length === 0) return null;

        return mkRow([
          mkRow([
            mkSpacer(),
            mkIcon(cfg.icon, cfg.color, 13),
            mkSpacer()
          ], 0, { width: 16 }),

          mkText(
            fests.map(i => formatDisplayItem(i)).join("，"),
            12,
            "medium",
            cfg.color,
            {
              flex: 1,
              maxLines: 1
            }
          )
        ], 6);
      })
      .filter(Boolean);

    return withRefresh({
      type: "widget",
      padding: 10,
      backgroundGradient,
      children: [
        mkRow([
          mkIcon("hourglass.circle.fill", C.main, 16),
          mkText("时光\n倒数", 14, "heavy", C.main, { maxLines: 2 }),
          mkSpacer(),
          ...(
            stickyParts.length > 0
              ? [mkText(stickyParts[0], 11, "bold", C.red, { maxLines: 1 })]
              : []
          )
        ], 6),

        mkSpacer(10),

        {
          type: "stack",
          direction: "column",
          gap: 8,
          flex: 1,
          children: smallRows.length > 0
            ? smallRows
            : [mkText("近期暂无倒计时", 12, "medium", C.muted)]
        }
      ]
    });
  }

  const layoutConfig = {
    fz: isLarge ? 14 : 13.5,
    icz: isLarge ? 15 : 13.5,
    lw: isLarge ? 60 : 52,
    maxW: isLarge ? DISPLAY_LINE_MAX_WIDTH.large : DISPLAY_LINE_MAX_WIDTH.medium,
    rowGap: isLarge ? 6 : 4,
    titleFz: isLarge ? 17 : 15,
    titleIcz: isLarge ? 18 : 16,
    topFz: isLarge ? 13 : 12.5
  };

  const lineKey = isLarge ? "largeLines" : "mediumLines";
  const textKey = isLarge ? "largeText" : "mediumText";

  const gridRows = CATEGORY_CONFIG.flatMap(cfg => {
    const cachedLines = displayCache?.[cfg.key]?.[lineKey];
    const rawText = displayCache?.[cfg.key]?.[textKey] ??
      buildDisplayText(result, cfg.key, isLarge ? 7 : 3);

    if (!rawText) return [];

    const lines = Array.isArray(cachedLines)
      ? cachedLines
      : splitTextToLines(rawText, layoutConfig.maxW);

    return lines.map((lineStr, idx) => ({
      type: "stack",
      direction: "row",
      alignItems: "start",
      gap: layoutConfig.rowGap,
      children: [
        mkRow([
          mkRow([
            mkSpacer(),
            mkIcon(
              idx === 0 ? cfg.icon : "circle.fill",
              idx === 0 ? cfg.color : C.transparent,
              layoutConfig.icz
            ),
            mkSpacer()
          ], 0, { width: layoutConfig.titleIcz }),

          mkText(
            idx === 0 ? cfg.label : " ",
            layoutConfig.fz,
            "heavy",
            idx === 0 ? cfg.color : C.transparent
          ),

          mkSpacer()
        ], 2, { width: layoutConfig.lw }),

        mkText(
          lineStr,
          layoutConfig.fz,
          "medium",
          cfg.key === "exclusive" && /(交割|行权)/.test(lineStr)
            ? C.red
            : C.sub,
          {
            flex: 1,
            maxLines: 1
          }
        )
      ]
    }));
  });

  const rightHeaderElements = [];

  if (todayNoticeText) {
    rightHeaderElements.push(
      mkIcon("sparkles", C.purple, layoutConfig.topFz),
      mkText(todayNoticeText, layoutConfig.topFz, "bold", C.purple)
    );
  } else {
    rightHeaderElements.push(
      mkIcon("tortoise", C.blue2, Math.round(layoutConfig.topFz * 1.5)),
      mkText(
        RANDOM_NOTICES[Math.floor(Math.random() * RANDOM_NOTICES.length)],
        layoutConfig.topFz,
        "medium",
        C.green
      )
    );
  }

  if (stickyText) {
    rightHeaderElements.push(
      mkText(" ｜ ", layoutConfig.topFz, "bold", C.red),
      mkText(stickyText, layoutConfig.topFz, "bold", C.red)
    );
  }

  return withRefresh({
    type: "widget",
    padding: isLarge ? 14 : 12,
    backgroundGradient,
    children: [
      mkRow([
        mkIcon("hourglass.circle.fill", C.main, layoutConfig.titleIcz),
        mkText("时光倒数", layoutConfig.titleFz, "heavy", C.main),
        mkSpacer(),
        mkRow(rightHeaderElements, 4)
      ], 6),

      mkSpacer(gridRows.length <= 4 ? 12 : 10),

      ...(
        gridRows.length > 0
          ? [{
              type: "stack",
              direction: "column",
              alignItems: "start",
              gap: gridRows.length <= 4
                ? isLarge ? 14 : 11
                : isLarge ? 10 : 8,
              children: gridRows
            }]
          : [
              mkText(
                "近期暂无倒计时",
                layoutConfig.fz,
                "medium",
                C.muted
              )
            ]
      ),

      mkSpacer()
    ]
  });
}