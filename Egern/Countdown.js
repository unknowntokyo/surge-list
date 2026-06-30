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

  "OFFICIAL_HOLIDAY_FORCE_REFRESH",

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
  let fp = "";

  for (const key of CACHE_ENV_KEYS) {
    fp += key;
    fp += "=";
    fp += normalizeCacheEnvValue(key, env?.[key]);
    fp += "|";
  }

  return fp;
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

function isValidCachedPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (!payload.result || typeof payload.result !== "object") return false;
  if (!Array.isArray(payload.todayItems)) return false;
  if (!Array.isArray(payload.pinnedData)) return false;

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

const isoToMs = iso => {
  const [y, m, d] = String(iso).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

const isoToSlashYMD = iso => String(iso || "").replace(/-/g, "/");

const isValidISODate = date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return false;
  }

  const [y, m, d] = String(date).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));

  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() + 1 === m &&
    dt.getUTCDate() === d
  );
};

function hashString(str) {
  let h = 5381;

  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }

  return (h >>> 0).toString(36);
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
    .map(day => ({
      name: day.name.trim(),
      date: day.date,
      ms: isoToMs(day.date)
    }))
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
      typeof day.date === "string" &&
      typeof day.isOffDay === "boolean" &&
      isValidISODate(day.date)
    )
    .map(day => ({
      name: day.name.trim(),
      date: day.date,
      isOffDay: day.isOffDay
    }))
    .sort((a, b) => isoToMs(a.date) - isoToMs(b.date));

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
  } catch (e) {}

  return null;
}

function pruneOfficialYears(years, currentYear) {
  const keep = new Set([
    String(currentYear - 1),
    String(currentYear),
    String(currentYear + 1)
  ]);

  const pruned = {};

  for (const [year, data] of Object.entries(years || {})) {
    if (keep.has(year)) {
      pruned[year] = data;
    }
  }

  return pruned;
}

