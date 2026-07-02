/**
 * =========================================
 * 📌 时光倒数 Countdown Widget for Egern
 *
 * 功能：
 * - 支持 systemSmall / systemMedium / systemLarge
 * - 明确不支持锁屏 accessory 组件
 * - 法定节假日优先读取 NateScarlet/holiday-cn 官方放假数据
 * - 官方数据不可用时使用本地 fallback
 * - 清明节 fallback 使用节气算法自动计算，不再支持 QINGMING_DATE 环境变量
 * - 支持自定义专属纪念日
 * - 支持春假 / 秋假自定义日期
 * - 支持置顶节日 PINNED_HOLIDAY
 * - 支持当天通知，每天最多一次
 *
 * 环境变量：
 * - SHOW_SCHOOL_HOLIDAYS=true/false
 * - SHOW_FINANCE_DATES=true/false
 * - ENABLE_PRIORITY_SORT=true/false
 * - ENABLE_EXCLUSIVE_WEIGHT=true/false
 * - ENABLE_WEEKEND_THEME=true/false
 * - SPRING_BREAK_DATE=4/1
 * - AUTUMN_BREAK_DATE=10/15
 * - PINNED_HOLIDAY=春节,国庆,中秋
 * - EXCLUSIVE_NAME / EXCLUSIVE_DATE
 * - EXCLUSIVE_NAME_1 ~ EXCLUSIVE_NAME_6
 * - EXCLUSIVE_DATE_1 ~ EXCLUSIVE_DATE_6
 * =========================================
 */

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

const C = {
  bgWorkday: [
    { light: "#FFFFFF", dark: "#1C1C1E" },
    { light: "#F2F2F7", dark: "#0C0C0E" }
  ],
  bgWeekend: [
    { light: "#F4F8FF", dark: "#111827" },
    { light: "#E6F2FF", dark: "#0B0F19" }
  ],
  bgFest: [
    { light: "#FFF7F0", dark: "#1F1512" },
    { light: "#FFE8E0", dark: "#120C0A" }
  ],
  main: { light: "#1C1C1E", dark: "#FFFFFF" },
  sub: { light: "#48484A", dark: "#D1D1D6" },
  muted: { light: "#8E8E93", dark: "#8E8E93" },
  gold: { light: "#B58A28", dark: "#D6A53A" },
  red: { light: "#CA3B32", dark: "#FF453A" },
  blue: { light: "#3A5F85", dark: "#5E8EB8" },
  teal: { light: "#628C7B", dark: "#73A491" },
  green: { light: "#34C759", dark: "#30D158" },
  purple: { light: "#AF52DE", dark: "#BF5AF2" },
  transparent: "#00000000"
};

const BACKGROUND_GRADIENTS = Object.freeze({
  workday: Object.freeze({
    type: "linear",
    colors: C.bgWorkday,
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1, y: 1 }
  }),
  weekend: Object.freeze({
    type: "linear",
    colors: C.bgWeekend,
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1, y: 1 }
  }),
  fest: Object.freeze({
    type: "linear",
    colors: C.bgFest,
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1, y: 1 }
  })
});

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
const OFFICIAL_OPTIONAL_FAILED_RETRY_INTERVAL_MS = 7 * DAY_MS;

const UNSAFE_CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/g;
const BIDI_CONTROL_CHARS_RE = /[\u202A-\u202E\u2066-\u2069]/g;
const HOLIDAY_LIST_SEPARATOR_RE = /[、，,\/]+/;

const HOLIDAY_ALIAS_MAP = Object.freeze({
  国庆: "国庆节",
  十一: "国庆节",
  劳动: "劳动节",
  五一: "劳动节",
  中秋: "中秋节",
  端午: "端午节",
  清明: "清明节",
  元旦节: "元旦",
  过年: "春节",
  除夕夜: "除夕"
});

const DISPLAY_NAME_MAP = {
  端午节: "🐲",
  七夕节: "💘",
  万圣节: "🎃"
};

const MAX_EXCLUSIVE_COUNT = 6;
const MAX_ENV_TEXT_LENGTH = 80;
const MAX_EXCLUSIVE_NAME_LENGTH = 20;
const MAX_EXCLUSIVE_DATE_LENGTH = 20;
const MAX_PINNED_HOLIDAY_TOTAL_LENGTH = 120;
const MAX_PINNED_HOLIDAY_ITEM_LENGTH = 20;
const MAX_PINNED_HOLIDAY_COUNT = 12;

const OFFICIAL_HOLIDAY_STORAGE_VERSION = 3;
const OFFICIAL_HOLIDAY_STORAGE_KEY_BASE = "countdown_official_holidays";

function warnLog(...args) {
  try {
    if (
      typeof console !== "undefined" &&
      console &&
      typeof console.warn === "function"
    ) {
      console.warn(...args);
    }
  } catch (_) {}
}

