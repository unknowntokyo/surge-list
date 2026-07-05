/**
 * =========================================
 * 📌 时光倒数 (Countdown) 小组件
 *
 * ✨ 主要功能：
 * • 尺寸适配：支持桌面 Small、Medium、Large 三种组件尺寸，不支持锁屏组件，区分紧凑列表与定宽多行列表排版。
 * • 节日计算：内置农历算法数组，支持计算法定节假日、民俗节日、国际节日的倒计时。
 * • 官方假期：法定分类优先拉取 NateScarlet/holiday-cn 上一年与当前年数据；每年 10 月后尝试预取下一年数据，按实际放假安排展示。
 * • 时区基准：采用 UTC+8 固定时区进行绝对时间计算。
 * • 自定义配置：支持通过环境变量设置最多 6 个专属纪念日，支持修改春/秋假的起始日期。
 * • 排序与显示：支持按倒数天数及分类优先级进行排序，支持指定节日跨分类置顶。
 * • 状态响应：根据工作日、周末、节假日当天状态切换背景渐变色；当天节日提示于中大号标题栏显示，小号于分类行内显示。
 * • 当天提醒：节日 / 专属日期当天弹窗提醒，每天只弹一次。
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
const BJ_OFFSET_MS = 8 * 3600000;
const HTTP_TIMEOUT_MS = 5000;
const WIDGET_OFFICIAL_HTTP_TIMEOUT_MS = 1500;

const OFFICIAL_REFRESH_INTERVAL_MS = 3 * DAY_MS;
const OFFICIAL_FAILED_RETRY_INTERVAL_MS = DAY_MS;
const OFFICIAL_OPTIONAL_FAILED_RETRY_INTERVAL_MS = 7 * DAY_MS;
const OFFICIAL_BACKGROUND_REFRESH_LOCK_TTL_MS = 10 * 60 * 1000;

const NOTIFY_PENDING_TTL_MS = 2 * 60 * 1000;
const NOTIFY_FAILED_RETRY_INTERVAL_MS = 10 * 60 * 1000;

const DISPLAY_MAX_WIDTH = 45;
const TEXT_TOKEN_RE = /[\d\/a-zA-Z.\-]+|./gu;
const LINE_TRIM_RE = /^[，\s]+|[，\s]+$/g;

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

function getBeijingDateContext(nowMs = Date.now()) {
  const bjDate = new Date(nowMs + BJ_OFFSET_MS);
  const year = bjDate.getUTCFullYear();
  const month = bjDate.getUTCMonth() + 1;
  const day = bjDate.getUTCDate();

  const todayMs = Date.UTC(year, month - 1, day);
  const todayIso = `${year}-${pad2(month)}-${pad2(day)}`;
  const todayStr = `${year}_${month}_${day}`;
  const nextRefreshMs =
    Date.UTC(year, month - 1, day + 1, 0, 1) - BJ_OFFSET_MS;

  return {
    year,
    month,
    day,
    weekday: bjDate.getUTCDay(),
    todayMs,
    todayIso,
    todayStr,
    nextRefreshIso: new Date(nextRefreshMs).toISOString()
  };
}

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

const NAME_LIST_SEPARATOR_RE = /[、，,\/]+/;

function splitNameList(value) {
  return String(value ?? "")
    .split(NAME_LIST_SEPARATOR_RE)
    .map(s => s.trim())
    .filter(Boolean);
}

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

  const parts = Object.freeze(splitNameList(raw));
  holidayNamePartsCache.set(raw, parts);
  holidayNamePartSetCache.set(raw, new Set(parts));

  return parts;
}

function getHolidayNamePartSet(name) {
  const raw = String(name ?? "").trim();
  if (!raw) return null;

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

const formatDisplayItem = item =>
  formatPeriodStr(displayName(item.name), item.diff, item.duration);

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
  const tokens = String(str ?? "").match(TEXT_TOKEN_RE) || [];

  for (const token of tokens) {
    const tw = token.length > 1
      ? token.length * 1.1
      : token.charCodeAt(0) > 255
        ? 2
        : 1.1;

    if (w + tw > maxW && line) {
      const cleaned = line.replace(LINE_TRIM_RE, "");
      if (cleaned) lines.push(cleaned);
      line = token;
      w = tw;
    } else {
      line += token;
      w += tw;
    }
  }

  if (line) {
    const cleaned = line.replace(LINE_TRIM_RE, "");
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

function buildDisplayCache(result, maxW = DISPLAY_MAX_WIDTH) {
  const limit = 3;
  const cache = { mode: "medium" };

  for (const cfg of CATEGORY_CONFIG) {
    const text = buildDisplayText(result, cfg.key, limit);

    cache[cfg.key] = {
      text,
      lines: splitTextToLines(text, maxW)
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
  const s = String(value ?? "").trim();
  const safeMaxLength = Math.max(0, Number(maxLength) || 0);

  let out = "";
  let count = 0;

  for (const ch of s) {
    if (count >= safeMaxLength) break;

    out += ch;
    count += 1;
  }

  return out;
}

function getEnvValueMaxLength(key) {
  if (/^EXCLUSIVE_NAME_\d+$/.test(key)) return MAX_EXCLUSIVE_NAME_LENGTH;
  if (/^EXCLUSIVE_DATE_\d+$/.test(key)) return MAX_EXCLUSIVE_DATE_LENGTH;
  if (key === "PINNED_HOLIDAY") return MAX_PINNED_HOLIDAY_TOTAL_LENGTH;
  return MAX_ENV_TEXT_LENGTH;
}

function sanitizeEnvStringValue(key, value) {
  if (value === undefined || value === null) return "";

  const raw = truncateByCodePoint(value, getEnvValueMaxLength(key));

  if (key === "PINNED_HOLIDAY") {
    return splitNameList(raw)
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

function getBoolFromNormalizedEnv(normalizedEnv, key, defaultVal = true) {
  const value = normalizedEnv?.[key];

  if (value === undefined || value === "") {
    return defaultVal;
  }

  if (value === "1") return true;
  if (value === "0") return false;

  return parseBoolValue(value, defaultVal);
}

function getStrFromNormalizedEnv(normalizedEnv, key, defaultVal = "") {
  const value = normalizedEnv?.[key];

  if (value === undefined || value === "") {
    return sanitizeEnvStringValue(key, defaultVal);
  }

  return value;
}

function normalizeCacheEnvValue(key, value) {
  if (CACHE_BOOL_ENV_KEYS.has(key)) {
    return parseBoolValue(value, true) ? "1" : "0";
  }

  const s = sanitizeEnvStringValue(key, value);

  if (key === "PINNED_HOLIDAY") {
    return splitNameList(s).join(",");
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

const ANNUAL_SLASH_DATE_RE = /^(\d{1,2})\/(\d{1,2})$/;
const ONCE_SLASH_DATE_RE = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;

function parseSlashYMDParts(raw) {
  const match = String(raw ?? "").trim().match(ONCE_SLASH_DATE_RE);

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

  return {
    y,
    m,
    d,
    ms: Date.UTC(y, m - 1, d)
  };
}

function hashString(str) {
  let h = 5381;

  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }

  return (h >>> 0).toString(36);
}

const DAILY_CACHE_SCHEMA_VERSION = 20;
const DAILY_CACHE_VERSION_TEXT = `v${DAILY_CACHE_SCHEMA_VERSION}`;

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

function sameSortedKeys(a = {}, b = {}) {
  const ak = Object.keys(a || {}).sort();
  const bk = Object.keys(b || {}).sort();

  if (ak.length !== bk.length) {
    return false;
  }

  for (let i = 0; i < ak.length; i++) {
    if (ak[i] !== bk[i]) {
      return false;
    }
  }

  return true;
}

function shouldSaveOfficialCache(oldCache, newCache) {
  if (!oldCache) return true;

  const oldYearsFingerprint = buildOfficialFingerprint(oldCache.years || {});
  const newYearsFingerprint = buildOfficialFingerprint(newCache.years || {});
  const oldStoredFingerprint =
    typeof oldCache.fingerprint === "string" ? oldCache.fingerprint : "";
  const newStoredFingerprint =
    typeof newCache.fingerprint === "string" ? newCache.fingerprint : "";

  return (
    oldCache.version !== newCache.version ||
    oldStoredFingerprint !== newStoredFingerprint ||
    oldYearsFingerprint !== newYearsFingerprint ||
    oldCache.checkedDate !== newCache.checkedDate ||
    !sameSortedKeys(oldCache.years || {}, newCache.years || {}) ||
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

function normalizeOfficialCacheOnRead(cache, sanitize = true) {
  if (
    !cache ||
    cache.version !== OFFICIAL_HOLIDAY_STORAGE_VERSION ||
    !cache.years ||
    typeof cache.years !== "object"
  ) {
    return null;
  }

  const years = sanitize
    ? sanitizeOfficialYears(cache.years)
    : cache.years;

  const fingerprint = sanitize
    ? buildOfficialFingerprint(years)
    : (
        typeof cache.fingerprint === "string" && cache.fingerprint
          ? cache.fingerprint
          : buildOfficialFingerprint(years)
      );

  return {
    ...cache,
    fingerprint,
    years
  };
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
    return normalizeOfficialCacheOnRead(
      ctx.storage?.getJSON(storageKey),
      sanitize
    );
  } catch (e) {
    warnLog("[Countdown] failed to read official holiday cache:", e);
  }

  return null;
}

function officialRequiredYears(currentYear) {
  return [currentYear - 1, currentYear];
}

function officialOptionalYears(currentYear) {
  return [currentYear + 1];
}

function officialRequestYears(currentYear) {
  return [
    ...officialRequiredYears(currentYear),
    ...officialOptionalYears(currentYear)
  ];
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

function getOfficialFingerprintText(cache) {
  const fp = typeof cache?.fingerprint === "string" && cache.fingerprint
    ? cache.fingerprint
    : "";

  if (fp) {
    return `official=${fp}`;
  }

  if (cache?.years && typeof cache.years === "object") {
    return `official=${buildOfficialFingerprint(cache.years)}`;
  }

  return "official=none";
}

function getOfficialEnvFingerprint(dataEnvFingerprint, officialCache) {
  return `${dataEnvFingerprint}|${getOfficialFingerprintText(officialCache)}`;
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
  retryAfterByYearOverride
) {
  const checkedDate = isValidISODate(oldCache?.checkedDate)
    ? oldCache.checkedDate
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

  const status = resp?.status;

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
    forceYearsToFetch = null
  } = options || {};

  const hasProvidedOldCache =
    Object.prototype.hasOwnProperty.call(options || {}, "oldCache");

  const oldCache = hasProvidedOldCache
    ? options.oldCache
    : readOfficialHolidayCache(ctx, storageKey);

  const requestTimeoutMs = normalizeHttpTimeoutMs(httpTimeoutMs);

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

  const missingRequiredYears = getMissingOfficialYears(
    mergedYears,
    requiredYears
  ).map(Number);

  const missingOptionalYears = getMissingOfficialYears(
    mergedYears,
    optionalYears
  ).map(Number);

  const buildFetchCandidates = () => {
    if (missingRequiredYears.length > 0) {
      return missingRequiredYears;
    }

    if (!requiredFresh) {
      return [currentYear];
    }

    return missingOptionalYears.slice(0, 1);
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
      const retryMs = optionalYears.includes(year)
        ? OFFICIAL_OPTIONAL_FAILED_RETRY_INTERVAL_MS
        : OFFICIAL_FAILED_RETRY_INTERVAL_MS;

      retryAfterByYear[key] = now + retryMs;

      warnLog(
        "[Countdown] failed to fetch official holiday:",
        key,
        result.reason
      );
    }
  }

  const fetchedCurrentYear = yearsToFetch.includes(currentYear);

  const previousCheckedDate = isValidISODate(oldCache?.checkedDate)
    ? oldCache.checkedDate
    : undefined;

  const shouldUpdateCheckedDate =
    isOfficialRequiredReady(mergedYears, currentYear) &&
    fetchedCurrentYear &&
    successfulFetchYearSet.has(String(currentYear));

  const checkedDate = shouldUpdateCheckedDate
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
      ctx.storage.delete(lockKey);
    }
  } catch (e) {
    warnLog("[Countdown] failed to release official refresh lock:", e);
  }
}

function readBaseCacheByOfficialState(
  officialHolidayCache,
  dataEnvFingerprint,
  readBaseDailyCache
) {
  const envFingerprint = getOfficialEnvFingerprint(
    dataEnvFingerprint,
    officialHolidayCache
  );

  return {
    envFingerprint,
    cachedBaseData: readBaseDailyCache(envFingerprint)
  };
}

function resolveOfficialRefreshPlan({
  officialHolidayCache,
  currentYear,
  todayIso,
  hasCachedBaseData = false
}) {
  const years = officialHolidayCache?.years;

  const requiredYearsToFetch = uniqueFiniteNumbers(
    getMissingOfficialYears(
      years,
      officialRequiredYears(currentYear)
    )
  );

  if (requiredYearsToFetch.length > 0) {
    return {
      yearsToFetch: requiredYearsToFetch,
      shouldBlockRenderForOfficialRefresh: true
    };
  }

  const cacheIsFresh = isOfficialCacheFresh(
    officialHolidayCache,
    todayIso,
    currentYear
  );

  if (!cacheIsFresh) {
    return {
      yearsToFetch: [currentYear],
      shouldBlockRenderForOfficialRefresh: !hasCachedBaseData
    };
  }

  const optionalYearsToFetch = uniqueFiniteNumbers(
    getMissingOfficialYears(
      years,
      officialOptionalYears(currentYear)
    )
  ).slice(0, 1);

  if (optionalYearsToFetch.length > 0) {
    return {
      yearsToFetch: optionalYearsToFetch,
      shouldBlockRenderForOfficialRefresh: false
    };
  }

  return {
    yearsToFetch: [],
    shouldBlockRenderForOfficialRefresh: false
  };
}

async function refreshOfficialCacheWithLock({
  ctx,
  officialHolidayStorageKey,
  currentYear,
  todayIso,
  officialHolidayCache,
  forceYearsToFetch
}) {
  const yearsToFetch = uniqueFiniteNumbers(forceYearsToFetch);

  if (yearsToFetch.length === 0) {
    return {
      officialHolidayCache
    };
  }

  const lockKey = getOfficialRefreshLockKey(officialHolidayStorageKey);
  const lockOwner = tryAcquireOfficialRefreshLock(ctx, lockKey);

  if (!lockOwner) {
    return {
      officialHolidayCache:
        readOfficialHolidayCache(ctx, officialHolidayStorageKey) ||
        officialHolidayCache
    };
  }

  try {
    const refreshedCache = await safeLoadOfficialHolidayDaily(
      ctx,
      currentYear,
      todayIso,
      officialHolidayStorageKey,
      {
        oldCache: officialHolidayCache,
        httpTimeoutMs: WIDGET_OFFICIAL_HTTP_TIMEOUT_MS,
        forceYearsToFetch: yearsToFetch
      }
    );

    return {
      officialHolidayCache: refreshedCache || officialHolidayCache
    };
  } finally {
    releaseOfficialRefreshLock(ctx, lockKey, lockOwner);
  }
}

async function prepareOfficialHolidayCacheForWidget({
  ctx,
  currentYear,
  todayIso,
  dataEnvFingerprint,
  officialHolidayStorageKey,
  readBaseDailyCache
}) {
  let officialHolidayCache = readOfficialHolidayCache(
    ctx,
    officialHolidayStorageKey
  );

  let {
    envFingerprint,
    cachedBaseData
  } = readBaseCacheByOfficialState(
    officialHolidayCache,
    dataEnvFingerprint,
    readBaseDailyCache
  );

  const canRefreshOfficialHoliday = Boolean(ctx.http && ctx.storage);

  const refreshAndReloadBaseCache = async yearsToFetch => {
    if (!canRefreshOfficialHoliday || yearsToFetch.length === 0) {
      return;
    }

    const refreshResult = await refreshOfficialCacheWithLock({
      ctx,
      officialHolidayStorageKey,
      currentYear,
      todayIso,
      officialHolidayCache,
      forceYearsToFetch: yearsToFetch
    });

    officialHolidayCache = refreshResult.officialHolidayCache;

    ({
      envFingerprint,
      cachedBaseData
    } = readBaseCacheByOfficialState(
      officialHolidayCache,
      dataEnvFingerprint,
      readBaseDailyCache
    ));
  };

  let plan = resolveOfficialRefreshPlan({
    officialHolidayCache,
    currentYear,
    todayIso,
    hasCachedBaseData: Boolean(cachedBaseData)
  });

  if (cachedBaseData) {
    if (
      canRefreshOfficialHoliday &&
      plan.shouldBlockRenderForOfficialRefresh
    ) {
      const fallbackEnvFingerprint = envFingerprint;
      const fallbackCachedBaseData = cachedBaseData;
      const oldOfficialFingerprint = getOfficialFingerprintText(
        officialHolidayCache
      );

      await refreshAndReloadBaseCache(plan.yearsToFetch);

      if (cachedBaseData) {
        return {
          officialHolidayCache,
          envFingerprint,
          cachedBaseData
        };
      }

      if (
        getOfficialFingerprintText(officialHolidayCache) ===
        oldOfficialFingerprint
      ) {
        return {
          officialHolidayCache,
          envFingerprint: fallbackEnvFingerprint,
          cachedBaseData: fallbackCachedBaseData
        };
      }
    } else {
      return {
        officialHolidayCache,
        envFingerprint,
        cachedBaseData
      };
    }
  }

  plan = resolveOfficialRefreshPlan({
    officialHolidayCache,
    currentYear,
    todayIso,
    hasCachedBaseData: false
  });

  if (
    canRefreshOfficialHoliday &&
    plan.yearsToFetch.length > 0
  ) {
    await refreshAndReloadBaseCache(plan.yearsToFetch);
  }

  return {
    officialHolidayCache,
    envFingerprint,
    cachedBaseData
  };
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

  const annualMatch = s.match(ANNUAL_SLASH_DATE_RE);

  if (annualMatch) {
    return {
      type: "annual",
      month: Number(annualMatch[1]),
      day: Number(annualMatch[2])
    };
  }

  const onceParts = parseSlashYMDParts(s);

  if (onceParts) {
    return {
      type: "once",
      year: onceParts.y,
      month: onceParts.m,
      day: onceParts.d
    };
  }

  return null;
}

function slashYMDToMs(dateStr) {
  const parts = parseSlashYMDParts(dateStr);
  return parts ? parts.ms : NaN;
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

  const officialRows = officialLegal
    .filter(row =>
      Array.isArray(row) &&
      typeof row[0] === "string" &&
      row[0].trim() &&
      typeof row[1] === "string"
    )
    .map(row => {
      const name = String(row[0] ?? "").trim();

      return {
        row,
        name,
        parts: splitHolidayNames(name)
      };
    });

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

      const official = officialRows[i];

      if (!partsIntersect(official.parts, fallbackPartSet)) {
        continue;
      }

      const distance = officialRowDistanceToFallback(
        official.row,
        fallbackMs
      );

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      const official = officialRows[bestIndex];

      usedOfficialIndexes.add(bestIndex);

      for (const name of official.parts) {
        coveredFallbackNames.add(name);
      }

      merged.push(official.row);
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

    const overlapsFallback = officialRows[i].parts.some(name =>
      fallbackNames.has(name)
    );

    if (!overlapsFallback) {
      merged.push(officialRows[i].row);
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

function isValidMonthDay(y, m, d) {
  if (!Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (m < 1 || m > 12) return false;

  const maxDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d >= 1 && d <= maxDay;
}

function parseExclusiveDateSpec(raw) {
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
}

function parseCountdownUserConfig(normalizedEnv) {
  const getStr = (key, defaultVal = "") =>
    getStrFromNormalizedEnv(normalizedEnv, key, defaultVal);

  const getBool = (key, defaultVal = true) =>
    getBoolFromNormalizedEnv(normalizedEnv, key, defaultVal);

  const pinnedHolidays = [
    ...new Set(splitNameList(getStr("PINNED_HOLIDAY")))
  ];

  const customDays = [1, 2, 3, 4, 5, 6]
    .map(i => {
      const name = getStr(`EXCLUSIVE_NAME_${i}`);
      const date = getStr(`EXCLUSIVE_DATE_${i}`);

      return {
        name,
        spec: parseExclusiveDateSpec(date)
      };
    })
    .filter(item => item.name && item.spec);

  return {
    enablePrioritySort: getBool("ENABLE_PRIORITY_SORT", true),
    enableExclusiveWeight: getBool("ENABLE_EXCLUSIVE_WEIGHT", true),
    pinnedHolidays,
    pinnedHolidaySet: new Set(pinnedHolidays),
    annualCustomDays: customDays.filter(item => item.spec.type === "annual"),
    onceCustomDays: customDays.filter(item => item.spec.type === "once")
  };
}

function createLunarToSolarConverter() {
  const lunarToSolarCache = new Map();

  return (y, m, d) => {
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
}

function buildYearFestivals({
  year: y,
  annualCustomDays,
  l2s,
  officialRanges
}) {
  const term = n => {
    if (!isValidLunarYear(y)) return null;

    const bjT = new Date(Lunar.term(y, n).getTime() + BJ_OFFSET_MS);

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

  const fallbackLegal = [
    ["元旦", YMD(y, 1, 1), 1],
    ["春节", l2s(y, 1, 1), 3],
    ["清明节", term(7), 1],
    ["劳动节", YMD(y, 5, 1), 1],
    ["端午节", l2s(y, 5, 5), 1],
    ["中秋节", l2s(y, 8, 15), 1],
    ["国庆节", YMD(y, 10, 1), 3]
  ];

  const officialLegal = getOfficialLegalHolidaysFromRanges(
    officialRanges,
    y
  );

  return {
    legal: mergeLegalHolidays(fallbackLegal, officialLegal),

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
}

function buildCountdownData({
  normalizedEnv,
  officialHolidayCache,
  year: Y,
  todayMs
}) {
  const officialRanges = buildOfficialHolidayRangeCache(officialHolidayCache);
  const userConfig = parseCountdownUserConfig(normalizedEnv);

  const {
    enablePrioritySort,
    enableExclusiveWeight,
    pinnedHolidays,
    pinnedHolidaySet,
    annualCustomDays,
    onceCustomDays
  } = userConfig;

  const l2s = createLunarToSolarConverter();

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

  const todayItems = [];

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

  const addTodayItem = (name, diff, priority, cat, duration = 1) => {
    const key = `${cat}:${name}`;

    if (todayItemKeySet.has(key)) return;

    todayItemKeySet.add(key);

    todayItems.push({
      name,
      diff,
      duration,
      priority: priority + 100,
      cat
    });
  };

  const addFestival = (cat, name, dateStr, duration = 1, sourceKind = "") => {
    if (!name || !dateStr) return;

    const dateParts = parseSlashYMDParts(dateStr);

    if (!dateParts) {
      return;
    }

    const diff = (dateParts.ms - todayMs) / DAY_MS;
    const priority = getPriority(name, cat, sourceKind);

    if (isInFestivalPeriod(diff, duration)) {
      if (!holidayNameMatchesTokenSet(name, todayFestTokenSet)) {
        addHolidayNameTokens(todayFestTokenSet, name);

        todayFests.push({
          name,
          diff,
          duration,
          priority,
          cat
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
    const f = buildYearFestivals({
      year: y,
      annualCustomDays,
      l2s,
      officialRanges
    });

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

  const result = {};

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

  const sortedTodayFests = todayFests
    .slice()
    .sort((a, b) => {
      const pa = a.priority ?? 0;
      const pb = b.priority ?? 0;

      if (pb !== pa) return pb - pa;
      if (b.diff !== a.diff) return b.diff - a.diff;

      return String(a.name).localeCompare(String(b.name));
    });

  const todayNoticeText = sortedTodayFests.length > 0
    ? formatTodayFestGroup(sortedTodayFests)
    : "";

  const pinnedData = pinnedHolidays
    .filter(n => pinnedMap.has(n))
    .map(n => ({
      name: n,
      diff: pinnedMap.get(n)
    }))
    .sort((a, b) => a.diff - b.diff);

  const displayCache = buildDisplayCache(result, LAYOUT_CONFIG.maxW);

  return {
    result,
    todayNoticeText,
    pinnedData,
    todayItems,
    displayCache
  };
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
      .filter(i => i && i.diff === 0)
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
      ctx.notify({
        title: "✨ 今日提醒",
        body: notifyNames.join("、"),
        sound: true
      });

      markSuccess();
    } catch (e) {
      markFailed(e);
    }
  } catch (e) {
    warnLog("[Countdown] notify process failed:", e);
  }
}

function getSupportedFamilyResult(ctx, withRefresh) {
  const family = String(ctx.widgetFamily || "systemMedium").toLowerCase();

  const isLockScreenFamily =
    family.includes("accessory") ||
    family.includes("lockscreen") ||
    family.includes("lock_screen") ||
    family.includes("lock-screen");

  if (isLockScreenFamily) {
    return withRefresh(mkUnsupportedWidget("不支持锁屏组件"));
  }

  if (family === "systemsmall" || family === "systemlarge") {
    return withRefresh(mkUnsupportedWidget("仅支持 Medium 组件", { maxLines: 2 }));
  }

  const isExtraLarge =
    family.includes("extralarge") ||
    family.includes("extra_large") ||
    family.includes("extra-large");

  if (isExtraLarge) {
    return withRefresh(mkUnsupportedWidget("暂不支持 Extra Large", { maxLines: 2 }));
  }

  if (family !== "systemmedium") {
    return withRefresh(mkUnsupportedWidget("仅支持 Medium 组件", { maxLines: 2 }));
  }

  return null;
}

async function renderCountdownWidget(ctx = {}) {
  const dateCtx = getBeijingDateContext();
  const withRefresh = widget => ({
    ...widget,
    refreshAfter: dateCtx.nextRefreshIso
  });

  const unsupportedWidget = getSupportedFamilyResult(ctx, withRefresh);
  if (unsupportedWidget) return unsupportedWidget;

  const env = ctx.env ?? {};
  const normalizedEnv = buildNormalizedEnv(env);

  const scriptName = String(ctx.script?.name || "countdown");
  const storageScope = `countdown:${hashString(scriptName)}`;
  const officialHolidayStorageKey =
    `${storageScope}:official_holidays:v${OFFICIAL_HOLIDAY_STORAGE_VERSION}`;

  const dataEnvStorageFingerprint =
    buildEnvFingerprintFromNormalized(normalizedEnv, DATA_ENV_KEYS);

  const dataEnvCacheScope = hashString(dataEnvStorageFingerprint);

  const enableWeekendTheme = getBoolFromNormalizedEnv(
    normalizedEnv,
    "ENABLE_WEEKEND_THEME",
    true
  );

  const {
    year: Y,
    weekday: currentDay,
    todayMs,
    todayIso,
    todayStr
  } = dateCtx;

  const BASE_CACHE_KEY =
    `${storageScope}:daily:${dataEnvCacheScope}:v${DAILY_CACHE_SCHEMA_VERSION}`;

  const NOTIFY_KEY =
    `${storageScope}:notify:${dataEnvCacheScope}`;

  const CACHE_VERSION = DAILY_CACHE_VERSION_TEXT;

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

  const writeBaseDailyCache = (envFingerprint, payload) => {
    if (!ctx.storage) return;

    try {
      ctx.storage.setJSON(BASE_CACHE_KEY, {
        version: CACHE_VERSION,
        date: todayStr,
        envFingerprint,
        payload
      });
    } catch (e) {
      warnLog("[Countdown] failed to save base daily cache:", e);
    }
  };

  const {
    officialHolidayCache,
    envFingerprint,
    cachedBaseData
  } = await prepareOfficialHolidayCacheForWidget({
    ctx,
    currentYear: Y,
    todayIso,
    dataEnvFingerprint: dataEnvStorageFingerprint,
    officialHolidayStorageKey,
    readBaseDailyCache
  });

  let baseData = cachedBaseData;

  if (!baseData) {
    baseData = buildCountdownData({
      normalizedEnv,
      officialHolidayCache,
      year: Y,
      todayMs
    });

    writeBaseDailyCache(envFingerprint, baseData);
  }

  let {
    result,
    todayNoticeText,
    pinnedData,
    todayItems,
    displayCache
  } = baseData;

  const layoutConfig = LAYOUT_CONFIG;

  if (!displayCache || !isValidDisplayCache(displayCache)) {
    displayCache = buildDisplayCache(result, layoutConfig.maxW);
  }

  const stickyParts = (pinnedData || []).map(p => `${p.name} ${p.diff}天`);
  const stickyText = stickyParts.join("·");

  notifyTodayIfNeeded(
    ctx,
    NOTIFY_KEY,
    todayIso,
    todayItems
  );

  const officialTodayInfo = enableWeekendTheme
    ? getOfficialDayInfo(officialHolidayCache, todayIso)
    : null;

  const isOfficialOffDay = officialTodayInfo?.isOffDay === true;
  const isOfficialAdjustedWorkday = officialTodayInfo?.isOffDay === false;

  const hasActiveTodayItem =
    Array.isArray(todayItems) &&
    todayItems.length > 0;

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

export default async function (ctx = {}) {
  try {
    return await renderCountdownWidget(ctx || {});
  } catch (e) {
    warnLog("[Countdown] widget render failed:", e);

    const dateCtx = getBeijingDateContext();

    return {
      type: "widget",
      padding: 12,
      refreshAfter: dateCtx.nextRefreshIso,
      backgroundGradient: getBackgroundGradient("workday"),
      children: [
        mkRow([
          mkIcon("exclamationmark.triangle.fill", C.red, 16),
          mkText("时光倒数加载失败", 14, "heavy", C.main)
        ], 6),
        mkSpacer(8),
        mkText(
          "请稍后刷新或检查脚本配置",
          12,
          "medium",
          C.sub,
          { maxLines: 2 }
        )
      ]
    };
  }
}