function getMissingOfficialYears(yearsData, requestYears) {
  return requestYears
    .map(String)
    .filter(year => {
      const yearData = yearsData?.[year];

      return !(
        yearData &&
        Array.isArray(yearData.days) &&
        yearData.days.length > 0
      );
    });
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

async function parseHttpJson(resp) {
  if (!resp) {
    throw new Error("empty response");
  }

  if (typeof resp.json === "function") {
    return await resp.json();
  }

  if (typeof resp.text === "function") {
    const raw = await resp.text();

    if (!raw) {
      throw new Error("response text body missing");
    }

    return JSON.parse(raw);
  }

  if (resp.data && typeof resp.data === "object") {
    return resp.data;
  }

  const raw =
    typeof resp.data === "string"
      ? resp.data
      : typeof resp.body === "string"
        ? resp.body
        : typeof resp === "string"
          ? resp
          : "";

  if (!raw) {
    throw new Error("response json body missing");
  }

  return JSON.parse(raw);
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

async function loadOfficialHolidayDaily(ctx, env, currentYear, todayIso) {
  const oldCache = readOfficialHolidayCache(ctx);

  if (!ctx.http || !ctx.storage) {
    return oldCache;
  }

  const forceKey = String(env?.OFFICIAL_HOLIDAY_FORCE_REFRESH ?? "").trim();

  // 业务侧会扫描 [Y - 1, Y, Y + 1]，
  // 因此官方节假日数据也同步拉取上一年、当前年、下一年。
  const requestYears = [currentYear - 1, currentYear, currentYear + 1];
  const yearsKey = requestYears.join(",");

  // 今日已经尝试过相同年份组合，则直接使用缓存。
  // 即使缓存不完整，也不在同一天每次打开小组件时重复请求。
  if (
    oldCache &&
    oldCache.checkedDate === todayIso &&
    oldCache.forceKey === forceKey &&
    oldCache.yearsKey === yearsKey
  ) {
    return oldCache;
  }

  const mergedYears = pruneOfficialYears(oldCache?.years || {}, currentYear);

  const results = await Promise.allSettled(
    requestYears.map(async year => {
      const data = await fetchOfficialHolidayYear(ctx, year);

      return {
        key: String(year),
        data
      };
    })
  );

  let successCount = 0;

  for (const result of results) {
    if (result.status === "fulfilled") {
      const { key, data } = result.value;
      mergedYears[key] = data;
      successCount += 1;
    }
  }

  // 即使部分年份失败，甚至全部失败，也写入"今日已尝试"状态。
  // 这样既避免同一天重复请求，又不会把缓存伪装成完整缓存。
  const missingYears = getMissingOfficialYears(mergedYears, requestYears);

  const newCache = {
    version: OFFICIAL_HOLIDAY_STORAGE_VERSION,
    checkedDate: todayIso,
    forceKey,
    yearsKey,
    complete: missingYears.length === 0,
    missingYears,
    lastSuccessCount: successCount,
    fingerprint: buildOfficialFingerprint(mergedYears),
    years: mergedYears
  };

  try {
    ctx.storage.setJSON(OFFICIAL_HOLIDAY_STORAGE_KEY, newCache);
  } catch (e) {}

  return newCache;
}

function isValidOfficialRange(range) {
  if (!range || typeof range !== "object") return false;
  if (typeof range.name !== "string" || !range.name.trim()) return false;
  if (!isValidISODate(range.start)) return false;

  const duration = Number(range.duration);
  return Number.isInteger(duration) && duration >= 1 && duration <= 30;
}

function getOfficialLegalHolidays(officialHolidayCache, year) {
  const yearData = officialHolidayCache?.years?.[String(year)];

  if (!yearData || !Array.isArray(yearData.days)) {
    return null;
  }

  const ranges = buildOfficialHolidayRanges(yearData.days);

  const rows = ranges
    .filter(isValidOfficialRange)
    .map(range => [
      range.name.trim(),
      isoToSlashYMD(range.start),
      Number(range.duration),
      "official"
    ]);

  return rows.length > 0 ? rows : null;
}

function mergeLegalHolidays(fallbackLegal, officialLegal) {
  if (!Array.isArray(fallbackLegal)) {
    return Array.isArray(officialLegal) ? [...officialLegal] : [];
  }

  if (!Array.isArray(officialLegal) || officialLegal.length === 0) {
    return [...fallbackLegal];
  }

  const officialByName = new Map();

  for (const row of officialLegal) {
    if (!Array.isArray(row)) continue;

    const name = String(row[0] ?? "").trim();

    if (!name) continue;

    officialByName.set(name, row);
  }

  const merged = fallbackLegal.map(row => {
    const name = String(row?.[0] ?? "").trim();

    return officialByName.get(name) || row;
  });

  for (const [name, row] of officialByName.entries()) {
    if (!fallbackLegal.some(item => String(item?.[0] ?? "").trim() === name)) {
      merged.push(row);
    }
  }

  return merged;
}

function getOfficialDayInfo(officialHolidayCache, isoDate) {
  if (!isValidISODate(isoDate)) {
    return null;
  }

  const years = officialHolidayCache?.years;

  if (!years || typeof years !== "object") {
    return null;
  }

  for (const yearData of Object.values(years)) {
    if (!yearData || !Array.isArray(yearData.days)) continue;

    const found = yearData.days.find(day => day.date === isoDate);

    if (found) {
      return found;
    }
  }

  return null;
}

export default async function (ctx = {}) {
  const env = ctx.env ?? {};

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
    env,
    Y,
    todayIso
  );

  const officialFingerprint =
    officialHolidayCache?.fingerprint
      ? `official=${officialHolidayCache.fingerprint}`
      : "official=none";

  const envFingerprint = `${buildEnvFingerprint(env)}|${officialFingerprint}`;

  const CACHE_KEY = "countdown_daily_cache";
  const CACHE_VERSION = 5;
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
    } catch (e) {}
  }

  let result;
  let todayNoticeText;
  let pinnedData;
  let todayItems;

  if (cachedData) {
    ({ result, todayNoticeText, pinnedData, todayItems } = cachedData);
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

    const l2s = (y, m, d) => {
      if (!isValidLunarYear(y)) return null;
      if (!Number.isInteger(m) || m < 1 || m > 12) return null;

      const monthDays = Lunar.mDays(y, m);

      if (!Number.isInteger(d) || d < 1 || d > monthDays) return null;

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

      return YMD(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate()
      );
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

      const officialLegal = getOfficialLegalHolidays(officialHolidayCache, y);
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
      if (!pinnedHolidays.includes(name) || diff > 200) {
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

    // Y - 1: 用于识别跨年假期仍在进行中的情况
    // Y 和 Y + 1: 足以覆盖所有年度重复节日的下一次发生
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
            todayItems
          }
        });
      } catch (e) {}
    }
  }

  const stickyParts = (pinnedData || []).map(p => `${p.name} ${p.diff}天`);
  const stickyText = stickyParts.join("·");

  if (
    typeof ctx.notify === "function" &&
    ctx.storage &&
    Array.isArray(todayItems) &&
    todayItems.length > 0
  ) {
    try {
      const notifyDate = `${Y}-${pad2(M)}-${pad2(D)}`;
      const notifyKey = "countdown_today_notify_once";

      const notified = ctx.storage.getJSON(notifyKey) || {};

      if (notified.date !== notifyDate) {
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
        }
      }
    } catch (e) {}
  }

  const formatStr = (cat, limit) =>
    (result[cat] || [])
      .slice(0, limit)
      .map(i => formatDisplayItem(i))
      .join("，");

  const officialTodayInfo = getOfficialDayInfo(officialHolidayCache, todayIso);

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
        const catTodayItems = (todayItems || []).filter(i => i.cat === cfg.key);
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
    maxW: isLarge ? 36 : 45,
    rowGap: isLarge ? 6 : 4,
    titleFz: isLarge ? 17 : 15,
    titleIcz: isLarge ? 18 : 16,
    topFz: isLarge ? 13 : 12.5
  };

  const gridRows = CATEGORY_CONFIG.flatMap(cfg => {
    const rawText = formatStr(
      cfg.key,
      isLarge ? 7 : 3
    );

    if (!rawText) return [];

    return splitTextToLines(rawText, layoutConfig.maxW).map((lineStr, idx) => ({
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