function sanitizePlainText(value) {
  return String(value ?? "")
    .replace(UNSAFE_CONTROL_CHARS_RE, "")
    .replace(BIDI_CONTROL_CHARS_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateByCodePoint(value, maxLength) {
  return [...sanitizePlainText(value)].slice(0, maxLength).join("");
}

function splitConfigList(value) {
  return String(value ?? "")
    .split(HOLIDAY_LIST_SEPARATOR_RE)
    .map(s => sanitizePlainText(s))
    .filter(Boolean);
}

function normalizeHolidayName(name) {
  const cleaned = sanitizePlainText(name);
  return cleaned ? HOLIDAY_ALIAS_MAP[cleaned] || cleaned : "";
}

function splitHolidayNames(name) {
  return splitConfigList(name)
    .map(normalizeHolidayName)
    .filter(Boolean);
}

function holidayNameIntersects(a, b) {
  const aParts = splitHolidayNames(a);
  const bParts = splitHolidayNames(b);

  if (aParts.length === 0 || bParts.length === 0) {
    return false;
  }

  const bSet = new Set(bParts);
  return aParts.some(x => bSet.has(x));
}

function getMatchedHolidayNames(name, targetNameSet) {
  if (!(targetNameSet instanceof Set)) {
    return [];
  }

  const matched = [];

  for (const targetName of targetNameSet) {
    if (holidayNameIntersects(name, targetName)) {
      matched.push(targetName);
    }
  }

  return matched;
}

function hasHolidayNameInIterable(iterable, name) {
  if (!iterable || typeof iterable[Symbol.iterator] !== "function") {
    return false;
  }

  for (const existingName of iterable) {
    if (holidayNameIntersects(existingName, name)) {
      return true;
    }
  }

  return false;
}

function getEnvValueMaxLength(key) {
  if (/^EXCLUSIVE_NAME(_\d+)?$/.test(key)) {
    return MAX_EXCLUSIVE_NAME_LENGTH;
  }

  if (/^EXCLUSIVE_DATE(_\d+)?$/.test(key)) {
    return MAX_EXCLUSIVE_DATE_LENGTH;
  }

  if (
    key === "SPRING_BREAK_DATE" ||
    key === "AUTUMN_BREAK_DATE"
  ) {
    return MAX_EXCLUSIVE_DATE_LENGTH;
  }

  if (key === "PINNED_HOLIDAY") {
    return MAX_PINNED_HOLIDAY_TOTAL_LENGTH;
  }

  return MAX_ENV_TEXT_LENGTH;
}

function sanitizeEnvStringValue(key, value) {
  if (value === undefined || value === null) {
    return "";
  }

  const raw = truncateByCodePoint(value, getEnvValueMaxLength(key));

  if (key === "PINNED_HOLIDAY") {
    return splitConfigList(raw)
      .map(v =>
        normalizeHolidayName(
          truncateByCodePoint(v, MAX_PINNED_HOLIDAY_ITEM_LENGTH)
        )
      )
      .filter(Boolean)
      .slice(0, MAX_PINNED_HOLIDAY_COUNT)
      .join(",");
  }

  return raw;
}

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

function hashString(str) {
  let h = 5381;

  for (let i = 0; i < String(str).length; i++) {
    h = ((h << 5) + h) ^ String(str).charCodeAt(i);
  }

  return (h >>> 0).toString(36);
}

const pad2 = n => String(n).padStart(2, "0");

const YMD = (y, m, d) =>
  `${y}/${pad2(m)}/${pad2(d)}`;

const ISO = (y, m, d) =>
  `${y}-${pad2(m)}-${pad2(d)}`;

function msToYMD(ms) {
  if (!Number.isFinite(ms)) return null;

  const d = new Date(ms);

  return YMD(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate()
  );
}

function msToISO(ms) {
  if (!Number.isFinite(ms)) return null;

  const d = new Date(ms);

  return ISO(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate()
  );
}

function parseISODateParts(date) {
  const match = String(date ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

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

function parseSlashDateParts(date) {
  const match = String(date ?? "").match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);

  if (!match) return null;

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

function isValidISODate(date) {
  return parseISODateParts(date) !== null;
}

function isoToMs(iso) {
  const parts = parseISODateParts(iso);
  return parts ? Date.UTC(parts.y, parts.m - 1, parts.d) : NaN;
}

function isoToYMD(iso) {
  const parts = parseISODateParts(iso);
  return parts ? YMD(parts.y, parts.m, parts.d) : null;
}

function slashYMDToMs(dateStr) {
  const parts = parseSlashDateParts(dateStr);
  return parts ? Date.UTC(parts.y, parts.m - 1, parts.d) : NaN;
}

function parseCustomDate(year, value) {
  const s = sanitizePlainText(value);

  if (!s) return null;

  let match = s.match(/^(\d{1,2})[\/.-](\d{1,2})$/);

  if (match) {
    const m = Number(match[1]);
    const d = Number(match[2]);
    const dt = new Date(Date.UTC(year, m - 1, d));

    if (
      dt.getUTCFullYear() === year &&
      dt.getUTCMonth() + 1 === m &&
      dt.getUTCDate() === d
    ) {
      return YMD(year, m, d);
    }

    return null;
  }

  match = s.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);

  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));

    if (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() + 1 === m &&
      dt.getUTCDate() === d
    ) {
      return YMD(y, m, d);
    }
  }

  return null;
}

function getCustomDate(year, value, fallbackFn) {
  return parseCustomDate(year, value) || fallbackFn();
}

function displayName(name) {
  return DISPLAY_NAME_MAP[name] ?? name;
}

function formatPeriodStr(label, diff, duration = 1) {
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
}

function formatItemStr(name, diff, duration = 1) {
  return formatPeriodStr(displayName(name), diff, duration);
}

