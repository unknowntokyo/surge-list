/**
 * 📌 时光倒数 Countdown Widget
 *
 * 精简内容：
 * 1. 仅保留桌面 Medium 小组件。
 * 2. 删除 Small / Large 展示逻辑。
 * 3. 删除学校假期：春假、秋假及相关配置。
 * 4. 删除金融日期：交割、行权及相关配置。
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

const getBackgroundGradient = themeKey =>
  BACKGROUND_GRADIENTS[themeKey] || BACKGROUND_GRADIENTS.workday;

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
  元旦: 7,
  清明节: 7,
  端午节: 7,
  中秋节: 7,
  除夕: 6
};

const DAY_MS = 86400000;
const HTTP_TIMEOUT_MS = 5000;
const WIDGET_OFFICIAL_HTTP_TIMEOUT_MS = 1500;

const OFFICIAL_REFRESH_INTERVAL_MS = 3 * DAY_MS;
const OFFICIAL_FAILED_RETRY_INTERVAL_MS = DAY_MS;
const OFFICIAL_OPTIONAL_FAILED_RETRY_INTERVAL_MS = 7 * DAY_MS;
const OFFICIAL_BACKGROUND_REFRESH_LOCK_TTL_MS = 10 * 60 * 1000;

const NOTIFY_PENDING_TTL_MS = 2 * 60 * 1000;
const NOTIFY_FAILED_RETRY_INTERVAL_MS = 10 * 60 * 1000;

const DISPLAY_MAX_WIDTH = 45;

const LAYOUT_CONFIG = Object.freeze({
  fz: 13.5,
  icz: 13.5,
  lw: 52,
  maxW: DISPLAY_MAX_WIDTH,
  rowGap: 4,
  titleFz: 15,
  titleIcz: 16,
  topFz: 12.5
});

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

const YMD = (y, m, d) => `${y}/${pad2(m)}/${pad2(d)}`;

const msToYMD = ms => {
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  return YMD(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
};

const DISPLAY_NAME_MAP = {
  端午节: "🐲",
  七夕节: "💘",
  万圣节: "🎃"
};

const displayName = name => DISPLAY_NAME_MAP[name] ?? name;

const holidayNamePartsCache = new Map();
const holidayNamePartSetCache = new Map();
const EMPTY_HOLIDAY_NAME_PARTS = Object.freeze([]);

function clearHolidayNameCachesIfNeeded() {
  if (holidayNamePartsCache.size > 256) {
    holidayNamePartsCache.clear();
    holidayNamePartSetCache.clear();
  }
}

function splitHolidayNames(name) {
  const raw = String(name ?? "").trim();
  if (!raw) return EMPTY_HOLIDAY_NAME_PARTS;

  const cached = holidayNamePartsCache.get(raw);
  if (cached) return cached;

  clearHolidayNameCachesIfNeeded();

  const parts = Object.freeze(
    raw
      .split(/[、，,\/]+/)
      .map(s => s.trim())
      .filter(Boolean)
  );

  holidayNamePartsCache.set(raw, parts);
  holidayNamePartSetCache.set(raw, new Set(parts));

  return parts;
}

function getHolidayNamePartSet(name) {
  const raw = String(name ?? "").trim();

  if (!raw) {
    return null;
  }

  const cached = holidayNamePartSetCache.get(raw);
  if (cached) return cached;

  splitHolidayNames(raw);
  return holidayNamePartSetCache.get(raw) || null;
}

function partsIntersect(parts, partSet) {
  if (
    !Array.isArray(parts) ||
    parts.length === 0 ||
    !(partSet instanceof Set) ||
    partSet.size === 0
  ) {
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

  let maxPriority = Number.isFinite(specialPriority[name])
    ? specialPriority[name]
    : undefined;

  for (const n of names) {
    const p = specialPriority[n];

    if (Number.isFinite(p)) {
      maxPriority = maxPriority === undefined
        ? p
        : Math.max(maxPriority, p);
    }
  }

  return maxPriority;
}

function getMatchedHolidayNames(name, targetNameSet) {
  if (!(targetNameSet instanceof Set)) return [];

  const nameParts = splitHolidayNames(name);
  if (nameParts.length === 0) return [];

  const matched = [];

  for (const targetName of targetNameSet) {
    if (partsIntersect(nameParts, getHolidayNamePartSet(targetName))) {
      matched.push(targetName);
    }
  }

  return matched;
}

const formatPeriodStr = (label, diff, duration = 1) => {
  if (diff === 0) return `今日 ${label}`;

  const total = Math.max(1, Number(duration) || 1);

  if (diff < 0 && total > 1) {
    const dayIndex = Math.floor(Math.abs(diff)) + 1;
    return dayIndex >= total
      ? `${label}最后一天`
      : `${label}第${dayIndex}天`;
  }

  return `${label} ${diff}天`;
};

const formatDisplayItem = item => {
  if (item?.status === "ended") {
    return `${displayName(item.name)}已结束`;
  }

  return formatPeriodStr(displayName(item.name), item.diff, item.duration);
};

const formatTodayFestGroup = items => {
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
  const limit = 3;
  const cache = { mode: "medium" };

  for (const cfg of CATEGORY_CONFIG) {
    const text = buildDisplayText(result, cfg.key, limit);

    cache[cfg.key] = {
      text,
      lines: splitTextToLines(text, DISPLAY_MAX_WIDTH)
    };
  }

  return cache;
}

function buildGridRows(displayCache, result, layoutConfig) {
  return CATEGORY_CONFIG.flatMap(cfg => {
    const cachedLines = displayCache?.[cfg.key]?.lines;
    const rawText = displayCache?.[cfg.key]?.text ??
      buildDisplayText(result, cfg.key, 3);

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
          C.sub,
          {
            flex: 1,
            maxLines: 1
          }
        )
      ]
    }));
  });
}

function mkUnsupportedWidget(title, textOpts = {}) {
  return {
    type: "widget",
    padding: 12,
    backgroundGradient: getBackgroundGradient("workday"),
    children: [
      mkRow([
        mkIcon("exclamationmark.triangle.fill", C.red, 16),
        mkText(title, 14, "heavy", C.main)
      ], 6),

      mkSpacer(8),

      mkText(
        "请使用桌面 Medium 小组件",
        12,
        "medium",
        C.sub,
        textOpts
      )
    ]
  };
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

const MAX_ENV_TEXT_LENGTH = 80;
const MAX_EXCLUSIVE_NAME_LENGTH = 20;
const MAX_EXCLUSIVE_DATE_LENGTH = 20;
const MAX_PINNED_HOLIDAY_TOTAL_LENGTH = 120;
const MAX_PINNED_HOLIDAY_ITEM_LENGTH = 20;
const MAX_PINNED_HOLIDAY_COUNT = 12;

function truncateByCodePoint(value, maxLength) {
  const chars = [...String(value ?? "").trim()];
  return chars.slice(0, maxLength).join("");
}

function getEnvValueMaxLength(key) {
  if (/^EXCLUSIVE_NAME(_\d+)?$/.test(key)) {
    return MAX_EXCLUSIVE_NAME_LENGTH;
  }

  if (/^EXCLUSIVE_DATE(_\d+)?$/.test(key)) {
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
    return raw
      .split(",")
      .map(v => truncateByCodePoint(v, MAX_PINNED_HOLIDAY_ITEM_LENGTH))
      .filter(Boolean)
      .slice(0, MAX_PINNED_HOLIDAY_COUNT)
      .join(",");
  }

  return raw;
}

const DATA_ENV_KEYS = Object.freeze([
  "ENABLE_PRIORITY_SORT",
  "ENABLE_EXCLUSIVE_WEIGHT",

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

const RENDER_ENV_KEYS = Object.freeze([
  "ENABLE_WEEKEND_THEME"
]);

const CACHE_ENV_KEYS = Object.freeze([
  ...DATA_ENV_KEYS,
  ...RENDER_ENV_KEYS
]);

const CACHE_BOOL_ENV_KEYS = new Set([
  "ENABLE_PRIORITY_SORT",
  "ENABLE_EXCLUSIVE_WEIGHT",
  "ENABLE_WEEKEND_THEME"
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

  const s = sanitizeEnvStringValue(key, value);

  if (key === "PINNED_HOLIDAY") {
    return s
      .split(",")
      .map(v => v.trim())
      .filter(Boolean)
      .join(",");
  }

  return s;
}

function buildNormalizedEnv(env) {
  const normalized = {};

  for (const key of CACHE_ENV_KEYS) {
    normalized[key] = normalizeCacheEnvValue(key, env?.[key]);
  }

  return normalized;
}

function buildEnvFingerprintFromNormalized(
  normalizedEnv,
  keys = CACHE_ENV_KEYS
) {
  return keys
    .map(key => `${key}=${normalizedEnv?.[key] ?? ""}`)
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

  if (displayCache.mode !== "medium") {
    return false;
  }

  return CATEGORY_CONFIG.every(cfg => {
    const item = displayCache[cfg.key];

    return (
      item &&
      typeof item === "object" &&
      typeof item.text === "string" &&
      isValidStringArray(item.lines)
    );
  });
}

function isValidBaseCachedPayload(payload) {
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

  if (!isValidDisplayCache(payload.displayCache)) {
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
  return parts ? Date.UTC(parts.y, parts.m - 1, parts.d) : NaN;
};

const isoToYMD = iso => {
  const parts = parseISODateParts(iso);
  return parts ? YMD(parts.y, parts.m, parts.d) : null;
};

function hashString(str) {
  let h = 5381;

  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }

  return (h >>> 0).toString(36);
}

const DAILY_CACHE_SCHEMA_VERSION = 17;
const DAILY_CACHE_VERSION_TEXT = `daily:v${DAILY_CACHE_SCHEMA_VERSION}:medium`;

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

function shallowObjectEqual(a = {}, b = {}) {
  const ak = Object.keys(a || {});
  const bk = Object.keys(b || {});

  if (ak.length !== bk.length) {
    return false;
  }

  return ak.every(key => a[key] === b[key]);
}

function shouldSaveOfficialCache(oldCache, newCache) {
  if (!oldCache) return true;

  return (
    oldCache.version !== newCache.version ||
    oldCache.fingerprint !== newCache.fingerprint ||
    oldCache.checkedDate !== newCache.checkedDate ||
    JSON.stringify(oldCache.years || {}) !== JSON.stringify(newCache.years || {}) ||
    !shallowObjectEqual(
      oldCache.retryAfterByYear || {},
      newCache.retryAfterByYear || {}
    )
  );
}

function uniqueFiniteNumbers(arr) {
  return [...new Set((arr || []).map(Number))]
    .filter(Number.isFinite);
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

  return { days };
}

function isValidOfficialDay(day) {
  return (
    day &&
    typeof day === "object" &&
    typeof day.name === "string" &&
    day.name.trim() &&
    typeof day.date === "string" &&
    isValidISODate(day.date) &&
    typeof day.isOffDay === "boolean" &&
    (
      day.ms === undefined ||
      Number.isFinite(Number(day.ms))
    )
  );
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

function normalizeCachedOfficialYearData(yearData) {
  if (!isValidOfficialYearData(yearData)) {
    return null;
  }

  const days = yearData.days
    .map(day => {
      const ms = isoToMs(day.date);

      return {
        name: day.name.trim(),
        date: day.date,
        isOffDay: day.isOffDay,
        ms
      };
    })
    .filter(day => Number.isFinite(day.ms))
    .sort((a, b) => a.ms - b.ms);

  return days.length > 0 ? { days } : null;
}

function sanitizeOfficialYears(years) {
  const sanitized = {};

  if (!years || typeof years !== "object") {
    return sanitized;
  }

  for (const [year, yearData] of Object.entries(years)) {
    const normalized = normalizeCachedOfficialYearData(yearData);

    if (normalized) {
      sanitized[String(year)] = normalized;
    }
  }

  return sanitized;
}

function readOfficialHolidayCache(
  ctx,
  storageKey,
  options = {}
) {
  if (!storageKey) {
    return null;
  }

  const { sanitize = true } = options || {};

  try {
    const cache = ctx.storage?.getJSON(storageKey);

    if (
      cache &&
      cache.version === OFFICIAL_HOLIDAY_STORAGE_VERSION &&
      cache.years &&
      typeof cache.years === "object"
    ) {
      return {
        ...cache,
        years: sanitize
          ? sanitizeOfficialYears(cache.years)
          : cache.years
      };
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

function getOfficialFailedRetryIntervalMs(year, currentYear) {
  return officialOptionalYears(currentYear).includes(Number(year))
    ? OFFICIAL_OPTIONAL_FAILED_RETRY_INTERVAL_MS
    : OFFICIAL_FAILED_RETRY_INTERVAL_MS;
}

function pruneOfficialYears(years, currentYear) {
  const keep = new Set(officialRequestYears(currentYear).map(String));
  const pruned = {};

  for (const [year, data] of Object.entries(years || {})) {
    if (!keep.has(String(year))) {
      continue;
    }

    const normalized = normalizeCachedOfficialYearData(data);

    if (normalized) {
      pruned[String(year)] = normalized;
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
  return isValidOfficialYearData(yearsData?.[String(year)]);
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

    if (!isValidOfficialYearData(yearData)) continue;

    parts.push(year);

    for (const day of yearData.days) {
      parts.push(`${day.date}:${day.name.trim()}:${day.isOffDay ? 1 : 0}`);
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

function normalizeOfficialCachePayload(
  oldCache,
  years,
  currentYear,
  todayIso,
  retryAfterByYearOverride
) {
  const requiredReady = isOfficialRequiredReady(years, currentYear);

  const checkedDate = isValidISODate(oldCache?.checkedDate)
    ? oldCache.checkedDate
    : requiredReady
      ? todayIso
      : undefined;

  return {
    version: OFFICIAL_HOLIDAY_STORAGE_VERSION,
    ...(checkedDate ? { checkedDate } : {}),
    fingerprint: buildOfficialFingerprint(years),
    retryAfterByYear: pruneRetryAfterByYear(
      retryAfterByYearOverride ?? oldCache?.retryAfterByYear,
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

function normalizeHttpTimeoutMs(value, fallback = HTTP_TIMEOUT_MS) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return fallback;
  }

  return Math.max(500, Math.min(n, HTTP_TIMEOUT_MS));
}

async function fetchOfficialHolidayYear(
  ctx,
  year,
  timeoutMs = HTTP_TIMEOUT_MS
) {
  if (!ctx.http || typeof ctx.http.get !== "function") {
    throw new Error("ctx.http unavailable");
  }

  const requestTimeoutMs = normalizeHttpTimeoutMs(timeoutMs);
  const url = `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`;

  const resp = await ctx.http.get(url, {
    timeout: requestTimeoutMs,
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

async function loadOfficialHolidayDaily(
  ctx,
  currentYear,
  todayIso,
  storageKey,
  options = {}
) {
  if (!storageKey) {
    throw new Error("official holiday storageKey required");
  }

  const {
    httpTimeoutMs = HTTP_TIMEOUT_MS,
    includeOptional = true,
    forceYearsToFetch = null
  } = options || {};

  const requestTimeoutMs = normalizeHttpTimeoutMs(httpTimeoutMs);
  const oldCache = readOfficialHolidayCache(ctx, storageKey);

  if (!ctx.http || !ctx.storage) {
    return oldCache;
  }

  const requiredYears = officialRequiredYears(currentYear);
  const optionalYears = officialOptionalYears(currentYear);
  const mergedYears = pruneOfficialYears(oldCache?.years || {}, currentYear);

  const retryAfterByYear = pruneRetryAfterByYear(
    oldCache?.retryAfterByYear,
    currentYear
  );

  const now = Date.now();

  const cacheForFreshCheck = {
    ...oldCache,
    years: mergedYears,
    retryAfterByYear
  };

  const requiredFresh = isOfficialCacheFresh(
    cacheForFreshCheck,
    todayIso,
    currentYear
  );

  const todayParts = parseISODateParts(todayIso);
  const currentMonth = todayParts?.m ?? 1;

  const missingRequiredYears = getMissingOfficialYears(
    mergedYears,
    requiredYears
  ).map(Number);

  const missingOptionalYears = getMissingOfficialYears(
    mergedYears,
    optionalYears
  ).map(Number);

  const allowOptionalFetch = includeOptional && currentMonth >= 7;

  const buildFetchCandidates = () => {
    if (requiredFresh) {
      return allowOptionalFetch
        ? missingOptionalYears
        : [];
    }

    if (missingRequiredYears.length > 0) {
      const currentYearMissing = !hasOfficialYearData(
        mergedYears,
        currentYear
      );

      return [
        ...missingRequiredYears,
        ...(
          includeOptional && currentYearMissing
            ? [currentYear]
            : []
        ),
        ...(
          allowOptionalFetch
            ? missingOptionalYears
            : []
        )
      ];
    }

    return [
      currentYear,
      ...(
        allowOptionalFetch
          ? missingOptionalYears
          : []
      )
    ];
  };

  const rawFetchCandidates = Array.isArray(forceYearsToFetch)
    ? forceYearsToFetch
    : buildFetchCandidates();

  const yearsToFetch = uniqueFiniteNumbers(rawFetchCandidates)
    .filter(year =>
      !isOfficialYearRetryBlocked({ retryAfterByYear }, year, now)
    );

  if (yearsToFetch.length === 0) {
    const normalizedCache = normalizeOfficialCachePayload(
      oldCache,
      mergedYears,
      currentYear,
      todayIso,
      retryAfterByYear
    );

    try {
      if (shouldSaveOfficialCache(oldCache, normalizedCache)) {
        ctx.storage.setJSON(storageKey, normalizedCache);
      }
    } catch (e) {
      warnLog("[Countdown] failed to save normalized official holiday cache:", e);
    }

    return normalizedCache;
  }

  const results = await Promise.allSettled(
    yearsToFetch.map(year =>
      fetchOfficialHolidayYear(ctx, year, requestTimeoutMs)
    )
  );

  const successfulFetchYearSet = new Set();

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const year = yearsToFetch[i];
    const key = String(year);

    if (result.status === "fulfilled") {
      mergedYears[key] = result.value;
      delete retryAfterByYear[key];
      successfulFetchYearSet.add(key);
    } else {
      retryAfterByYear[key] =
        now + getOfficialFailedRetryIntervalMs(year, currentYear);

      warnLog(
        "[Countdown] failed to fetch official holiday:",
        key,
        result.reason
      );
    }
  }

  const fetchedRequiredYears = yearsToFetch
    .filter(year => requiredYears.includes(year))
    .map(String);

  const previousCheckedDate = isValidISODate(oldCache?.checkedDate)
    ? oldCache.checkedDate
    : undefined;

  const checkedDate = (
    isOfficialRequiredReady(mergedYears, currentYear) &&
    (
      fetchedRequiredYears.length === 0 ||
      fetchedRequiredYears.every(year => successfulFetchYearSet.has(year))
    )
  )
    ? todayIso
    : previousCheckedDate;

  const newCache = {
    version: OFFICIAL_HOLIDAY_STORAGE_VERSION,
    ...(checkedDate ? { checkedDate } : {}),
    fingerprint: buildOfficialFingerprint(mergedYears),
    retryAfterByYear: pruneRetryAfterByYear(
      retryAfterByYear,
      currentYear
    ),
    years: mergedYears
  };

  try {
    if (shouldSaveOfficialCache(oldCache, newCache)) {
      ctx.storage.setJSON(storageKey, newCache);
    }
  } catch (e) {
    warnLog("[Countdown] failed to save official holiday cache:", e);
  }

  return newCache;
}

async function safeLoadOfficialHolidayDaily(
  ctx,
  currentYear,
  todayIso,
  storageKey,
  options = {}
) {
  if (!storageKey) {
    return null;
  }

  try {
    return await loadOfficialHolidayDaily(
      ctx,
      currentYear,
      todayIso,
      storageKey,
      options
    );
  } catch (e) {
    warnLog(
      "[Countdown] official holiday load failed, fallback to local/cache:",
      e
    );

    try {
      return readOfficialHolidayCache(ctx, storageKey);
    } catch (cacheError) {
      warnLog(
        "[Countdown] failed to read official holiday cache after load failure:",
        cacheError
      );

      return null;
    }
  }
}

function getOfficialRefreshLockKey(storageKey) {
  return `${storageKey}:refresh_lock`;
}

function tryAcquireOfficialRefreshLock(ctx, lockKey, now = Date.now()) {
  if (!ctx.storage || !lockKey) return null;

  const owner = `${now}:${Math.random().toString(36).slice(2)}`;

  try {
    const lock = ctx.storage.getJSON(lockKey);

    if (
      lock &&
      Number.isFinite(Number(lock.expiresAt)) &&
      Number(lock.expiresAt) > now
    ) {
      return null;
    }

    ctx.storage.setJSON(lockKey, {
      owner,
      startedAt: now,
      expiresAt: now + OFFICIAL_BACKGROUND_REFRESH_LOCK_TTL_MS
    });

    const confirmed = ctx.storage.getJSON(lockKey);

    return confirmed?.owner === owner
      ? owner
      : null;
  } catch (e) {
    warnLog("[Countdown] failed to acquire official refresh lock:", e);
    return null;
  }
}

function releaseOfficialRefreshLock(ctx, lockKey, owner) {
  if (!ctx.storage || !lockKey || !owner) return;

  try {
    const lock = ctx.storage.getJSON(lockKey);

    if (lock?.owner === owner) {
      if (typeof ctx.storage.delete === "function") {
        ctx.storage.delete(lockKey);
      } else {
        ctx.storage.setJSON(lockKey, {
          releasedAt: Date.now(),
          expiresAt: 0
        });
      }
    }
  } catch (e) {
    warnLog("[Countdown] failed to release official refresh lock:", e);
  }
}

function isValidOfficialRange(range) {
  if (!range || typeof range !== "object") return false;
  if (typeof range.name !== "string" || !range.name.trim()) return false;
  if (!isValidISODate(range.start)) return false;

  const duration = Number(range.duration);

  if (
    !Number.isInteger(duration) ||
    duration < 1 ||
    duration > 30
  ) {
    return false;
  }

  if (
    range.end !== undefined &&
    !isValidISODate(range.end)
  ) {
    return false;
  }

  if (
    range.startMs !== undefined &&
    !Number.isFinite(Number(range.startMs))
  ) {
    return false;
  }

  if (
    range.endMs !== undefined &&
    !Number.isFinite(Number(range.endMs))
  ) {
    return false;
  }

  if (
    range.startMs !== undefined &&
    range.endMs !== undefined &&
    Number(range.endMs) < Number(range.startMs)
  ) {
    return false;
  }

  return true;
}

function parseSlashDateSpec(raw) {
  const s = String(raw ?? "").trim();

  let match = s.match(/^(\d{1,2})\/(\d{1,2})$/);

  if (match) {
    return {
      type: "annual",
      month: Number(match[1]),
      day: Number(match[2])
    };
  }

  match = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);

  if (match) {
    return {
      type: "once",
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3])
    };
  }

  return null;
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

  const merged = [];
  const usedOfficialIndexes = new Set();
  const coveredFallbackNames = new Set();

  for (const row of fallbackLegal) {
    const fallbackName = String(row?.[0] ?? "").trim();

    if (!fallbackName) {
      merged.push(row);
      continue;
    }

    if (coveredFallbackNames.has(fallbackName)) {
      continue;
    }

    const fallbackMs = slashYMDToMs(row?.[1]);
    let bestIndex = -1;
    let bestDistance = Infinity;
    const fallbackPartSet = getHolidayNamePartSet(fallbackName);

    for (let i = 0; i < officialRows.length; i++) {
      if (usedOfficialIndexes.has(i)) continue;

      const officialName = String(officialRows[i]?.[0] ?? "").trim();

      if (!partsIntersect(splitHolidayNames(officialName), fallbackPartSet)) {
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

  const fallbackNames = new Set(
    fallbackLegal
      .map(row => String(row?.[0] ?? "").trim())
      .filter(Boolean)
  );

  for (let i = 0; i < officialRows.length; i++) {
    if (usedOfficialIndexes.has(i)) continue;

    const officialNameParts = splitHolidayNames(officialRows[i][0]);

    const overlapsFallback = officialNameParts.some(name =>
      fallbackNames.has(name)
    );

    if (!overlapsFallback) {
      merged.push(officialRows[i]);
    }
  }

  return merged;
}

function getOfficialDayInfo(officialHolidayCache, todayIso) {
  const parts = parseISODateParts(todayIso);

  if (!parts) {
    return null;
  }

  const days = officialHolidayCache?.years?.[String(parts.y)]?.days;

  if (!Array.isArray(days)) {
    return null;
  }

  return days.find(day =>
    day &&
    day.date === todayIso &&
    typeof day.isOffDay === "boolean"
  ) || null;
}

function notifyTodayIfNeeded(ctx, notifyKey, notifyDate, todayItems) {
  if (
    typeof ctx.notify !== "function" ||
    !ctx.storage ||
    !Array.isArray(todayItems) ||
    todayItems.length === 0
  ) {
    return;
  }

  try {
    const notifyItems = todayItems
      .filter(i => i && i.diff === 0 && i.status !== "ended")
      .sort((a, b) => {
        const pa = a.priority ?? 0;
        const pb = b.priority ?? 0;

        if (pb !== pa) {
          return pb - pa;
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

    if (notifyNames.length === 0) {
      return;
    }

    const sameStringArray = (a, b) =>
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => v === b[i]);

    const now = Date.now();
    const currentNotifyState = ctx.storage.getJSON(notifyKey) || {};

    if (
      currentNotifyState.date === notifyDate &&
      sameStringArray(currentNotifyState.names, notifyNames)
    ) {
      const pending = currentNotifyState.pending === true;
      const failed = currentNotifyState.failed === true;
      const lastTime = Number(currentNotifyState.time) || 0;
      const retryAfter = Number(currentNotifyState.retryAfter) || 0;

      if (!pending && !failed) {
        return;
      }

      if (pending && now - lastTime < NOTIFY_PENDING_TTL_MS) {
        return;
      }

      if (failed && retryAfter > now) {
        return;
      }
    }

    const markPending = () => {
      ctx.storage.setJSON(notifyKey, {
        date: notifyDate,
        names: notifyNames,
        time: Date.now(),
        pending: true,
        failed: false
      });
    };

    const markSuccess = () => {
      ctx.storage.setJSON(notifyKey, {
        date: notifyDate,
        names: notifyNames,
        time: Date.now(),
        pending: false,
        failed: false
      });
    };

    const markFailed = e => {
      warnLog("[Countdown] notify failed:", e);

      try {
        ctx.storage.setJSON(notifyKey, {
          date: notifyDate,
          names: notifyNames,
          time: Date.now(),
          pending: false,
          failed: true,
          retryAfter: Date.now() + NOTIFY_FAILED_RETRY_INTERVAL_MS,
          error: String(e?.message || e || "notify failed").slice(0, 120)
        });
      } catch (_) {
      }
    };

    markPending();

    try {
      const maybePromise = ctx.notify({
        title: "✨ 今日提醒",
        body: notifyNames.join("、"),
        sound: true
      });

      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise
          .then(markSuccess)
          .catch(markFailed);
      } else {
        markSuccess();
      }
    } catch (e) {
      markFailed(e);
    }
  } catch (e) {
    warnLog("[Countdown] notify process failed:", e);
  }
}

export default async function (ctx = {}) {
  const env = ctx.env ?? {};
  const normalizedEnv = buildNormalizedEnv(env);

  const scriptName = String(ctx.script?.name || "countdown");
  const storageScope = `countdown:${hashString(scriptName)}`;
  const officialHolidayStorageKey =
    `${storageScope}:official_holidays:v${OFFICIAL_HOLIDAY_STORAGE_VERSION}`;

  const dataEnvStorageFingerprint =
    buildEnvFingerprintFromNormalized(normalizedEnv, DATA_ENV_KEYS);

  const getBool = (key, defaultVal = true) => {
    const value = normalizedEnv[key];

    if (value === undefined || value === "") {
      return defaultVal;
    }

    if (value === "1") return true;
    if (value === "0") return false;

    return parseBoolValue(value, defaultVal);
  };

  const enableWeekendTheme = getBool("ENABLE_WEEKEND_THEME", true);

  const family = String(ctx.widgetFamily || "systemMedium").toLowerCase();

  const isLockScreenFamily =
    family.includes("accessory") ||
    family.includes("lockscreen") ||
    family.includes("lock_screen") ||
    family.includes("lock-screen");

  if (isLockScreenFamily) {
    return mkUnsupportedWidget("不支持锁屏组件");
  }

  if (family === "systemsmall" || family === "systemlarge") {
    return mkUnsupportedWidget("仅支持 Medium 组件", { maxLines: 2 });
  }

  const isExtraLarge =
    family.includes("extralarge") ||
    family.includes("extra_large") ||
    family.includes("extra-large");

  if (isExtraLarge) {
    return mkUnsupportedWidget("暂不支持 Extra Large", { maxLines: 2 });
  }

  const bjDate = new Date(Date.now() + 8 * 3600000);
  const Y = bjDate.getUTCFullYear();
  const M = bjDate.getUTCMonth() + 1;
  const D = bjDate.getUTCDate();
  const currentDay = bjDate.getUTCDay();
  const todayMs = Date.UTC(Y, M - 1, D);
  const todayIso = `${Y}-${pad2(M)}-${pad2(D)}`;

  const nextRefreshMs = Date.UTC(Y, M - 1, D + 1, 0, 1) - 8 * 3600000;

  const withRefresh = widget => ({
    ...widget,
    refreshAfter: new Date(nextRefreshMs).toISOString()
  });

  const BASE_CACHE_KEY = `${storageScope}:daily:base`;
  const NOTIFY_KEY = `${storageScope}:notify`;

  const CACHE_VERSION = DAILY_CACHE_VERSION_TEXT;
  const todayStr = `${Y}_${M}_${D}`;

  const getOfficialFingerprintText = cache =>
    cache?.fingerprint
      ? `official=${cache.fingerprint}`
      : "official=none";

  const readBaseDailyCache = currentEnvFingerprint => {
    if (!ctx.storage) return null;

    try {
      const stored = ctx.storage.getJSON(BASE_CACHE_KEY);

      if (
        stored &&
        stored.version === CACHE_VERSION &&
        stored.date === todayStr &&
        stored.envFingerprint === currentEnvFingerprint &&
        isValidBaseCachedPayload(stored.payload)
      ) {
        return stored.payload;
      }
    } catch (e) {
      warnLog("[Countdown] failed to read base daily cache:", e);
    }

    return null;
  };

  let officialHolidayCache = readOfficialHolidayCache(
    ctx,
    officialHolidayStorageKey,
    {
      sanitize: false
    }
  );

  let officialFingerprint = getOfficialFingerprintText(officialHolidayCache);
  let envFingerprint = `${dataEnvStorageFingerprint}|${officialFingerprint}`;

  let cachedBaseData = readBaseDailyCache(envFingerprint);

  if (!cachedBaseData) {
    const shouldBlockingRefreshOfficialHoliday =
      Boolean(ctx.http && ctx.storage) &&
      !isOfficialRequiredReady(officialHolidayCache?.years, Y);

    if (shouldBlockingRefreshOfficialHoliday) {
      const lockKey = getOfficialRefreshLockKey(officialHolidayStorageKey);
      const lockOwner = tryAcquireOfficialRefreshLock(ctx, lockKey);

      if (lockOwner) {
        try {
          officialHolidayCache = await safeLoadOfficialHolidayDaily(
            ctx,
            Y,
            todayIso,
            officialHolidayStorageKey,
            {
              httpTimeoutMs: WIDGET_OFFICIAL_HTTP_TIMEOUT_MS,
              includeOptional: false,
              forceYearsToFetch: getMissingOfficialYears(
                officialHolidayCache?.years,
                officialRequiredYears(Y)
              ).map(Number)
            }
          );

          officialFingerprint = getOfficialFingerprintText(officialHolidayCache);
          envFingerprint = `${dataEnvStorageFingerprint}|${officialFingerprint}`;

          cachedBaseData = readBaseDailyCache(envFingerprint);
        } finally {
          releaseOfficialRefreshLock(ctx, lockKey, lockOwner);
        }
      } else {
        officialHolidayCache = readOfficialHolidayCache(
          ctx,
          officialHolidayStorageKey,
          {
            sanitize: false
          }
        );

        officialFingerprint = getOfficialFingerprintText(officialHolidayCache);
        envFingerprint = `${dataEnvStorageFingerprint}|${officialFingerprint}`;

        cachedBaseData = readBaseDailyCache(envFingerprint);
      }
    }
  }

  if (!cachedBaseData && officialHolidayCache?.years) {
    officialHolidayCache = {
      ...officialHolidayCache,
      years: sanitizeOfficialYears(officialHolidayCache.years)
    };
  }

  let result;
  let todayNoticeText;
  let pinnedData;
  let todayItems;
  let displayCache;

  if (cachedBaseData) {
    ({
      result,
      todayNoticeText,
      pinnedData,
      todayItems,
      displayCache
    } = cachedBaseData);
  } else {
    const officialRanges = buildOfficialHolidayRangeCache(officialHolidayCache);

    const getStr = (key, defaultVal = "") => {
      const value = normalizedEnv[key];

      if (value === undefined || value === "") {
        return sanitizeEnvStringValue(key, defaultVal);
      }

      return value;
    };

    const enablePrioritySort = getBool("ENABLE_PRIORITY_SORT", true);
    const enableExclusiveWeight = getBool("ENABLE_EXCLUSIVE_WEIGHT", true);

    const pinnedHolidays = [
      ...new Set(
        getStr("PINNED_HOLIDAY")
          .split(",")
          .map(s => s.trim())
          .filter(Boolean)
      )
    ];

    const pinnedHolidaySet = new Set(pinnedHolidays);

    const isValidMonthDay = (y, m, d) => {
      if (!Number.isInteger(m) || !Number.isInteger(d)) return false;
      if (m < 1 || m > 12) return false;

      const maxDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return d >= 1 && d <= maxDay;
    };

    const parseExclusiveDateSpec = raw => {
      const spec = parseSlashDateSpec(raw);

      if (!spec) {
        return null;
      }

      if (spec.type === "annual") {
        if (!isValidMonthDay(2000, spec.month, spec.day)) {
          return null;
        }

        return spec;
      }

      if (spec.type === "once") {
        if (spec.year < 1900 || spec.year > 9999) {
          return null;
        }

        if (!isValidMonthDay(spec.year, spec.month, spec.day)) {
          return null;
        }

        return spec;
      }

      return null;
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

    const annualCustomDays = customDays.filter(
      item => item.spec.type === "annual"
    );

    const onceCustomDays = customDays.filter(
      item => item.spec.type === "once"
    );

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

      const qmDateStr = term(7);

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

      return {
        legal,

        exclusive: annualCustomDays.map(item => {
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

      const special = getSpecialHolidayPriority(name);

      return special ?? basePriority[cat] ?? 1;
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
    const todayFestTokenSet = new Set();
    const todayItemKeySet = new Set();
    const pinnedMap = new Map();
    const pinnedTokenSet = new Set();

    todayItems = [];

    const updatePinned = (name, diff) => {
      const matchedPinnedNames = getMatchedHolidayNames(
        name,
        pinnedHolidaySet
      );

      if (matchedPinnedNames.length === 0) {
        return;
      }

      for (const pinnedName of matchedPinnedNames) {
        const oldPinnedDiff = pinnedMap.get(pinnedName);

        if (oldPinnedDiff === undefined || diff < oldPinnedDiff) {
          pinnedMap.set(pinnedName, diff);
          addHolidayNameTokens(pinnedTokenSet, pinnedName);
        }
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
        if (!holidayNameMatchesTokenSet(name, todayFestTokenSet)) {
          addHolidayNameTokens(todayFestTokenSet, name);

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

    for (const item of onceCustomDays) {
      const { year, month, day } = item.spec;

      addFestival(
        "exclusive",
        item.name,
        YMD(year, month, day),
        1,
        "custom"
      );
    }

    result = {};

    Object.keys(rawResult).forEach(cat => {
      result[cat] = Array.from(rawResult[cat].values())
        .filter(i =>
          !holidayNameMatchesTokenSet(i.name, pinnedTokenSet) &&
          !holidayNameMatchesTokenSet(i.name, todayFestTokenSet)
        )
        .sort((a, b) => {
          if (a.diff !== b.diff) return a.diff - b.diff;
          return enablePrioritySort ? b.priority - a.priority : 0;
        })
        .slice(0, 7);
    });

    todayNoticeText = todayFests.length > 0
      ? formatTodayFestGroup(todayFests)
      : "";

    pinnedData = pinnedHolidays
      .filter(n => pinnedMap.has(n))
      .map(n => ({
        name: n,
        diff: pinnedMap.get(n)
      }))
      .sort((a, b) => a.diff - b.diff);

    displayCache = buildDisplayCache(result);

    if (ctx.storage) {
      try {
        ctx.storage.setJSON(BASE_CACHE_KEY, {
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
        warnLog("[Countdown] failed to save base daily cache:", e);
      }
    }
  }

  if (!displayCache || !isValidDisplayCache(displayCache)) {
    displayCache = buildDisplayCache(result);
  }

  const stickyParts = (pinnedData || []).map(p => `${p.name} ${p.diff}天`);
  const stickyText = stickyParts.join("·");

  notifyTodayIfNeeded(
    ctx,
    NOTIFY_KEY,
    `${Y}-${pad2(M)}-${pad2(D)}`,
    todayItems
  );

  const officialTodayInfo = enableWeekendTheme
    ? getOfficialDayInfo(officialHolidayCache, todayIso)
    : null;

  const isOfficialOffDay = officialTodayInfo?.isOffDay === true;
  const isOfficialAdjustedWorkday = officialTodayInfo?.isOffDay === false;

  const hasActiveTodayItem =
    Array.isArray(todayItems) &&
    todayItems.some(item => item && item.status !== "ended");

  const themeKey =
    hasActiveTodayItem
      ? "fest"
      : enableWeekendTheme &&
        (
          isOfficialOffDay ||
          (!isOfficialAdjustedWorkday && (currentDay === 0 || currentDay === 6))
        )
        ? "weekend"
        : "workday";

  const backgroundGradient = getBackgroundGradient(themeKey);

  const layoutConfig = LAYOUT_CONFIG;

  const gridRows = buildGridRows(displayCache, result, layoutConfig);

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
    padding: 12,
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
              gap: gridRows.length <= 4 ? 11 : 8,
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