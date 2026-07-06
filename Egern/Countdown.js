/**
 * =======================================
 * 📌 时光倒数小组件
 *
 * ✨ 主要功能：
 * • 尺寸适配：仅支持中号小组件。
 * • 节日计算：内置农历算法数组，支持计算法定节假日、民俗节日、国际节日和专属纪念日倒计时。
 * • 官方假期：法定分类优先使用 NateScarlet/holiday-cn 官方放假数据；缺失时拉取缺失的上一年与当前年数据，过期时刷新当前年数据；失败年份会按重试窗口延后再次请求。
 * • 时区基准：采用 UTC+8 固定时区进行日期、倒计时和每日刷新时间计算。
 * • 自定义配置：支持通过 Egern 环境变量设置最多 6 个专属纪念日。
 * • 排序与显示：支持按倒数天数及分类优先级排序，支持指定节日跨分类置顶。
 * • 状态响应：可根据工作日、周末、法定放假日、调休工作日和当天节日状态切换背景渐变色。
 * • 当天提醒：节日 / 专属日期当天弹窗提醒，每天只弹一次。
 *
 * ⚙️ 环境变量说明：
 *
 * 可用环境变量：
 *
 * 1. ENABLE_PRIORITY_SORT
 *    是否启用节日优先级排序。
 *    默认：true
 *
 * 2. ENABLE_EXCLUSIVE_WEIGHT
 *    专属纪念日是否提高显示权重。
 *    默认：true
 *
 * 3. ENABLE_WEEKEND_THEME
 *    是否启用周末 / 法定放假日 / 调休工作日背景主题判断。
 *    默认：true
 *
 * 4. PINNED_HOLIDAY
 *    指定需要置顶显示的节日名称。
 *    多个名称可用以下任意符号分隔：
 *    、 ， , /
 *
 *    示例：
 *    PINNED_HOLIDAY=春节,国庆节,中秋节
 *
 *    限制：
 *    • 最多 12 项
 *    • 总长度最多 120 字符
 *    • 单项最多 20 字符
 *
 * 5. EXCLUSIVE_NAME_1 ~ EXCLUSIVE_NAME_6
 *    专属纪念日名称。
 *
 *    示例：
 *    EXCLUSIVE_NAME_1=生日
 *    EXCLUSIVE_NAME_2=纪念日
 *
 *    限制：
 *    • 单项最多 20 字符
 *
 * 6. EXCLUSIVE_DATE_1 ~ EXCLUSIVE_DATE_6
 *    专属纪念日日期，需要与对应的 EXCLUSIVE_NAME_N 配对使用。
 *
 *    支持两种格式：
 *
 *    • M/D：每年重复
 *      示例：
 *      EXCLUSIVE_DATE_1=5/20
 *      EXCLUSIVE_DATE_2=12/31
 *
 *    • YYYY/M/D：仅指定年份显示一次
 *      示例：
 *      EXCLUSIVE_DATE_3=2026/5/20
 *      EXCLUSIVE_DATE_4=2027/10/1
 *
 *    限制：
 *    • 单项最多 20 字符
 *
 * ✅ 配置示例：
 *
 * env:
 *   ENABLE_PRIORITY_SORT: "true"
 *   ENABLE_EXCLUSIVE_WEIGHT: "true"
 *   ENABLE_WEEKEND_THEME: "true"
 *   PINNED_HOLIDAY: "春节,国庆节,中秋节"
 *   EXCLUSIVE_NAME_1: "生日"
 *   EXCLUSIVE_DATE_1: "5/20"
 *   EXCLUSIVE_NAME_2: "纪念日"
 *   EXCLUSIVE_DATE_2: "2026/10/1"
 *
 * 🔗 作者: https://github.com/jnlaoshu/MySelf/tree/1c35eedff4e052e7dc4e9d87105e32f2490617cf/Egern/Widget
 * ⏱️ 更新时间: 2026.04.01 01:40
 * 🔧 优化时间: 2026.07.06 (性能优化 + 代码治理)
 * =======================================
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

const CATEGORY_KEYS = CATEGORY_CONFIG.map(cfg => cfg.key);

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

const NOTIFY_FAILED_RETRY_INTERVAL_MS = 10 * 60 * 1000;

const DISPLAY_MAX_WIDTH = 45;
const TOP_PINNED_DISPLAY_LIMIT = 2;

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const EXCLUSIVE_NAME_KEY_RE = /^EXCLUSIVE_NAME_\d+$/;
const EXCLUSIVE_DATE_KEY_RE = /^EXCLUSIVE_DATE_\d+$/;
const TEXT_TOKEN_RE = /[\d\/a-zA-Z.\-]+|./gu;
const LINE_TRIM_RE = /^[，\s]+|[，\s]+$/g;
const NAME_LIST_SEPARATOR_RE = /[、，,\/]+/;
const ANNUAL_SLASH_DATE_RE = /^(\d{1,2})\/(\d{1,2})$/;
const ONCE_SLASH_DATE_RE = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;

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

function splitNameList(value) {
  return String(value ?? "")
    .split(NAME_LIST_SEPARATOR_RE)
    .map(s => s.trim())
    .filter(Boolean);
}

const EMPTY_HOLIDAY_NAME_PARTS = Object.freeze([]);

function splitHolidayNames(name) {
  const raw = String(name ?? "").trim();
  return raw ? splitNameList(raw) : EMPTY_HOLIDAY_NAME_PARTS;
}

function getHolidayNamePartSet(name) {
  const parts = splitHolidayNames(name);
  return parts.length > 0 ? new Set(parts) : null;
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

function dedupeHolidayItemsByToken(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const usedTokenSet = new Set();
  const output = [];

  for (const item of items) {
    if (!item || holidayNameMatchesTokenSet(item.name, usedTokenSet)) {
      continue;
    }

    addHolidayNameTokens(usedTokenSet, item.name);
    output.push(item);
  }

  return output;
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
  if (EXCLUSIVE_NAME_KEY_RE.test(key)) return MAX_EXCLUSIVE_NAME_LENGTH;
  if (EXCLUSIVE_DATE_KEY_RE.test(key)) return MAX_EXCLUSIVE_DATE_LENGTH;
  if (key === "PINNED_HOLIDAY") return MAX_PINNED_HOLIDAY_TOTAL_LENGTH;

  return MAX_ENV_TEXT_LENGTH;
}

function readEnvValue(ctx, key, maxLength = null) {
  const raw = ctx?.env?.[key];
  if (raw === undefined || raw === null) return null;

  const s = String(raw).trim();
  if (!s) return null;

  const effectiveMaxLength = maxLength ?? getEnvValueMaxLength(key);
  return truncateByCodePoint(s, effectiveMaxLength);
}

function parseBoolEnv(ctx, key, defaultValue = false) {
  const value = readEnvValue(ctx, key);
  if (value === null) return defaultValue;

  const lower = value.toLowerCase();
  return lower === "true" || lower === "1";
}

function isValidPinnedItem(name) {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    name.length <= MAX_PINNED_HOLIDAY_ITEM_LENGTH
  );
}

function parsePinnedHolidayEnv(ctx) {
  const raw = readEnvValue(ctx, "PINNED_HOLIDAY", MAX_PINNED_HOLIDAY_TOTAL_LENGTH);
  if (!raw) return [];

  const items = splitNameList(raw)
    .slice(0, MAX_PINNED_HOLIDAY_COUNT)
    .filter(isValidPinnedItem);

  return items;
}

function parseExclusiveDaysEnv(ctx) {
  const result = [];

  for (let i = 1; i <= 6; i++) {
    const nameKey = `EXCLUSIVE_NAME_${i}`;
    const dateKey = `EXCLUSIVE_DATE_${i}`;

    const name = readEnvValue(ctx, nameKey, MAX_EXCLUSIVE_NAME_LENGTH);
    const dateStr = readEnvValue(ctx, dateKey, MAX_EXCLUSIVE_DATE_LENGTH);

    if (!name || !dateStr) continue;

    result.push({ name, dateStr });
  }

  return result;
}

function hashString(str) {
  let hash = 5381;
  const s = String(str ?? "");

  for (let i = 0; i < s.length; i++) {
    hash = (hash * 33) ^ s.charCodeAt(i);
  }

  return (hash >>> 0).toString(36);
}

function warnLog(ctx, message, error = null) {
  const prefix = "⚠️ [倒数小组件]";

  if (error) {
    console.warn(`${prefix} ${message}`, error);
  } else {
    console.warn(`${prefix} ${message}`);
  }
}

async function parseHttpJson(response) {
  if (!response || typeof response.json !== "function") {
    throw new Error("Invalid response object");
  }

  try {
    return await response.json();
  } catch (err) {
    throw new Error(`JSON parse failed: ${err.message}`);
  }
}

function isValidISODate(dateStr) {
  if (typeof dateStr !== "string") return false;
  const m = dateStr.match(ISO_DATE_RE);
  if (!m) return false;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);

  if (y < 1900 || y > 2100) return false;
  if (mo < 1 || mo > 12) return false;
  if (d < 1 || d > 31) return false;

  return true;
}

function parseISODateParts(dateStr) {
  if (!isValidISODate(dateStr)) return null;

  const m = dateStr.match(ISO_DATE_RE);
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3])
  };
}

function isValidMonthDay(m, d) {
  return (
    Number.isInteger(m) &&
    Number.isInteger(d) &&
    m >= 1 &&
    m <= 12 &&
    d >= 1 &&
    d <= 31
  );
}

function isValidOfficialRange(range) {
  return (
    range &&
    typeof range === "object" &&
    isValidISODate(range.start) &&
    isValidISODate(range.end) &&
    typeof range.name === "string" &&
    range.name.length > 0 &&
    typeof range.isOffDay === "boolean"
  );
}

const DATA_ENV_KEYS = [
  "ENABLE_PRIORITY_SORT",
  "ENABLE_EXCLUSIVE_WEIGHT",
  "ENABLE_WEEKEND_THEME",
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

function buildNormalizedEnv(ctx) {
  const env = {};

  for (const key of DATA_ENV_KEYS) {
    const value = readEnvValue(ctx, key);
    if (value !== null) {
      env[key] = value;
    }
  }

  return env;
}

function parseSlashYMDParts(dateStr) {
  if (typeof dateStr !== "string") return null;

  const m1 = dateStr.match(ANNUAL_SLASH_DATE_RE);
  if (m1) {
    const mo = Number(m1[1]);
    const d = Number(m1[2]);
    if (!isValidMonthDay(mo, d)) return null;

    return { month: mo, day: d };
  }

  const m2 = dateStr.match(ONCE_SLASH_DATE_RE);
  if (m2) {
    const y = Number(m2[1]);
    const mo = Number(m2[2]);
    const d = Number(m2[3]);

    if (y < 1900 || y > 2100 || !isValidMonthDay(mo, d)) return null;

    return { year: y, month: mo, day: d };
  }

  return null;
}

function normalizeOfficialDay(day) {
  if (!day || typeof day !== "object") return null;

  const date = String(day.date ?? "").trim();
  if (!isValidISODate(date)) return null;

  const name = String(day.name ?? "").trim();
  if (!name) return null;

  return {
    date,
    name,
    isOffDay: Boolean(day.isOffDay)
  };
}

function buildOfficialHolidayRanges(days) {
  if (!Array.isArray(days) || days.length === 0) return [];

  const normalized = days.map(normalizeOfficialDay).filter(Boolean);
  if (normalized.length === 0) return [];

  const sorted = normalized.slice().sort((a, b) => a.date.localeCompare(b.date));

  const ranges = [];
  let currentRange = null;

  for (const dayItem of sorted) {
    if (
      currentRange &&
      currentRange.name === dayItem.name &&
      currentRange.isOffDay === dayItem.isOffDay
    ) {
      currentRange.end = dayItem.date;
    } else {
      if (currentRange) {
        ranges.push(currentRange);
      }

      currentRange = {
        name: dayItem.name,
        start: dayItem.date,
        end: dayItem.date,
        isOffDay: dayItem.isOffDay
      };
    }
  }

  if (currentRange) {
    ranges.push(currentRange);
  }

  return ranges;
}

function normalizeHolidayCnYearData(yearData) {
  if (!yearData || typeof yearData !== "object") return null;

  const year = Number(yearData.year);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return null;

  const days = Array.isArray(yearData.days) ? yearData.days : [];

  return {
    year,
    days: days.map(normalizeOfficialDay).filter(Boolean)
  };
}

function normalizeCachedOfficialYearData(cached) {
  const yearData = normalizeHolidayCnYearData(cached);
  if (!yearData) return null;

  return {
    ...yearData,
    days: yearData.days.sort((a, b) => a.date.localeCompare(b.date))
  };
}

function sanitizeOfficialYears(years) {
  if (!years || typeof years !== "object") return {};

  const output = {};

  for (const [yearKey, yearData] of Object.entries(years)) {
    const y = Number(yearKey);
    if (!Number.isInteger(y) || y < 1900 || y > 2100) continue;

    const normalized = normalizeCachedOfficialYearData(yearData);
    if (normalized && normalized.year === y) {
      output[y] = normalized;
    }
  }

  return output;
}

function buildOfficialFingerprint(years) {
  if (!years || typeof years !== "object") return "";

  const sorted = Object.keys(years)
    .map(Number)
    .filter(y => Number.isInteger(y))
    .sort((a, b) => a - b);

  if (sorted.length === 0) return "";

  const parts = [];

  for (const y of sorted) {
    const yearData = years[y];
    if (!yearData || !Array.isArray(yearData.days)) continue;

    const dayCount = yearData.days.length;
    parts.push(`${y}:${dayCount}`);
  }

  return hashString(parts.join("|"));
}

function normalizeOfficialCacheOnRead(cache, sanitize = true) {
  if (!cache || typeof cache !== "object") {
    return { fingerprint: "", years: {} };
  }

  const years = sanitize
    ? sanitizeOfficialYears(cache.years)
    : (cache.years || {});

  const fingerprint = typeof cache.fingerprint === "string" && cache.fingerprint
    ? cache.fingerprint
    : buildOfficialFingerprint(years);

  return { fingerprint, years };
}

async function readOfficialHolidayCache(ctx, scriptName, options = {}) {
  const { sanitize = true } = options || {};

  const storageKey = `countdown:${hashString(scriptName)}:official_holidays:v2`;

  try {
    const cached = await ctx.storage.getJSON(storageKey);
    return normalizeOfficialCacheOnRead(cached, sanitize);
  } catch (err) {
    warnLog(ctx, `读取官方假期缓存失败: ${err.message}`, err);
    return { fingerprint: "", years: {} };
  }
}

function getOfficialFingerprintText(years) {
  if (!years || typeof years !== "object") return "";

  const sorted = Object.keys(years)
    .map(Number)
    .filter(y => Number.isInteger(y))
    .sort((a, b) => a - b);

  if (sorted.length === 0) return "";

  return sorted.map(y => {
    const yearData = years[y];
    const count = Array.isArray(yearData?.days) ? yearData.days.length : 0;
    return `${y}年(${count}天)`;
  }).join(", ");
}

function getOfficialEnvFingerprint(env) {
  const official = env?.ENABLE_WEEKEND_THEME ?? "";
  return hashString(`official_${official}`);
}

async function fetchOfficialHolidayYear(ctx, year, options = {}) {
  const timeoutMs = options.timeoutMs ?? HTTP_TIMEOUT_MS;
  const url = `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`;

  try {
    const resp = await ctx.http.get(url, { timeout: timeoutMs });

    if (!resp || resp.status !== 200) {
      throw new Error(`HTTP ${resp?.status ?? "unknown"}`);
    }

    const json = await parseHttpJson(resp);
    return normalizeHolidayCnYearData(json);
  } catch (err) {
    warnLog(ctx, `拉取 ${year} 年官方假期失败: ${err.message}`, err);
    return null;
  }
}

function buildRetryAfterByYear(retryAfterByYear, years, nowMs, intervalMs) {
  const output = { ...retryAfterByYear };

  for (const y of years) {
    output[y] = nowMs + intervalMs;
  }

  return output;
}

async function writeOfficialHolidayCache(ctx, scriptName, cache) {
  const storageKey = `countdown:${hashString(scriptName)}:official_holidays:v2`;

  try {
    await ctx.storage.setJSON(storageKey, cache);
  } catch (err) {
    warnLog(ctx, `写入官方假期缓存失败: ${err.message}`, err);
  }
}

function normalizeOfficialCachePayload(oldCache, updates, updatedAtMs) {
  const years = { ...(oldCache?.years || {}) };

  for (const yearData of updates) {
    if (yearData && yearData.year) {
      years[yearData.year] = yearData;
    }
  }

  const fingerprint = buildOfficialFingerprint(years);

  return {
    fingerprint,
    years,
    updatedAt: updatedAtMs,
    retryAfterByYear: oldCache?.retryAfterByYear || {}
  };
}

async function prepareOfficialHolidayCacheForWidget(
  ctx,
  scriptName,
  bjCtx,
  env,
  options = {}
) {
  const timeoutMs = options.timeoutMs ?? WIDGET_OFFICIAL_HTTP_TIMEOUT_MS;

  const cachedData = await readOfficialHolidayCache(ctx, scriptName, {
    sanitize: true
  });

  const { years: cachedYears, fingerprint: cachedFingerprint } = cachedData;

  const nowMs = bjCtx.todayMs;
  const currentYear = bjCtx.year;

  const yearsToEnsure = [currentYear - 1, currentYear, currentYear + 1];
  const missingYears = yearsToEnsure.filter(y => !cachedYears[y]);

  let yearsToFetch = [...missingYears];

  const updatedAt = Number(cachedData.updatedAt) || 0;
  const retryAfterByYear = cachedData.retryAfterByYear || {};

  if (nowMs - updatedAt > OFFICIAL_REFRESH_INTERVAL_MS) {
    if (!yearsToFetch.includes(currentYear)) {
      yearsToFetch.push(currentYear);
    }
  }

  yearsToFetch = yearsToFetch.filter(y => {
    const retryAfter = retryAfterByYear[y];
    return !retryAfter || nowMs >= retryAfter;
  });

  if (yearsToFetch.length === 0) {
    return cachedData;
  }

  const results = await Promise.allSettled(
    yearsToFetch.map(y => fetchOfficialHolidayYear(ctx, y, { timeoutMs }))
  );

  const successYears = [];
  const failedYears = [];

  for (let i = 0; i < yearsToFetch.length; i++) {
    const result = results[i];
    const year = yearsToFetch[i];

    if (result.status === "fulfilled" && result.value) {
      successYears.push(result.value);
    } else {
      failedYears.push(year);
    }
  }

  const newCache = normalizeOfficialCachePayload(
    cachedData,
    successYears,
    nowMs
  );

  newCache.retryAfterByYear = buildRetryAfterByYear(
    newCache.retryAfterByYear,
    failedYears,
    nowMs,
    OFFICIAL_FAILED_RETRY_INTERVAL_MS
  );

  await writeOfficialHolidayCache(ctx, scriptName, newCache);

  return newCache;
}

function toHolidayRowMeta(row) {
  if (!row || !row.name) return null;

  const nameParts = splitHolidayNames(row.name);
  const nameSet = new Set(nameParts);

  return {
    row,
    nameParts,
    nameSet
  };
}

function mergeLegalHolidays(officialLegal, fallbackLegal) {
  if (!Array.isArray(officialLegal) || officialLegal.length === 0) {
    return Array.isArray(fallbackLegal) ? fallbackLegal : [];
  }

  if (!Array.isArray(fallbackLegal) || fallbackLegal.length === 0) {
    return officialLegal;
  }

  const officialMeta = officialLegal.map(toHolidayRowMeta).filter(Boolean);
  const fallbackMeta = fallbackLegal.map(toHolidayRowMeta).filter(Boolean);

  // 【问题 6 优化】使用 Map 加速查找，避免 O(n*m)
  const officialByName = new Map();
  for (const meta of officialMeta) {
    for (const part of meta.nameParts) {
      if (!officialByName.has(part)) {
        officialByName.set(part, []);
      }
      officialByName.get(part).push(meta);
    }
  }

  const mergedRows = [];
  const usedOfficialIndexes = new Set();

  for (const fbMeta of fallbackMeta) {
    let matched = false;

    for (const part of fbMeta.nameParts) {
      const candidates = officialByName.get(part);
      if (!candidates) continue;

      for (let i = 0; i < candidates.length; i++) {
        const offMeta = candidates[i];
        const offIndex = officialMeta.indexOf(offMeta);

        if (usedOfficialIndexes.has(offIndex)) continue;

        usedOfficialIndexes.add(offIndex);
        mergedRows.push(offMeta.row);
        matched = true;
        break;
      }

      if (matched) break;
    }

    if (!matched) {
      mergedRows.push(fbMeta.row);
    }
  }

  for (let i = 0; i < officialMeta.length; i++) {
    if (!usedOfficialIndexes.has(i)) {
      mergedRows.push(officialMeta[i].row);
    }
  }

  return mergedRows;
}

function createLunarToSolarConverter() {
  const cache = new Map();

  return function l2s(y, m, d) {
    if (!isValidLunarYear(y) || m < 1 || m > 12 || d < 1 || d > 30) {
      return null;
    }

    const key = `${y}-${m}-${d}`;
    if (cache.has(key)) {
      return cache.get(key);
    }

    ensureLunarCumulative(y);

    const offset = lunarCumulativeCache.off[y - MIN_LUNAR_YEAR];
    if (offset === undefined) {
      cache.set(key, null);
      return null;
    }

    let totalDays = offset;

    for (let i = 1; i < m; i++) {
      totalDays += Lunar.mDays(y, i);
    }

    totalDays += d - 1;

    const solarMs = Date.UTC(1900, 0, 31) + totalDays * DAY_MS;
    const result = msToYMD(solarMs);

    cache.set(key, result);
    return result;
  };
}

function buildYearFestivals({ year, annualCustomDays, l2s, officialRanges }) {
  const y = year;

  const solarFestivals = [
    ["元旦", `${y}/01/01`, 1],
    ["情人节", `${y}/02/14`, 1],
    ["妇女节", `${y}/03/08`, 1],
    ["植树节", `${y}/03/12`, 1],
    ["劳动节", `${y}/05/01`, 1],
    ["青年节", `${y}/05/04`, 1],
    ["儿童节", `${y}/06/01`, 1],
    ["建党节", `${y}/07/01`, 1],
    ["建军节", `${y}/08/01`, 1],
    ["教师节", `${y}/09/10`, 1],
    ["国庆节", `${y}/10/01`, 1],
    ["万圣节", `${y}/10/31`, 1],
    ["双十一", `${y}/11/11`, 1],
    ["平安夜", `${y}/12/24`, 1],
    ["圣诞节", `${y}/12/25`, 1]
  ];

  const folkFestivals = [
    ["春节", l2s(y, 1, 1), 1],
    ["元宵节", l2s(y, 1, 15), 1],
    ["龙抬头", l2s(y, 2, 2), 1],
    ["端午节", l2s(y, 5, 5), 1],
    ["七夕节", l2s(y, 7, 7), 1],
    ["中元节", l2s(y, 7, 15), 1],
    ["中秋节", l2s(y, 8, 15), 1],
    ["重阳节", l2s(y, 9, 9), 1],
    ["寒衣节", l2s(y, 10, 1), 1],
    ["下元节", l2s(y, 10, 15), 1],
    ["腊八节", l2s(y, 12, 8), 1],
    ["小年", l2s(y, 12, 23), 1],
    ["除夕", l2s(y, 12, Lunar.mDays(y, 12)), 1]
  ];

  const solarTerms = [
    ["清明节", Lunar.term(y, 5), 1]
  ];

  const officialDates = (officialRanges || [])
    .filter(r => isValidOfficialRange(r) && r.isOffDay)
    .map(r => {
      const startParts = parseISODateParts(r.start);
      const endParts = parseISODateParts(r.end);

      if (!startParts || !endParts) return null;

      const startMs = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
      const endMs = Date.UTC(endParts.year, endParts.month - 1, endParts.day);
      const duration = Math.max(1, Math.round((endMs - startMs) / DAY_MS) + 1);

      return [r.name, msToYMD(startMs), duration];
    })
    .filter(Boolean);

  const customDates = (annualCustomDays || []).map(item => [
    item.name,
    `${y}/${pad2(item.month)}/${pad2(item.day)}`,
    1
  ]);

  return {
    legal: officialDates,
    folk: folkFestivals,
    intl: solarFestivals.concat(solarTerms),
    exclusive: customDates
  };
}

// 【问题 5 轻度优化】提取嵌套函数，但不改变整体结构
function createCountdownDataBuilder(bjCtx, env) {
  const { year, todayMs } = bjCtx;

  const enablePrioritySort = parseBoolEnv(null, "ENABLE_PRIORITY_SORT", true);
  const enableExclusiveWeight = parseBoolEnv(null, "ENABLE_EXCLUSIVE_WEIGHT", true);

  const pinnedHolidayNames = parsePinnedHolidayEnv({ env });
  const pinnedHolidayNameSet = new Set(pinnedHolidayNames);

  function getPriority(item, cat) {
    const specialP = getSpecialHolidayPriority(item.name);
    if (specialP !== undefined) return specialP;

    const baseP = basePriority[cat] ?? 0;
    return cat === "exclusive" && enableExclusiveWeight ? baseP + 1 : baseP;
  }

  function isInFestivalPeriod(diff, duration) {
    return diff <= 0 && Math.abs(diff) < duration;
  }

  const todayItemMap = new Map();
  const pinnedMap = new Map();
  const pinnedTokenSet = new Set();

  function updatePinned(item, cat) {
    if (pinnedHolidayNameSet.size === 0) return;

    const matched = getMatchedHolidayNames(item.name, pinnedHolidayNameSet);

    for (const targetName of matched) {
      if (!pinnedMap.has(targetName)) {
        pinnedMap.set(targetName, { ...item, cat });
      }
    }

    if (matched.length > 0) {
      addHolidayNameTokens(pinnedTokenSet, item.name);
    }
  }

  function addTodayItem(item, cat) {
    if (item.diff === 0 && !todayItemMap.has(item.name)) {
      todayItemMap.set(item.name, { ...item, cat });
    }
  }

  function addFestival(name, dateStr, duration, cat, festivals) {
    if (!name || !dateStr) return;

    const dateParts = parseSlashYMDParts(dateStr);
    if (!dateParts) return;

    const { year: y, month: m, day: d } = dateParts;

    if (y !== undefined && y !== year && y !== year + 1) {
      return;
    }

    const targetMs = Date.UTC(
      y ?? year,
      m - 1,
      d
    );

    const diff = Math.floor((targetMs - todayMs) / DAY_MS);

    const item = { name, diff, duration };

    if (diff > 0) {
      updatePinned(item, cat);
    }

    addTodayItem(item, cat);

    festivals.push(item);
  }

  return {
    getPriority,
    isInFestivalPeriod,
    updatePinned,
    addTodayItem,
    addFestival,
    todayItemMap,
    pinnedMap,
    pinnedTokenSet,
    enablePrioritySort
  };
}

function buildCountdownData(bjCtx, env, officialRanges) {
  const { year } = bjCtx;

  const yearsToScan = [year - 1, year, year + 1];

  const annualCustomDays = parseExclusiveDaysEnv({ env })
    .map(item => parseSlashYMDParts(item.dateStr))
    .filter(parts => parts && !parts.year);

  const onceCustomDays = parseExclusiveDaysEnv({ env })
    .map(item => {
      const parts = parseSlashYMDParts(item.dateStr);
      return parts && parts.year ? { ...item, ...parts } : null;
    })
    .filter(Boolean);

  // 【问题 1 修复】在循环外创建 l2s，复用缓存
  const l2s = createLunarToSolarConverter();

  const allYearData = [];

  for (const y of yearsToScan) {
    const f = buildYearFestivals({
      year: y,
      annualCustomDays,
      l2s,
      officialRanges
    });

    allYearData.push({ year: y, festivals: f });
  }

  const builder = createCountdownDataBuilder(bjCtx, env);

  const result = {
    legal: [],
    folk: [],
    intl: [],
    exclusive: []
  };

  for (const { festivals } of allYearData) {
    for (const cat of CATEGORY_KEYS) {
      const catFestivals = festivals[cat] || [];

      for (const [name, dateStr, duration] of catFestivals) {
        builder.addFestival(name, dateStr, duration, cat, result[cat]);
      }
    }
  }

  for (const item of onceCustomDays) {
    const dateStr = `${item.year}/${item.month}/${item.day}`;
    builder.addFestival(item.name, dateStr, 1, "exclusive", result.exclusive);
  }

  const todayFestTokenSet = new Set();
  const todayFestivals = [];

  for (const item of builder.todayItemMap.values()) {
    if (holidayNameMatchesTokenSet(item.name, todayFestTokenSet)) {
      continue;
    }

    addHolidayNameTokens(todayFestTokenSet, item.name);
    todayFestivals.push(item);
  }

  for (const cat of CATEGORY_KEYS) {
    result[cat] = dedupeHolidayItemsByToken(result[cat]);

    if (builder.enablePrioritySort) {
      result[cat].sort((a, b) => {
        const pA = builder.getPriority(a, cat);
        const pB = builder.getPriority(b, cat);

        if (pA !== pB) return pB - pA;

        const inPeriodA = builder.isInFestivalPeriod(a.diff, a.duration);
        const inPeriodB = builder.isInFestivalPeriod(b.diff, b.duration);

        if (inPeriodA && !inPeriodB) return -1;
        if (!inPeriodA && inPeriodB) return 1;

        return a.diff - b.diff;
      });
    } else {
      result[cat].sort((a, b) => a.diff - b.diff);
    }
  }

  const pinnedTopItems = [];

  for (const targetName of builder.pinnedMap.keys()) {
    const item = builder.pinnedMap.get(targetName);
    if (item && item.diff > 0) {
      pinnedTopItems.push(item);
    }
  }

  pinnedTopItems.sort((a, b) => a.diff - b.diff);

  return {
    result,
    todayFestivals,
    pinnedTopItems: pinnedTopItems.slice(0, TOP_PINNED_DISPLAY_LIMIT),
    pinnedTokenSet: builder.pinnedTokenSet
  };
}

function buildPinnedStickyText(pinnedTopItems) {
  if (!Array.isArray(pinnedTopItems) || pinnedTopItems.length === 0) {
    return "";
  }

  return pinnedTopItems
    .map(item => formatDisplayItem(item))
    .join("，");
}

function pickRandomNotice() {
  const idx = Math.floor(Math.random() * RANDOM_NOTICES.length);
  return RANDOM_NOTICES[idx];
}

function decideBgTheme(bjCtx, env, countdownData) {
  const enableWeekendTheme = parseBoolEnv({ env }, "ENABLE_WEEKEND_THEME", true);

  if (!enableWeekendTheme) {
    return "workday";
  }

  const { todayFestivals } = countdownData;
  if (todayFestivals && todayFestivals.length > 0) {
    return "fest";
  }

  const todayIso = bjCtx.todayIso;
  const officialRanges = countdownData.officialRanges || [];

  for (const range of officialRanges) {
    if (!isValidOfficialRange(range)) continue;

    if (todayIso >= range.start && todayIso <= range.end) {
      return range.isOffDay ? "weekend" : "workday";
    }
  }

  const weekday = bjCtx.weekday;
  return weekday === 0 || weekday === 6 ? "weekend" : "workday";
}

// 【问题 4 优化】提取缓存管理逻辑
function createCacheManager(ctx, scriptName, dataEnvCacheScope) {
  const baseKey = `countdown:${hashString(scriptName)}`;
  const dailyCacheKey = `${baseKey}:daily:${dataEnvCacheScope}:v2`;
  const notifyKey = `${baseKey}:notify`;

  let baseDailyCacheRecordLoaded = false;
  let baseDailyCacheRecord = null;

  async function readBaseDailyCacheRecord() {
    if (baseDailyCacheRecordLoaded) {
      return baseDailyCacheRecord;
    }

    try {
      const cached = await ctx.storage.getJSON(dailyCacheKey);
      baseDailyCacheRecord = cached && typeof cached === "object" ? cached : null;
    } catch (err) {
      warnLog(ctx, `读取每日缓存失败: ${err.message}`, err);
      baseDailyCacheRecord = null;
    }

    baseDailyCacheRecordLoaded = true;
    return baseDailyCacheRecord;
  }

  async function readBaseDailyCache(envFingerprint, bjCtx) {
    const record = await readBaseDailyCacheRecord();

    if (
      record &&
      record.envFingerprint === envFingerprint &&
      record.todayStr === bjCtx.todayStr
    ) {
      return record.displayCache || null;
    }

    return null;
  }

  async function writeBaseDailyCache(envFingerprint, bjCtx, displayCache) {
    const payload = {
      envFingerprint,
      todayStr: bjCtx.todayStr,
      displayCache
    };

    try {
      await ctx.storage.setJSON(dailyCacheKey, payload);
    } catch (err) {
      warnLog(ctx, `写入每日缓存失败: ${err.message}`, err);
    }
  }

  async function readNotifyRecord() {
    try {
      const cached = await ctx.storage.getJSON(notifyKey);
      return cached && typeof cached === "object" ? cached : null;
    } catch (err) {
      warnLog(ctx, `读取通知记录失败: ${err.message}`, err);
      return null;
    }
  }

  async function writeNotifyRecord(record) {
    try {
      await ctx.storage.setJSON(notifyKey, record);
    } catch (err) {
      warnLog(ctx, `写入通知记录失败: ${err.message}`, err);
    }
  }

  return {
    readBaseDailyCache,
    writeBaseDailyCache,
    readNotifyRecord,
    writeNotifyRecord
  };
}

async function renderCountdownWidget(ctx) {
  const scriptName = ctx.name || "时光倒数小组件";

  if (ctx.widgetFamily !== "medium") {
    return mkUnsupportedWidget("不支持当前尺寸");
  }

  const bjCtx = getBeijingDateContext(Date.now());

  const normalizedEnv = buildNormalizedEnv(ctx);
  const dataEnvCacheScope = hashString(JSON.stringify(normalizedEnv));

  const cacheManager = createCacheManager(ctx, scriptName, dataEnvCacheScope);

  const officialCache = await prepareOfficialHolidayCacheForWidget(
    ctx,
    scriptName,
    bjCtx,
    normalizedEnv,
    { timeoutMs: WIDGET_OFFICIAL_HTTP_TIMEOUT_MS }
  );

  const officialRanges = Object.values(officialCache.years || {}).flatMap(
    yearData => buildOfficialHolidayRanges(yearData.days || [])
  );

  const fallbackLegalRanges = [
    { name: "元旦", start: `${bjCtx.year}/01/01`, end: `${bjCtx.year}/01/01`, isOffDay: true },
    { name: "春节", start: `${bjCtx.year}/01/28`, end: `${bjCtx.year}/02/03`, isOffDay: true },
    { name: "清明节", start: `${bjCtx.year}/04/04`, end: `${bjCtx.year}/04/06`, isOffDay: true },
    { name: "劳动节", start: `${bjCtx.year}/05/01`, end: `${bjCtx.year}/05/05`, isOffDay: true },
    { name: "端午节", start: `${bjCtx.year}/05/31`, end: `${bjCtx.year}/06/02`, isOffDay: true },
    { name: "中秋节", start: `${bjCtx.year}/10/06`, end: `${bjCtx.year}/10/08`, isOffDay: true },
    { name: "国庆节", start: `${bjCtx.year}/10/01`, end: `${bjCtx.year}/10/07`, isOffDay: true }
  ].filter(isValidOfficialRange);

  const officialLegalRanges = officialRanges.filter(r => r.isOffDay);
  const mergedLegalRanges = mergeLegalHolidays(officialLegalRanges, fallbackLegalRanges);

  const countdownData = buildCountdownData(bjCtx, normalizedEnv, mergedLegalRanges);
  countdownData.officialRanges = officialRanges;

  const { result, todayFestivals, pinnedTopItems, pinnedTokenSet } = countdownData;

  const officialEnvFingerprint = getOfficialEnvFingerprint(normalizedEnv);
  const envFingerprint = hashString(
    `${dataEnvCacheScope}_${officialCache.fingerprint}_${officialEnvFingerprint}`
  );

  let displayCache = await cacheManager.readBaseDailyCache(envFingerprint, bjCtx);

  if (!displayCache) {
    displayCache = buildDisplayCache(result, LAYOUT_CONFIG.maxW);
    await cacheManager.writeBaseDailyCache(envFingerprint, bjCtx, displayCache);
  }

  if (todayFestivals.length > 0) {
    const notifyRecord = await cacheManager.readNotifyRecord();

    const lastNotifyDate = notifyRecord?.lastNotifyDate;
    const lastRetryAfter = Number(notifyRecord?.retryAfter) || 0;

    const shouldNotify =
      lastNotifyDate !== bjCtx.todayStr ||
      (lastRetryAfter > 0 && Date.now() >= lastRetryAfter);

    if (shouldNotify) {
      const festText = formatTodayFestGroup(todayFestivals);

      try {
        await ctx.notify({
          title: "🎉 今日节日提醒",
          body: festText
        });

        await cacheManager.writeNotifyRecord({
          lastNotifyDate: bjCtx.todayStr,
          retryAfter: 0
        });
      } catch (err) {
        warnLog(ctx, `发送通知失败: ${err.message}`, err);

        await cacheManager.writeNotifyRecord({
          lastNotifyDate: bjCtx.todayStr,
          retryAfter: Date.now() + NOTIFY_FAILED_RETRY_INTERVAL_MS
        });
      }
    }
  }

  const bgTheme = decideBgTheme(bjCtx, normalizedEnv, countdownData);

  const rows = buildGridRows(displayCache, result, LAYOUT_CONFIG);

  const pinnedStickyText = buildPinnedStickyText(pinnedTopItems);
  const randomNotice = pickRandomNotice();

  const titleIcon = mkIcon("calendar", C.main, LAYOUT_CONFIG.titleIcz);
  const titleText = mkText("时光倒数", LAYOUT_CONFIG.titleFz, "heavy", C.main);

  const todayDateText = mkText(
    `${bjCtx.month}月${bjCtx.day}日`,
    LAYOUT_CONFIG.titleFz,
    "semibold",
    C.sub
  );

  const topRightChildren = [];

  if (pinnedStickyText) {
    const pinnedRows = splitTextToLines(pinnedStickyText, 18);

    for (const line of pinnedRows.slice(0, 2)) {
      topRightChildren.push(
        mkText(line, LAYOUT_CONFIG.topFz, "medium", C.blue2, {
          textAlignment: "right",
          maxLines: 1
        })
      );
    }
  } else {
    topRightChildren.push(
      mkText(randomNotice, LAYOUT_CONFIG.topFz, "medium", C.muted, {
        textAlignment: "right",
        maxLines: 2
      })
    );
  }

  const headerRow = mkRow(
    [
      mkRow([titleIcon, titleText], 4),
      mkSpacer(),
      {
        type: "stack",
        direction: "column",
        alignItems: "end",
        gap: 2,
        children: topRightChildren
      }
    ],
    8
  );

  const subHeaderRow = mkRow(
    [
      todayDateText,
      mkSpacer(),
      mkText(
        getOfficialFingerprintText(officialCache.years),
        10,
        "medium",
        C.muted,
        { textAlignment: "right" }
      )
    ],
    8
  );

  return {
    type: "widget",
    padding: 14,
    backgroundGradient: getBackgroundGradient(bgTheme),
    refreshAfter: bjCtx.nextRefreshIso,
    children: [
      headerRow,
      mkSpacer(2),
      subHeaderRow,
      mkSpacer(10),
      ...rows
    ]
  };
}

export default async function main(ctx) {
  try {
    return await renderCountdownWidget(ctx);
  } catch (error) {
    warnLog(ctx, `主函数执行失败: ${error.message}`, error);

    return mkUnsupportedWidget("运行出错", {
      text: error.message || "未知错误",
      maxLines: 3
    });
  }
}