function formatDisplayItem(item) {
  if (item?.status === "ended") {
    return `${displayName(item.name)}已结束`;
  }

  return formatItemStr(item.name, item.diff, item.duration);
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

function mkText(text, size, weight, color, opts = {}) {
  return {
    type: "text",
    text: String(text ?? ""),
    font: { size, weight },
    textColor: color,
    ...opts
  };
}

function mkRow(children, gap = 4, opts = {}) {
  return {
    type: "stack",
    direction: "row",
    alignItems: "center",
    gap,
    children,
    ...opts
  };
}

function mkColumn(children, gap = 4, opts = {}) {
  return {
    type: "stack",
    direction: "column",
    gap,
    children,
    ...opts
  };
}

function mkIcon(src, color, size = 13) {
  return {
    type: "image",
    src: `sf-symbol:${src}`,
    color,
    width: size,
    height: size
  };
}

function mkSpacer(length) {
  return length != null
    ? { type: "spacer", length }
    : { type: "spacer" };
}

function getBackgroundGradient(themeKey) {
  return BACKGROUND_GRADIENTS[themeKey] || BACKGROUND_GRADIENTS.workday;
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

  lYearDays(y) {
    if (!isValidLunarYear(y)) return 0;

    let sum = 348;
    const info = this.info[y - 1900];

    for (let i = 0x8000; i > 0x8; i >>= 1) {
      sum += info & i ? 1 : 0;
    }

    return sum + this.leapDays(y);
  },

  leapMonth(y) {
    if (!isValidLunarYear(y)) return 0;
    return this.info[y - 1900] & 0xf;
  },

  leapDays(y) {
    if (!isValidLunarYear(y)) return 0;

    if (this.leapMonth(y)) {
      return this.info[y - 1900] & 0x10000 ? 30 : 29;
    }

    return 0;
  },

  monthDays(y, m) {
    if (!isValidLunarYear(y) || m < 1 || m > 12) return 0;
    return this.info[y - 1900] & (0x10000 >> m) ? 30 : 29;
  }
};

const MIN_LUNAR_YEAR = 1900;
const MAX_LUNAR_YEAR = 1900 + Lunar.info.length - 1;

function isValidLunarYear(y) {
  return Number.isInteger(y) &&
    y >= MIN_LUNAR_YEAR &&
    y <= MAX_LUNAR_YEAR;
}

function lunarToSolarYMD(y, lunarMonth, lunarDay) {
  if (
    !isValidLunarYear(y) ||
    lunarMonth < 1 ||
    lunarMonth > 12 ||
    lunarDay < 1 ||
    lunarDay > 30
  ) {
    return null;
  }

  let offset = 0;

  for (let year = MIN_LUNAR_YEAR; year < y; year++) {
    offset += Lunar.lYearDays(year);
  }

  const leapMonth = Lunar.leapMonth(y);

  for (let month = 1; month < lunarMonth; month++) {
    offset += Lunar.monthDays(y, month);

    if (month === leapMonth) {
      offset += Lunar.leapDays(y);
    }
  }

  if (lunarDay > Lunar.monthDays(y, lunarMonth)) {
    return null;
  }

  offset += lunarDay - 1;

  const ms = Date.UTC(1900, 0, 31) + offset * DAY_MS;
  return msToYMD(ms);
}

function l2s(y, m, d) {
  return lunarToSolarYMD(y, m, d);
}

function solarTermDate(y, n) {
  if (!isValidLunarYear(y)) return null;

  const bjDate = new Date(Lunar.term(y, n).getTime() + 8 * 3600000);

  return YMD(
    bjDate.getUTCFullYear(),
    bjDate.getUTCMonth() + 1,
    bjDate.getUTCDate()
  );
}

function nthWeekdayOfMonth(y, m, n, weekday) {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const offset = (weekday - first + 7) % 7;
  return YMD(y, m, 1 + offset + (n - 1) * 7);
}

function lastWeekdayOfMonth(y, m, weekday) {
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lastWeekday = new Date(Date.UTC(y, m - 1, lastDay)).getUTCDay();
  const offset = (lastWeekday - weekday + 7) % 7;
  return YMD(y, m, lastDay - offset);
}

function isValidOfficialDay(day) {
  return (
    day &&
    typeof day === "object" &&
    typeof day.name === "string" &&
    sanitizePlainText(day.name) &&
    typeof day.date === "string" &&
    isValidISODate(day.date) &&
    typeof day.isOffDay === "boolean"
  );
}

function mergeHolidayDisplayNames(...names) {
  const result = [];

  for (const name of names) {
    for (const part of splitConfigList(name)) {
      const normalized = normalizeHolidayName(part);

      if (normalized && !result.includes(normalized)) {
        result.push(normalized);
      }
    }
  }

  return result.join("、");
}

function dedupeOfficialDaysByDate(days) {
  const byDate = new Map();

  for (const day of days || []) {
    if (!isValidOfficialDay(day)) continue;

    const ms = isoToMs(day.date);

    if (!Number.isFinite(ms)) continue;

    const normalized = {
      name: sanitizePlainText(day.name),
      date: day.date,
      isOffDay: day.isOffDay,
      ms
    };

    const old = byDate.get(normalized.date);

    if (!old) {
      byDate.set(normalized.date, normalized);
      continue;
    }

    if (normalized.isOffDay === true && old.isOffDay !== true) {
      byDate.set(normalized.date, {
        ...normalized,
        name: mergeHolidayDisplayNames(old.name, normalized.name)
      });
    } else if (normalized.isOffDay === old.isOffDay) {
      byDate.set(normalized.date, {
        ...old,
        name: mergeHolidayDisplayNames(old.name, normalized.name)
      });
    }
  }

  return [...byDate.values()].sort((a, b) => a.ms - b.ms);
}

function buildOfficialHolidayRanges(days) {
  const offDays = dedupeOfficialDaysByDate(days)
    .filter(day => day.isOffDay === true)
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
    duration: group.duration
  }));
}

function normalizeHolidayCnYearData(data, year) {
  if (!data || typeof data !== "object") {
    throw new Error(`invalid official holiday data: ${year}`);
  }

  if (Number(data.year) !== Number(year)) {
    throw new Error(`official holiday year mismatch: ${year}`);
  }

  if (!Array.isArray(data.days)) {
    throw new Error(`official holiday days missing: ${year}`);
  }

  return {
    days: dedupeOfficialDaysByDate(
      data.days
        .filter(isValidOfficialDay)
        .map(day => ({
          name: sanitizePlainText(day.name),
          date: day.date,
          isOffDay: day.isOffDay,
          ms: isoToMs(day.date)
        }))
        .filter(day => Number.isFinite(day.ms))
    )
  };
}

function isValidOfficialYearData(yearData) {
  return (
    yearData &&
    typeof yearData === "object" &&
    Array.isArray(yearData.days) &&
    yearData.days.length > 0 &&
    yearData.days.every(isValidOfficialDay)
  );
}

function sanitizeOfficialYears(years) {
  const result = {};

  if (!years || typeof years !== "object") {
    return result;
  }

  for (const [year, yearData] of Object.entries(years)) {
    if (!isValidOfficialYearData(yearData)) continue;

    result[String(year)] = {
      days: dedupeOfficialDaysByDate(yearData.days)
    };
  }

  return result;
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

function readOfficialHolidayCache(ctx, storageKey) {
  try {
    const cache = ctx.storage?.getJSON?.(storageKey);

    if (
      cache &&
      cache.version === OFFICIAL_HOLIDAY_STORAGE_VERSION &&
      cache.years &&
      typeof cache.years === "object"
    ) {
      return {
        ...cache,
        years: sanitizeOfficialYears(cache.years)
      };
    }
  } catch (e) {
    warnLog("[Countdown] read official cache failed:", e);
  }

  return null;
}

function hasOfficialYearData(years, year) {
  return isValidOfficialYearData(years?.[String(year)]);
}

function isOfficialRequiredReady(years, currentYear) {
  return officialRequiredYears(currentYear)
    .every(year => hasOfficialYearData(years, year));
}

function isOfficialCacheFresh(cache, todayIso, currentYear) {
  if (!cache || !isValidISODate(cache.checkedDate)) {
    return false;
  }

  if (!isOfficialRequiredReady(cache.years, currentYear)) {
    return false;
  }

  const age = isoToMs(todayIso) - isoToMs(cache.checkedDate);

  return age >= 0 && age < OFFICIAL_REFRESH_INTERVAL_MS;
}

function pruneOfficialYears(years, currentYear) {
  const keep = new Set(officialRequestYears(currentYear).map(String));
  const result = {};

  for (const [year, data] of Object.entries(years || {})) {
    if (!keep.has(String(year))) continue;
    if (!isValidOfficialYearData(data)) continue;

    result[String(year)] = {
      days: dedupeOfficialDaysByDate(data.days)
    };
  }

  return result;
}

function pruneRetryAfterByYear(retryAfterByYear, currentYear) {
  const keep = new Set(officialRequestYears(currentYear).map(String));
  const result = {};
  const now = Date.now();

  for (const [year, value] of Object.entries(retryAfterByYear || {})) {
    const time = Number(value);

    if (
      keep.has(String(year)) &&
      Number.isFinite(time) &&
      time > now
    ) {
      result[String(year)] = time;
    }
  }

  return result;
}

function isOfficialYearRetryBlocked(cache, year, now = Date.now()) {
  const retryAt = Number(cache?.retryAfterByYear?.[String(year)]);
  return Number.isFinite(retryAt) && retryAt > now;
}

function getOfficialFailedRetryIntervalMs(year, currentYear) {
  return officialOptionalYears(currentYear).includes(Number(year))
    ? OFFICIAL_OPTIONAL_FAILED_RETRY_INTERVAL_MS
    : OFFICIAL_FAILED_RETRY_INTERVAL_MS;
}

function buildOfficialFingerprint(yearsData) {
  const parts = [];

  for (const year of Object.keys(yearsData || {}).sort()) {
    const yearData = yearsData[year];

    if (!isValidOfficialYearData(yearData)) continue;

    parts.push(year);

    for (const day of yearData.days) {
      parts.push(`${day.date}:${sanitizePlainText(day.name)}:${day.isOffDay ? 1 : 0}`);
    }
  }

  return parts.length ? hashString(parts.join("|")) : "none";
}

async function parseHttpJson(resp) {
  if (!resp) {
    throw new Error("empty http response");
  }

  if (typeof resp.json === "function") {
    return await resp.json();
  }

  const body =
    resp.body ??
    resp.data ??
    resp.responseText ??
    resp.text;

  if (typeof body === "string") {
    return JSON.parse(body);
  }

  if (body && typeof body === "object") {
    return body;
  }

  throw new Error("invalid http response body");
}

async function fetchOfficialHolidayYear(ctx, year) {
  if (!ctx.http || typeof ctx.http.get !== "function") {
    throw new Error("ctx.http.get unavailable");
  }

  const url =
    `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`;

  const resp = await ctx.http.get(url, {
    timeout: HTTP_TIMEOUT_MS,
    credentials: "omit",
    redirect: "follow",
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

async function loadOfficialHolidayDaily(ctx, currentYear, todayIso, storageKey) {
  const oldCache = readOfficialHolidayCache(ctx, storageKey);

  if (!ctx.http || typeof ctx.http.get !== "function") {
    return oldCache;
  }

  const canUseStorage =
    ctx.storage &&
    typeof ctx.storage.setJSON === "function";

  const mergedYears = pruneOfficialYears(oldCache?.years || {}, currentYear);
  const retryAfterByYear = pruneRetryAfterByYear(
    oldCache?.retryAfterByYear,
    currentYear
  );

  const cacheForFreshCheck = {
    ...oldCache,
    years: mergedYears
  };

  if (isOfficialCacheFresh(cacheForFreshCheck, todayIso, currentYear)) {
    return {
      version: OFFICIAL_HOLIDAY_STORAGE_VERSION,
      checkedDate: oldCache.checkedDate,
      fingerprint: buildOfficialFingerprint(mergedYears),
      retryAfterByYear,
      years: mergedYears
    };
  }

  const todayParts = parseISODateParts(todayIso);
  const currentMonth = todayParts?.m ?? 1;

  const allowOptionalFetch = currentMonth >= 7;
  const requiredYears = officialRequiredYears(currentYear);
  const optionalYears = allowOptionalFetch
    ? officialOptionalYears(currentYear)
    : [];

  const missingRequiredYears = requiredYears
    .filter(year => !hasOfficialYearData(mergedYears, year));

  const missingOptionalYears = optionalYears
    .filter(year => !hasOfficialYearData(mergedYears, year));

  const yearsToFetch = [
    ...new Set([
      ...missingRequiredYears,
      currentYear,
      ...missingOptionalYears
    ])
  ].filter(year =>
    !isOfficialYearRetryBlocked({ retryAfterByYear }, year)
  );

  if (yearsToFetch.length === 0) {
    return {
      version: OFFICIAL_HOLIDAY_STORAGE_VERSION,
      checkedDate: oldCache?.checkedDate,
      fingerprint: buildOfficialFingerprint(mergedYears),
      retryAfterByYear,
      years: mergedYears
    };
  }

  const now = Date.now();

  const results = await Promise.allSettled(
    yearsToFetch.map(year => fetchOfficialHolidayYear(ctx, year))
  );

  const successfulFetchYearSet = new Set();

  for (let i = 0; i < results.length; i++) {
    const year = yearsToFetch[i];
    const key = String(year);
    const result = results[i];

    if (result.status === "fulfilled") {
      mergedYears[key] = result.value;
      delete retryAfterByYear[key];
      successfulFetchYearSet.add(key);
    } else {
      retryAfterByYear[key] =
        now + getOfficialFailedRetryIntervalMs(year, currentYear);

      warnLog("[Countdown] fetch official holiday failed:", key, result.reason);
    }
  }

  const fetchedRequiredYears = yearsToFetch
    .filter(year => requiredYears.includes(year))
    .map(String);

  const allFetchedRequiredYearsSucceeded =
    fetchedRequiredYears.length > 0 &&
    fetchedRequiredYears.every(year => successfulFetchYearSet.has(year));

  const requiredReadyAfterFetch = isOfficialRequiredReady(
    mergedYears,
    currentYear
  );

  const checkedDate =
    allFetchedRequiredYearsSucceeded || requiredReadyAfterFetch
      ? todayIso
      : oldCache?.checkedDate;

  const newCache = {
    version: OFFICIAL_HOLIDAY_STORAGE_VERSION,
    ...(checkedDate ? { checkedDate } : {}),
    fingerprint: buildOfficialFingerprint(mergedYears),
    retryAfterByYear: pruneRetryAfterByYear(retryAfterByYear, currentYear),
    years: pruneOfficialYears(mergedYears, currentYear)
  };

  if (canUseStorage) {
    try {
      ctx.storage.setJSON(storageKey, newCache);
    } catch (e) {
      warnLog("[Countdown] save official cache failed:", e);
    }
  }

  return newCache;
}

async function safeLoadOfficialHolidayDaily(ctx, currentYear, todayIso, storageKey) {
  try {
    return await loadOfficialHolidayDaily(
      ctx,
      currentYear,
      todayIso,
      storageKey
    );
  } catch (e) {
    warnLog("[Countdown] official holiday load failed:", e);

    try {
      return readOfficialHolidayCache(ctx, storageKey);
    } catch (_) {
      return null;
    }
  }
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

function isValidOfficialRange(range) {
  if (!range || typeof range !== "object") return false;
  if (typeof range.name !== "string" || !sanitizePlainText(range.name)) return false;
  if (!isValidISODate(range.start)) return false;

  const duration = Number(range.duration);

  return (
    Number.isInteger(duration) &&
    duration >= 1 &&
    duration <= 30
  );
}

function officialRangeOverlapsYear(range, year) {
  const startMs = Number.isFinite(Number(range.startMs))
    ? Number(range.startMs)
    : isoToMs(range.start);

  const duration = Math.max(1, Number(range.duration) || 1);
  const endMs = Number.isFinite(Number(range.endMs))
    ? Number(range.endMs)
    : startMs + (duration - 1) * DAY_MS;

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return false;
  }

  const yearStartMs = Date.UTC(year, 0, 1);
  const yearEndMs = Date.UTC(year, 11, 31);

  return startMs <= yearEndMs && endMs >= yearStartMs;
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

      const ymd =
        range.startYMD ||
        msToYMD(startMs) ||
        isoToYMD(range.start);

      return [
        sanitizePlainText(range.name),
        ymd,
        Number(range.duration) || 1,
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

  const duration = Math.max(1, Number(row?.[2]) || 1);

  if (!Number.isFinite(startMs)) {
    return Infinity;
  }

  if (!Number.isFinite(fallbackMs)) {
    return 0;
  }

  const endMs = startMs + (duration - 1) * DAY_MS;

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
    sanitizePlainText(row[0]) &&
    typeof row[1] === "string"
  );

  if (officialRows.length === 0) {
    return [...fallbackLegal];
  }

  const merged = [];
  const usedOfficialIndexes = new Set();
  const coveredFallbackNames = new Set();

  for (const row of fallbackLegal) {
    const fallbackName = sanitizePlainText(row?.[0]);

    if (!fallbackName) {
      merged.push(row);
      continue;
    }

    if (hasHolidayNameInIterable(coveredFallbackNames.values(), fallbackName)) {
      continue;
    }

    const fallbackMs = slashYMDToMs(row?.[1]);

    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < officialRows.length; i++) {
      if (usedOfficialIndexes.has(i)) continue;

      const officialName = sanitizePlainText(officialRows[i]?.[0]);

      if (!holidayNameIntersects(officialName, fallbackName)) {
        continue;
      }

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
      const officialRow = officialRows[bestIndex];

      usedOfficialIndexes.add(bestIndex);

      for (const name of splitHolidayNames(officialRow[0])) {
        coveredFallbackNames.add(name);
      }

      merged.push(officialRow);
    } else {
      merged.push(row);
    }
  }

  const fallbackNames = new Set();

  for (const row of fallbackLegal) {
    for (const name of splitHolidayNames(row?.[0])) {
      fallbackNames.add(name);
    }
  }

  for (let i = 0; i < officialRows.length; i++) {
    if (usedOfficialIndexes.has(i)) continue;

    const overlapsFallback = hasHolidayNameInIterable(
      fallbackNames.values(),
      officialRows[i][0]
    );

    if (!overlapsFallback) {
      merged.push(officialRows[i]);
    }
  }

  return merged;
}

function getOfficialDayInfo(officialHolidayCache, todayIso) {
  const years = officialHolidayCache?.years;

  if (!years || typeof years !== "object") {
    return null;
  }

  for (const yearData of Object.values(years)) {
    const matched = yearData?.days?.find(day => day.date === todayIso);

    if (matched) {
      return matched;
    }
  }

  return null;
}

function getSpecialHolidayPriority(name) {
  const names = splitHolidayNames(name);

  let maxPriority = Number.isFinite(specialPriority[name])
    ? specialPriority[name]
    : undefined;

  for (const n of names) {
    const p = specialPriority[n];

    if (Number.isFinite(p)) {
      maxPriority =
        maxPriority === undefined
          ? p
          : Math.max(maxPriority, p);
    }
  }

  return maxPriority;
}

function buildFallbackLegal(year) {
  const qingmingDateStr = solarTermDate(year, 7) || YMD(year, 4, 4);

  return [
    ["元旦", YMD(year, 1, 1), 1],
    ["春节", l2s(year, 1, 1), 3],
    ["清明节", qingmingDateStr, 1],
    ["劳动节", YMD(year, 5, 1), 1],
    ["端午节", l2s(year, 5, 5), 1],
    ["中秋节", l2s(year, 8, 15), 1],
    ["国庆节", YMD(year, 10, 1), 3]
  ].filter(row => row[1]);
}

function buildFolkHolidays(year) {
  const springFestival = l2s(year, 1, 1);
  const springFestivalMs = slashYMDToMs(springFestival);
  const chuXi = Number.isFinite(springFestivalMs)
    ? msToYMD(springFestivalMs - DAY_MS)
    : null;

  return [
    ["除夕", chuXi, 1],
    ["元宵节", l2s(year, 1, 15), 1],
    ["龙抬头", l2s(year, 2, 2), 1],
    ["七夕节", l2s(year, 7, 7), 1],
    ["中元节", l2s(year, 7, 15), 1],
    ["重阳节", l2s(year, 9, 9), 1],
    ["腊八节", l2s(year, 12, 8), 1]
  ].filter(row => row[1]);
}

function buildInternationalHolidays(year) {
  return [
    ["情人节", YMD(year, 2, 14), 1],
    ["妇女节", YMD(year, 3, 8), 1],
    ["植树节", YMD(year, 3, 12), 1],
    ["愚人节", YMD(year, 4, 1), 1],
    ["青年节", YMD(year, 5, 4), 1],
    ["母亲节", nthWeekdayOfMonth(year, 5, 2, 0), 1],
    ["儿童节", YMD(year, 6, 1), 1],
    ["父亲节", nthWeekdayOfMonth(year, 6, 3, 0), 1],
    ["建党节", YMD(year, 7, 1), 1],
    ["建军节", YMD(year, 8, 1), 1],
    ["教师节", YMD(year, 9, 10), 1],
    ["万圣节", YMD(year, 10, 31), 1],
    ["感恩节", nthWeekdayOfMonth(year, 11, 4, 4), 1],
    ["平安夜", YMD(year, 12, 24), 1],
    ["圣诞节", YMD(year, 12, 25), 1]
  ];
}

function buildSchoolHolidays(year, springDateStr, autumnDateStr) {
  const qingmingDateStr = solarTermDate(year, 7) || YMD(year, 4, 4);
  const qmMs = slashYMDToMs(qingmingDateStr);

  const defaultSpring = () => {
    if (!Number.isFinite(qmMs)) return YMD(year, 4, 1);
    return msToYMD(qmMs - 3 * DAY_MS);
  };

  const defaultAutumn = () => YMD(year, 10, 15);

  return [
    ["春假", getCustomDate(year, springDateStr, defaultSpring), 3],
    ["秋假", getCustomDate(year, autumnDateStr, defaultAutumn), 3]
  ].filter(row => row[1]);
}

function buildFinanceDates(year) {
  const rows = [];

  for (let month = 1; month <= 12; month++) {
    rows.push([`${month}月交割`, nthWeekdayOfMonth(year, month, 3, 5), 1]);
    rows.push([`${month}月行权`, lastWeekdayOfMonth(year, month, 3), 1]);
  }

  return rows;
}

function buildExclusiveDates(year, env) {
  const rows = [];

  const pushExclusive = (nameKey, dateKey) => {
    const name = sanitizeEnvStringValue(nameKey, env[nameKey]);
    const dateStr = sanitizeEnvStringValue(dateKey, env[dateKey]);

    if (!name || !dateStr) return;

    const ymd = parseCustomDate(year, dateStr);

    if (!ymd) return;

    rows.push([name, ymd, 1]);
  };

  pushExclusive("EXCLUSIVE_NAME", "EXCLUSIVE_DATE");

  for (let i = 1; i <= MAX_EXCLUSIVE_COUNT; i++) {
    pushExclusive(`EXCLUSIVE_NAME_${i}`, `EXCLUSIVE_DATE_${i}`);
  }

  return rows;
}

function buildFestRowsForYear(year, options) {
  const {
    officialRanges,
    showSchoolHolidays,
    showFinanceDates,
    springDateStr,
    autumnDateStr,
    env
  } = options;

  const fallbackLegal = buildFallbackLegal(year);
  const officialLegal = getOfficialLegalHolidaysFromRanges(
    officialRanges,
    year
  );
  const legal = mergeLegalHolidays(fallbackLegal, officialLegal);
  const folk = buildFolkHolidays(year);
  const intl = buildInternationalHolidays(year);
  const exclusive = [
    ...buildExclusiveDates(year, env)
  ];

  if (showSchoolHolidays) {
    exclusive.push(
      ...buildSchoolHolidays(year, springDateStr, autumnDateStr)
    );
  }

  if (showFinanceDates) {
    exclusive.push(
      ...buildFinanceDates(year)
    );
  }

  return {
    legal,
    folk,
    intl,
    exclusive
  };
}

function normalizeCountdownRow(row, cat, todayMs, options) {
  const name = sanitizePlainText(row?.[0]);
  const ymd = sanitizePlainText(row?.[1]);
  const duration = Math.max(1, Math.min(30, Number(row?.[2]) || 1));
  const source = row?.[3];
  const explicitStartMs = Number(row?.[4]);

  if (!name || !ymd) {
    return null;
  }

  const startMs = Number.isFinite(explicitStartMs)
    ? explicitStartMs
    : slashYMDToMs(ymd);

  if (!Number.isFinite(startMs)) {
    return null;
  }

  const endMs = startMs + (duration - 1) * DAY_MS;

  if (endMs < todayMs) {
    return null;
  }

  const diff = Math.floor((startMs - todayMs) / DAY_MS);

  if (diff > 370) {
    return null;
  }

  const special = getSpecialHolidayPriority(name);
  const priority =
    Number.isFinite(special)
      ? special
      : basePriority[cat] || 0;

  const exclusiveWeight =
    options.enableExclusiveWeight && cat === "exclusive"
      ? 2
      : 0;

  return {
    name,
    date: ymd,
    startMs,
    endMs,
    diff,
    duration,
    cat,
    source,
    priority: priority + exclusiveWeight
  };
}

function buildCountdownData(params) {
  const {
    todayMs,
    currentYear,
    officialRanges,
    showSchoolHolidays,
    showFinanceDates,
    springDateStr,
    autumnDateStr,
    env,
    enablePrioritySort,
    enableExclusiveWeight,
    pinnedHolidaySet
  } = params;

  const result = {
    legal: [],
    folk: [],
    intl: [],
    exclusive: []
  };

  const pinnedMap = new Map();
  const itemKeySet = new Set();

  const years = [
    currentYear - 1,
    currentYear,
    currentYear + 1
  ];

  const addItem = item => {
    if (!item) return;

    const itemKey = `${item.cat}:${item.name}:${item.date}:${item.duration}`;

    if (itemKeySet.has(itemKey)) return;
    itemKeySet.add(itemKey);

    result[item.cat].push(item);

    const matchedPinnedNames = getMatchedHolidayNames(
      item.name,
      pinnedHolidaySet
    );

    for (const pinnedName of matchedPinnedNames) {
      const old = pinnedMap.get(pinnedName);

      if (!old || item.diff < old.diff) {
        pinnedMap.set(pinnedName, {
          name: pinnedName,
          diff: item.diff,
          duration: item.duration
        });
      }
    }
  };

  for (const year of years) {
    const rowsByCat = buildFestRowsForYear(year, {
      officialRanges,
      showSchoolHolidays,
      showFinanceDates,
      springDateStr,
      autumnDateStr,
      env
    });

    for (const cfg of CATEGORY_CONFIG) {
      for (const row of rowsByCat[cfg.key] || []) {
        const item = normalizeCountdownRow(
          row,
          cfg.key,
          todayMs,
          {
            enableExclusiveWeight
          }
        );

        addItem(item);
      }
    }
  }

  const sorter = (a, b) => {
    if (a.diff !== b.diff) return a.diff - b.diff;

    if (enablePrioritySort && b.priority !== a.priority) {
      return b.priority - a.priority;
    }

    if (a.startMs !== b.startMs) return a.startMs - b.startMs;

    return String(a.name).localeCompare(String(b.name), "zh-Hans-CN");
  };

  for (const cfg of CATEGORY_CONFIG) {
    result[cfg.key].sort(sorter);
  }

  const todayItems = CATEGORY_CONFIG
    .flatMap(cfg => result[cfg.key])
    .filter(item => todayMs >= item.startMs && todayMs <= item.endMs)
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.startMs - b.startMs;
    });

  const pinnedData = [...pinnedMap.values()]
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 4);

  return {
    result,
    todayItems,
    pinnedData
  };
}

function buildDisplayText(result, cat, limit) {
  return (result?.[cat] || [])
    .slice(0, limit)
    .map(formatDisplayItem)
    .join("，");
}

function buildRows(result, isLarge) {
  const rows = [];
  const limit = isLarge ? 7 : 3;
  const fontSize = isLarge ? 13.5 : 13;
  const iconSize = isLarge ? 14 : 13;
  const labelWidth = isLarge ? 58 : 54;

  for (const cfg of CATEGORY_CONFIG) {
    const text = buildDisplayText(result, cfg.key, limit);

    if (!text) continue;

    rows.push(
      mkRow([
        mkRow([
          mkIcon(cfg.icon, cfg.color, iconSize),
          mkText(cfg.label, fontSize, "heavy", cfg.color)
        ], 4, {
          width: labelWidth
        }),

        mkText(text, fontSize, "medium", C.sub, {
          flex: 1,
          maxLines: isLarge ? 2 : 1
        })
      ], 6)
    );
  }

  return rows;
}

function buildSmallWidget(data, options) {
  const {
    themeKey,
    todayNoticeText,
    pinnedText,
    refreshAfter
  } = options;

  const firstLegal = data.result.legal[0];
  const firstExclusive = data.result.exclusive[0];
  const second =
    firstExclusive && (!firstLegal || firstExclusive.diff <= firstLegal.diff + 7)
      ? firstExclusive
      : data.result.folk[0] || data.result.intl[0];

  const children = [
    mkRow([
      mkIcon("hourglass.circle.fill", C.main, 15),
      mkText("时光倒数", 15, "heavy", C.main)
    ], 5),

    mkText(todayNoticeText, 11.5, "medium", C.muted, {
      maxLines: 2
    }),

    mkSpacer(4)
  ];

  if (pinnedText) {
    children.push(
      mkText(pinnedText, 12, "semibold", C.red, {
        maxLines: 2
      })
    );
  }

  if (firstLegal) {
    children.push(
      mkRow([
        mkIcon("building.columns.fill", C.red, 12),
        mkText(formatDisplayItem(firstLegal), 13, "semibold", C.sub, {
          maxLines: 1
        })
      ], 4)
    );
  }

  if (second) {
    const cfg = CATEGORY_CONFIG.find(x => x.key === second.cat) ||
      CATEGORY_CONFIG[0];

    children.push(
      mkRow([
        mkIcon(cfg.icon, cfg.color, 12),
        mkText(formatDisplayItem(second), 12.5, "medium", C.sub, {
          maxLines: 1
        })
      ], 4)
    );
  }

  children.push(mkSpacer());

  return {
    type: "widget",
    padding: 12,
    backgroundGradient: getBackgroundGradient(themeKey),
    refreshAfter,
    children
  };
}

function buildMediumLargeWidget(data, options) {
  const {
    isLarge,
    themeKey,
    todayNoticeText,
    pinnedText,
    refreshAfter
  } = options;

  const rows = buildRows(data.result, isLarge);

  const children = [
    mkRow([
      mkRow([
        mkIcon("hourglass.circle.fill", C.main, isLarge ? 18 : 16),
        mkText("时光倒数", isLarge ? 17 : 15.5, "heavy", C.main)
      ], 5),

      mkSpacer(),

      mkText(todayNoticeText, isLarge ? 12.5 : 12, "medium", C.muted, {
        maxLines: 1
      })
    ], 6),

    mkSpacer(isLarge ? 7 : 5)
  ];

  if (pinnedText) {
    children.push(
      mkRow([
        mkIcon("pin.fill", C.red, 12),
        mkText(pinnedText, isLarge ? 13 : 12.5, "semibold", C.red, {
          flex: 1,
          maxLines: 1
        })
      ], 4)
    );

    children.push(mkSpacer(isLarge ? 6 : 4));
  }

  children.push(
    ...rows
  );

  children.push(mkSpacer());

  return {
    type: "widget",
    padding: isLarge ? 14 : 12,
    backgroundGradient: getBackgroundGradient(themeKey),
    refreshAfter,
    children
  };
}

function buildUnsupportedLockScreenWidget(refreshAfter) {
  return {
    type: "widget",
    padding: 8,
    backgroundGradient: getBackgroundGradient("workday"),
    refreshAfter,
    children: [
      mkRow([
        mkIcon("hourglass.circle.fill", C.main, 14),
        mkText("时光倒数", 13, "heavy", C.main)
      ], 5),

      mkSpacer(6),

      mkText("不支持锁屏组件", 12, "heavy", C.red, {
        maxLines: 1
      }),

      mkText("请改用主屏幕小组件", 10.5, "medium", C.muted, {
        maxLines: 2
      })
    ]
  };
}

async function notifyOnceAtMost(ctx, notifyKey, notifyDate, notifyNames) {
  if (
    typeof ctx.notify !== "function" ||
    !ctx.storage ||
    typeof ctx.storage.getJSON !== "function" ||
    typeof ctx.storage.setJSON !== "function" ||
    !Array.isArray(notifyNames) ||
    notifyNames.length === 0
  ) {
    return;
  }

  const safeNames = [
    ...new Set(
      notifyNames
        .map(sanitizePlainText)
        .filter(Boolean)
    )
  ];

  if (safeNames.length === 0) {
    return;
  }

  try {
    const current = ctx.storage.getJSON(notifyKey) || {};

    if (current.date === notifyDate && current.status === "sent") {
      return;
    }

    if (current.date === notifyDate && current.status === "reserved") {
      const reservedTime = Number(current.time);

      if (
        Number.isFinite(reservedTime) &&
        Date.now() - reservedTime < 60 * 1000
      ) {
        return;
      }
    }

    const token = `${Date.now()}:${Math.random().toString(36).slice(2)}`;

    ctx.storage.setJSON(notifyKey, {
      date: notifyDate,
      names: safeNames,
      status: "reserved",
      token,
      time: Date.now()
    });

    const verified = ctx.storage.getJSON(notifyKey) || {};

    if (
      verified.date !== notifyDate ||
      verified.token !== token ||
      verified.status !== "reserved"
    ) {
      return;
    }

    await Promise.resolve(
      ctx.notify({
        title: "✨ 今日提醒",
        body: safeNames.join("、"),
        sound: true
      })
    );

    ctx.storage.setJSON(notifyKey, {
      date: notifyDate,
      names: safeNames,
      status: "sent",
      time: Date.now()
    });
  } catch (e) {
    warnLog("[Countdown] notify failed:", e);

    try {
      ctx.storage?.setJSON?.(notifyKey, {
        date: notifyDate,
        names: safeNames,
        status: "failed",
        failedTime: Date.now()
      });
    } catch (_) {}
  }
}

export default async function (ctx = {}) {
  const env = ctx.env ?? {};

  const scriptName = String(ctx.script?.name || "countdown");
  const storageScope = `countdown:${hashString(scriptName)}`;
  const officialHolidayStorageKey =
    `${storageScope}:${OFFICIAL_HOLIDAY_STORAGE_KEY_BASE}:v${OFFICIAL_HOLIDAY_STORAGE_VERSION}`;

  const getBool = (key, defaultVal = true) =>
    parseBoolValue(env[key], defaultVal);

  const showSchoolHolidays = getBool("SHOW_SCHOOL_HOLIDAYS", true);
  const showFinanceDates = getBool("SHOW_FINANCE_DATES", true);
  const enablePrioritySort = getBool("ENABLE_PRIORITY_SORT", true);
  const enableExclusiveWeight = getBool("ENABLE_EXCLUSIVE_WEIGHT", true);
  const enableWeekendTheme = getBool("ENABLE_WEEKEND_THEME", true);

  const springDateStr = sanitizeEnvStringValue(
    "SPRING_BREAK_DATE",
    env.SPRING_BREAK_DATE
  );

  const autumnDateStr = sanitizeEnvStringValue(
    "AUTUMN_BREAK_DATE",
    env.AUTUMN_BREAK_DATE
  );

  const pinnedHolidaySet = new Set(
    splitConfigList(
      sanitizeEnvStringValue("PINNED_HOLIDAY", env.PINNED_HOLIDAY)
    )
      .map(normalizeHolidayName)
      .filter(Boolean)
  );

  const family = String(ctx.widgetFamily || "systemMedium").toLowerCase();

  const isLockScreenFamily =
    family.includes("accessory") ||
    family.includes("lock") ||
    family.includes("circular") ||
    family.includes("rectangular") ||
    family.includes("inline");

  const isSmall = !isLockScreenFamily && family.includes("small");
  const isLarge = !isLockScreenFamily && family.includes("large");

  const bjDate = new Date(Date.now() + 8 * 3600000);
  const Y = bjDate.getUTCFullYear();
  const M = bjDate.getUTCMonth() + 1;
  const D = bjDate.getUTCDate();
  const currentHour = bjDate.getUTCHours();
  const currentDay = bjDate.getUTCDay();

  const todayMs = Date.UTC(Y, M - 1, D);
  const todayIso = ISO(Y, M, D);

  const nextRefreshMs =
    currentHour < 15
      ? Date.UTC(Y, M - 1, D, 15, 1) - 8 * 3600000
      : Date.UTC(Y, M - 1, D + 1, 0, 1) - 8 * 3600000;

  const refreshAfter = new Date(nextRefreshMs).toISOString();

  if (isLockScreenFamily) {
    return buildUnsupportedLockScreenWidget(refreshAfter);
  }

  const officialHolidayCache = await safeLoadOfficialHolidayDaily(
    ctx,
    Y,
    todayIso,
    officialHolidayStorageKey
  );

  const officialRanges = buildOfficialHolidayRangeCache(
    officialHolidayCache
  );

  const data = buildCountdownData({
    todayMs,
    currentYear: Y,
    officialRanges,
    showSchoolHolidays,
    showFinanceDates,
    springDateStr,
    autumnDateStr,
    env,
    enablePrioritySort,
    enableExclusiveWeight,
    pinnedHolidaySet
  });

  const officialToday = getOfficialDayInfo(
    officialHolidayCache,
    todayIso
  );

  const todayLegalItems = data.todayItems.filter(
    item => item.cat === "legal"
  );

  const isOfficialRestDay =
    officialToday?.isOffDay === true;

  const isWeekend =
    currentDay === 0 ||
    currentDay === 6;

  const hasTodayFestival = data.todayItems.length > 0;

  const themeKey = hasTodayFestival
    ? "fest"
    : enableWeekendTheme && (isOfficialRestDay || (!officialToday && isWeekend))
      ? "weekend"
      : "workday";

  const todayNoticeText = hasTodayFestival
    ? formatTodayFestGroup(data.todayItems)
    : RANDOM_NOTICES[
        Math.abs(hashString(todayIso).split("").reduce(
          (sum, ch) => sum + ch.charCodeAt(0),
          0
        )) % RANDOM_NOTICES.length
      ];

  const pinnedText = data.pinnedData.length > 0
    ? data.pinnedData
        .map(item => formatItemStr(item.name, item.diff, item.duration))
        .join(" · ")
    : "";

  const notifyNames = data.todayItems
    .filter(item => item.diff === 0)
    .map(item => item.name);

  await notifyOnceAtMost(
    ctx,
    `${storageScope}:notify:today`,
    todayIso,
    notifyNames
  );

  if (isSmall) {
    return buildSmallWidget(data, {
      themeKey,
      todayNoticeText,
      pinnedText,
      refreshAfter
    });
  }

  return buildMediumLargeWidget(data, {
    isLarge,
    themeKey,
    todayNoticeText,
    pinnedText,
    refreshAfter
  });
}