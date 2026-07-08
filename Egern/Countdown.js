/**
 * =======================================
 * 📌 时光倒数小组件
 *
 * ✨ 主要功能：
 * • 尺寸适配：仅支持中号小组件。
 * • 节日计算：内置农历算法数组，支持计算法定节假日、民俗节日、国际节日和专属纪念日倒计时。
 * • 官方假期：法定分类优先使用 NateScarlet/holiday-cn 官方放假数据；当前年数据缺失或过期时刷新；年初额外需要上一年数据；下一年数据仅在无可用日缓存且进入年底预取窗口时以短超时机会性预取；失败年份会按重试窗口延后再次请求。
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
 * =======================================
 */

const RANDOM_NOTICES = [
  " 距离放假，还要摸鱼多少天？",
  " 坚持住，就快放假啦！",
  " 上班好累呀，下顿吃啥？",
  " 努力，我还能加班24小时！",
  " 躺平中，等放假",
  " 施主请回，此饼不吃",
  " 只有摸鱼才是赚老板的钱",
  " 小乌龟慢慢爬",
  " 加油，明天会更好！",
  " 生活本该如此轻松",
  " 好累，但还能坚持一会儿",
  " 快放假啦，期待放松的时光",
  " 给自己加个鸡腿！",
  " 佛系上班，一切随缘",
  " 我的理想是：不上班还有钱",
  " 放弃幻想，认清现状，低调搬砖",
  " 生活碎片，拼凑成诗",
  " 慢慢走，沿途的花都开了",
  " 没什么期待，也就没什么失望",
  " 所谓的成长，就是学会不抱希望",
  " 只要努力工作，老板的午餐就是我的",
  " 今天的任务是：不干活！",
  " 用力生活，用力摸鱼"
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
    { light: "#FFFFFF", dark: "#1C1C1E" },
    { light: "#F2F2F7", dark: "#0C0C0E" }
  ],
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
const OFFICIAL_OPTIONAL_PREFETCH_START_MONTH = 11;
const OFFICIAL_REQUIRE_PREVIOUS_YEAR_MONTH = 1;

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

const mkSpacer = length => (length != null ? { type: "spacer", length } : { type: "spacer" });

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
  const nextRefreshMs = Date.UTC(year, month - 1, day + 1, 0, 1) - BJ_OFFSET_MS;

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
const HOLIDAY_NAME_PARTS_CACHE = new Map();
const HOLIDAY_NAME_PARTS_CACHE_LIMIT = 256;

function splitHolidayNames(name) {
  const raw = String(name ?? "").trim();

  if (!raw) return EMPTY_HOLIDAY_NAME_PARTS;

  const cached = HOLIDAY_NAME_PARTS_CACHE.get(raw);
  if (cached) return cached;

  const parts = Object.freeze(splitNameList(raw));

  if (HOLIDAY_NAME_PARTS_CACHE.size >= HOLIDAY_NAME_PARTS_CACHE_LIMIT) {
    HOLIDAY_NAME_PARTS_CACHE.clear();
  }

  HOLIDAY_NAME_PARTS_CACHE.set(raw, parts);

  return parts;
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

function partsIntersectArray(leftParts, rightParts) {
  if (
    !Array.isArray(leftParts) ||
    !Array.isArray(rightParts) ||
    leftParts.length === 0 ||
    rightParts.length === 0
  ) {
    return false;
  }

  for (const left of leftParts) {
    for (const right of rightParts) {
      if (left === right) {
        return true;
      }
    }
  }

  return false;
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

  let maxPriority = Number.isFinite(specialPriority[name]) ? specialPriority[name] : undefined;

  for (const n of names) {
    const p = specialPriority[n];

    if (Number.isFinite(p)) {
      maxPriority = maxPriority === undefined ? p : Math.max(maxPriority, p);
    }
  }

  return maxPriority;
}

function dedupeHolidayItemsByToken(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const usedTokenSet = new Set();
  const output = [];

  for (const item of items) {
    if (!item) continue;

    const parts = splitHolidayNames(item.name);
    const hasMatch = parts.some(part => usedTokenSet.has(part));

    if (hasMatch) continue;

    for (const part of parts) {
      usedTokenSet.add(part);
    }

    output.push(item);
  }

  return output;
}

const formatPeriodStr = (label, diff, duration = 1) => {
  if (diff === 0) return `今日 ${label}`;

  const total = Math.max(1, Number(duration) || 1);

  if (diff < 0 && total > 1) {
    const dayIndex = Math.floor(Math.abs(diff)) + 1;

    return dayIndex >= total ? `${label}最后一天` : `${label}第${dayIndex}天`;
  }

  return `${label} ${diff}天`;
};

const formatDisplayItem = item => formatPeriodStr(displayName(item.name), item.diff, item.duration);

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
    const tw =
      token.length > 1 ? token.length * 1.1 : token.charCodeAt(0) > 255 ? 2 : 1.1;

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
  return (result?.[cat] || []).slice(0, limit).map(formatDisplayItem).join("，");
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
    const rawText = displayCache?.[cfg.key]?.text ?? buildDisplayText(result, cfg.key, 3);

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
        mkRow(
          [
            mkRow(
              [
                mkSpacer(),
                mkIcon(
                  idx === 0 ? cfg.icon : "circle.fill",
                  idx === 0 ? cfg.color : C.transparent,
                  layoutConfig.icz
                ),
                mkSpacer()
              ],
              0,
              { width: layoutConfig.titleIcz }
            ),

            mkText(
              idx === 0 ? cfg.label : " ",
              layoutConfig.fz,
              "heavy",
              idx === 0 ? cfg.color : C.transparent
            ),

            mkSpacer()
          ],
          2,
          { width: layoutConfig.lw }
        ),

        mkText(lineStr, layoutConfig.fz, "medium", C.sub, {
          flex: 1,
          maxLines: 1
        })
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
      mkRow([mkIcon("exclamationmark.triangle.fill", C.red, 16), mkText(title, 14, "heavy", C.main)], 6),
      mkSpacer(8),
      mkText("请使用桌面 Medium 小组件", 12, "medium", C.sub, textOpts)
    ]
  };
}

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
        [
          0, 21208, 42467, 63836, 85337, 107014, 128867, 150921, 173149,
          195551, 218072, 240693, 263343, 285989, 308563, 331033, 353350,
          375494, 397447, 419210, 440795, 462224, 483532, 504758
        ][n - 1] *
          60000 +
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

const RENDER_ENV_KEYS = Object.freeze(["ENABLE_WEEKEND_THEME"]);

const CACHE_ENV_KEYS = Object.freeze([...DATA_ENV_KEYS, ...RENDER_ENV_KEYS]);

const CACHE_BOOL_ENV_KEYS = new Set([
  "ENABLE_PRIORITY_SORT",
  "ENABLE_EXCLUSIVE_WEIGHT",
  "ENABLE_WEEKEND_THEME"
]);

const BOOL_FALSE_VALUES = new Set(["false", "0", "no", "off", "disabled"]);
const BOOL_TRUE_VALUES = new Set(["true", "1", "yes", "on", "enabled"]);

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

  return sanitizeEnvStringValue(key, value);
}

function buildNormalizedEnv(env) {
  const normalized = {};

  for (const key of CACHE_ENV_KEYS) {
    normalized[key] = normalizeCacheEnvValue(key, env?.[key]);
  }

  return normalized;
}

function buildEnvFingerprintFromNormalized(normalizedEnv, keys = CACHE_ENV_KEYS) {
  return keys.map(key => `${key}=${normalizedEnv?.[key] ?? ""}`).join("|");
}

function isValidPinnedItem(item) {
  return (
    item &&
    typeof item === "object" &&
    typeof item.name === "string" &&
    item.name.trim() &&
    typeof item.diff === "number" &&
    Number.isFinite(item.diff)
  );
}

function isValidCountdownItem(item) {
  if (
    !item ||
    typeof item !== "object" ||
    typeof item.name !== "string" ||
    !item.name.trim() ||
    typeof item.diff !== "number" ||
    !Number.isFinite(item.diff)
  ) {
    return false;
  }

  if (item.duration !== undefined) {
    const duration = Number(item.duration);

    if (!Number.isFinite(duration) || duration < 1) {
      return false;
    }
  }

  return true;
}

const OFFICIAL_HOLIDAY_STORAGE_VERSION = 2;

function parseISODateParts(date) {
  const match = String(date ?? "").match(ISO_DATE_RE);

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

const DAILY_CACHE_SCHEMA_VERSION = 24;
const DAILY_CACHE_VERSION_TEXT = `v${DAILY_CACHE_SCHEMA_VERSION}`;

const warnLog = (...args) => console.warn(...args);

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

function getOfficialFingerprintForCompare(cache) {
  if (!cache) return "none";

  return typeof cache.fingerprint === "string" && cache.fingerprint
    ? cache.fingerprint
    : buildOfficialFingerprint(cache.years || {});
}

function shouldSaveOfficialCache(oldCache, newCache) {
  if (!oldCache) return true;

  const oldFingerprint = getOfficialFingerprintForCompare(oldCache);
  const newFingerprint = getOfficialFingerprintForCompare(newCache);

  return (
    oldCache.version !== newCache.version ||
    oldFingerprint !== newFingerprint ||
    oldCache.checkedDate !== newCache.checkedDate ||
    !sameSortedKeys(oldCache.years || {}, newCache.years || {}) ||
    !shallowObjectEqual(oldCache.retryAfterByYear || {}, newCache.retryAfterByYear || {})
  );
}

function uniqueFiniteNumbers(arr) {
  return [...new Set((arr || []).map(Number))].filter(Number.isFinite);
}

function normalizeOfficialDay(day) {
  if (
    !day ||
    typeof day !== "object" ||
    typeof day.name !== "string" ||
    typeof day.date !== "string" ||
    typeof day.isOffDay !== "boolean"
  ) {
    return null;
  }

  const name = day.name.trim();

  if (!name) {
    return null;
  }

  const parts = parseISODateParts(day.date);

  if (!parts) {
    return null;
  }

  return {
    name,
    date: day.date,
    isOffDay: day.isOffDay,
    ms: Date.UTC(parts.y, parts.m - 1, parts.d)
  };
}

function normalizeOfficialDays(days) {
  if (!Array.isArray(days) || days.length === 0) {
    return [];
  }

  const seen = new Set();
  const normalizedDays = [];

  for (const rawDay of days) {
    const day = normalizeOfficialDay(rawDay);

    if (!day) continue;

    const key = `${day.date}|${day.name}|${day.isOffDay ? 1 : 0}`;

    if (seen.has(key)) continue;

    seen.add(key);
    normalizedDays.push(day);
  }

  return normalizedDays.sort((a, b) => {
    if (a.ms !== b.ms) return a.ms - b.ms;

    const nameCompare = a.name.localeCompare(b.name);
    if (nameCompare !== 0) return nameCompare;

    return Number(b.isOffDay) - Number(a.isOffDay);
  });
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

  return {
    days: normalizeOfficialDays(data.days)
  };
}

function normalizeCachedOfficialYearData(yearData) {
  if (!yearData || typeof yearData !== "object" || !Array.isArray(yearData.days)) {
    return null;
  }

  const days = normalizeOfficialDays(yearData.days);

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

function isTrustedOfficialCacheYears(years) {
  if (!years || typeof years !== "object") {
    return false;
  }

  for (const yearData of Object.values(years)) {
    if (!yearData || typeof yearData !== "object" || !Array.isArray(yearData.days)) {
      return false;
    }

    for (const day of yearData.days) {
      if (
        !day ||
        typeof day !== "object" ||
        typeof day.name !== "string" ||
        !day.name.trim() ||
        typeof day.date !== "string" ||
        !isValidISODate(day.date) ||
        typeof day.isOffDay !== "boolean"
      ) {
        return false;
      }

      if (day.ms !== undefined && !Number.isFinite(Number(day.ms))) {
        return false;
      }
    }
  }

  return true;
}

function getFingerprintDays(yearData, assumeNormalized) {
  if (!yearData || typeof yearData !== "object" || !Array.isArray(yearData.days)) {
    return null;
  }

  if (!assumeNormalized) {
    return normalizeCachedOfficialYearData(yearData)?.days || null;
  }

  return yearData.days.filter(
    day =>
      day &&
      typeof day.date === "string" &&
      typeof day.name === "string" &&
      day.name.trim() &&
      typeof day.isOffDay === "boolean"
  );
}

function buildOfficialFingerprint(yearsData, assumeNormalized = false) {
  if (!yearsData || typeof yearsData !== "object") {
    return "none";
  }

  const parts = [];

  for (const year of Object.keys(yearsData).sort()) {
    const days = getFingerprintDays(yearsData[year], assumeNormalized);

    if (!days || days.length === 0) continue;

    parts.push(year);

    for (const day of days) {
      parts.push(`${day.date}:${day.name}:${day.isOffDay ? 1 : 0}`);
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

  if (sanitize && isTrustedOfficialCacheYears(cache.years)) {
    return {
      ...cache,
      fingerprint:
        typeof cache.fingerprint === "string" && cache.fingerprint
          ? cache.fingerprint
          : buildOfficialFingerprint(cache.years, true),
      years: cache.years
    };
  }

  const years = sanitize ? sanitizeOfficialYears(cache.years) : cache.years;

  const fingerprint = sanitize
    ? buildOfficialFingerprint(years, true)
    : typeof cache.fingerprint === "string" && cache.fingerprint
      ? cache.fingerprint
      : buildOfficialFingerprint(years);

  return {
    ...cache,
    fingerprint,
    years
  };
}

function readOfficialHolidayCache(ctx, storageKey, options = {}) {
  if (!storageKey) {
    return null;
  }

  const { sanitize = true } = options || {};

  try {
    return normalizeOfficialCacheOnRead(ctx.storage?.getJSON(storageKey), sanitize);
  } catch (e) {
    warnLog("[Countdown] failed to read official holiday cache:", e);
  }

  return null;
}

function shouldRequirePreviousOfficialYear(todayIso) {
  const parts = parseISODateParts(todayIso);

  return parts ? parts.m === OFFICIAL_REQUIRE_PREVIOUS_YEAR_MONTH : true;
}

function officialRequiredYears(currentYear, todayIso) {
  const years = [currentYear];

  if (shouldRequirePreviousOfficialYear(todayIso)) {
    years.unshift(currentYear - 1);
  }

  return years;
}

function officialOptionalYears(currentYear) {
  return [currentYear + 1];
}

function officialRequestYears(currentYear, todayIso) {
  return uniqueFiniteNumbers([
    ...officialRequiredYears(currentYear, todayIso),
    ...officialOptionalYears(currentYear)
  ]);
}

function shouldPrefetchNextOfficialYear(todayIso) {
  const parts = parseISODateParts(todayIso);

  return parts ? parts.m >= OFFICIAL_OPTIONAL_PREFETCH_START_MONTH : false;
}

function pruneOfficialYears(years, currentYear, todayIso) {
  const keep = new Set(officialRequestYears(currentYear, todayIso).map(String));
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

function pruneRetryAfterByYear(retryAfterByYear, currentYear, todayIso) {
  const keep = new Set(officialRequestYears(currentYear, todayIso).map(String));
  const pruned = {};
  const now = Date.now();

  for (const [year, value] of Object.entries(retryAfterByYear || {})) {
    const time = Number(value);

    if (keep.has(year) && Number.isFinite(time) && time > now) {
      pruned[year] = time;
    }
  }

  return pruned;
}

function hasOfficialYearData(yearsData, year) {
  const days = yearsData?.[String(year)]?.days;

  return Array.isArray(days) && days.length > 0;
}

function getMissingOfficialYears(yearsData, requestYears) {
  return requestYears.map(String).filter(year => !hasOfficialYearData(yearsData, year));
}

function getOfficialFingerprintText(cache) {
  return `official=${getOfficialFingerprintForCompare(cache)}`;
}

function getOfficialEnvFingerprint(dataEnvFingerprint, officialCache) {
  return `${dataEnvFingerprint}|${getOfficialFingerprintText(officialCache)}`;
}

function isOfficialRequiredReady(yearsData, currentYear, todayIso) {
  return getMissingOfficialYears(
    yearsData,
    officialRequiredYears(currentYear, todayIso)
  ).length === 0;
}

function isOfficialCacheFresh(cache, todayIso, currentYear) {
  if (!cache || !isValidISODate(cache.checkedDate) || !isValidISODate(todayIso)) {
    return false;
  }

  if (!isOfficialRequiredReady(cache.years, currentYear, todayIso)) {
    return false;
  }

  const age = isoToMs(todayIso) - isoToMs(cache.checkedDate);

  return age >= 0 && age < OFFICIAL_REFRESH_INTERVAL_MS;
}

function isOfficialYearRetryBlocked(cache, year, now = Date.now()) {
  const retryAt = Number(cache?.retryAfterByYear?.[String(year)]);

  return Number.isFinite(retryAt) && retryAt > now;
}

function getOfficialFetchableYears(cache, years, now = Date.now()) {
  return uniqueFiniteNumbers(years).filter(year => !isOfficialYearRetryBlocked(cache, year, now));
}

function normalizeOfficialCachePayload(oldCache, years, currentYear, todayIso, retryAfterByYearOverride) {
  const checkedDate = isValidISODate(oldCache?.checkedDate) ? oldCache.checkedDate : undefined;

  return {
    version: OFFICIAL_HOLIDAY_STORAGE_VERSION,
    ...(checkedDate ? { checkedDate } : {}),
    fingerprint: buildOfficialFingerprint(years, true),
    retryAfterByYear: pruneRetryAfterByYear(
      retryAfterByYearOverride ?? oldCache?.retryAfterByYear,
      currentYear,
      todayIso
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

async function fetchOfficialHolidayYear(ctx, year, timeoutMs = HTTP_TIMEOUT_MS) {
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

async function loadOfficialHolidayDaily(ctx, currentYear, todayIso, storageKey, options = {}) {
  if (!storageKey) {
    throw new Error("official holiday storageKey required");
  }

  const { httpTimeoutMs = HTTP_TIMEOUT_MS, forceYearsToFetch = [] } = options || {};

  const hasProvidedOldCache = Object.prototype.hasOwnProperty.call(options || {}, "oldCache");

  const oldCache = hasProvidedOldCache
    ? options.oldCache
    : readOfficialHolidayCache(ctx, storageKey);

  const requestTimeoutMs = normalizeHttpTimeoutMs(httpTimeoutMs);

  if (!ctx.http || !ctx.storage) {
    return oldCache;
  }

  const mergedYears = pruneOfficialYears(oldCache?.years || {}, currentYear, todayIso);

  const retryAfterByYear = pruneRetryAfterByYear(
    oldCache?.retryAfterByYear,
    currentYear,
    todayIso
  );

  const now = Date.now();
  const requestedYears = uniqueFiniteNumbers(forceYearsToFetch);

  const yearsToFetch = getOfficialFetchableYears({ retryAfterByYear }, requestedYears, now);

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
    yearsToFetch.map(year => fetchOfficialHolidayYear(ctx, year, requestTimeoutMs))
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
      retryAfterByYear[key] = now + OFFICIAL_FAILED_RETRY_INTERVAL_MS;
      warnLog("[Countdown] failed to fetch official holiday:", key, result.reason);
    }
  }

  const fetchedCurrentYear = yearsToFetch.includes(currentYear);

  const previousCheckedDate = isValidISODate(oldCache?.checkedDate)
    ? oldCache.checkedDate
    : undefined;

  const shouldUpdateCheckedDate =
    isOfficialRequiredReady(mergedYears, currentYear, todayIso) &&
    fetchedCurrentYear &&
    successfulFetchYearSet.has(String(currentYear));

  const checkedDate = shouldUpdateCheckedDate ? todayIso : previousCheckedDate;

  const newCache = {
    version: OFFICIAL_HOLIDAY_STORAGE_VERSION,
    ...(checkedDate ? { checkedDate } : {}),
    fingerprint: buildOfficialFingerprint(mergedYears, true),
    retryAfterByYear: pruneRetryAfterByYear(retryAfterByYear, currentYear, todayIso),
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

async function safeLoadOfficialHolidayDaily(ctx, currentYear, todayIso, storageKey, options = {}) {
  if (!storageKey) {
    return null;
  }

  try {
    return await loadOfficialHolidayDaily(ctx, currentYear, todayIso, storageKey, options);
  } catch (e) {
    warnLog("[Countdown] official holiday load failed, fallback to local/cache:", e);

    try {
      return readOfficialHolidayCache(ctx, storageKey);
    } catch (cacheError) {
      warnLog("[Countdown] failed to read official holiday cache after load failure:", cacheError);

      return null;
    }
  }
}

function resolveOfficialRefreshPlan({
  officialHolidayCache,
  currentYear,
  todayIso,
  hasCachedBaseData = false
}) {
  const years = officialHolidayCache?.years;
  const now = Date.now();
  const cacheIsFresh = isOfficialCacheFresh(officialHolidayCache, todayIso, currentYear);

  const canPlanOptionalYear =
    !hasCachedBaseData && shouldPrefetchNextOfficialYear(todayIso);

  const getOptionalYearsToFetch = () => {
    if (!canPlanOptionalYear) {
      return [];
    }

    const missingOptionalYears = uniqueFiniteNumbers(
      getMissingOfficialYears(years, officialOptionalYears(currentYear))
    );

    return getOfficialFetchableYears(officialHolidayCache, missingOptionalYears, now);
  };

  const missingRequiredYears = uniqueFiniteNumbers(
    getMissingOfficialYears(years, officialRequiredYears(currentYear, todayIso))
  );

  if (missingRequiredYears.length > 0) {
    const missingRequiredYearsToFetch = getOfficialFetchableYears(
      officialHolidayCache,
      missingRequiredYears,
      now
    );

    const currentYearRefreshToFetch =
      missingRequiredYearsToFetch.length > 0 &&
      !cacheIsFresh &&
      !missingRequiredYears.includes(currentYear)
        ? getOfficialFetchableYears(officialHolidayCache, [currentYear], now)
        : [];

    const blockingYearsToFetch = uniqueFiniteNumbers([
      ...missingRequiredYearsToFetch,
      ...currentYearRefreshToFetch
    ]);

    return {
      blockingYearsToFetch,
      optionalYearsToFetch: [],
      shouldBlockRenderForOfficialRefresh: blockingYearsToFetch.length > 0,
      optionalOnly: false,
      shouldDeferOptionalRefresh: false
    };
  }

  if (!cacheIsFresh) {
    const blockingYearsToFetch = getOfficialFetchableYears(
      officialHolidayCache,
      [currentYear],
      now
    );

    return {
      blockingYearsToFetch,
      optionalYearsToFetch: [],
      shouldBlockRenderForOfficialRefresh:
        blockingYearsToFetch.length > 0 && !hasCachedBaseData,
      optionalOnly: false,
      shouldDeferOptionalRefresh: false
    };
  }

  const optionalYearsToFetch = getOptionalYearsToFetch();

  if (optionalYearsToFetch.length > 0) {
    return {
      blockingYearsToFetch: [],
      optionalYearsToFetch,
      shouldBlockRenderForOfficialRefresh: false,
      optionalOnly: true,

      shouldDeferOptionalRefresh: true
    };
  }

  return {
    blockingYearsToFetch: [],
    optionalYearsToFetch: [],
    shouldBlockRenderForOfficialRefresh: false,
    optionalOnly: false,
    shouldDeferOptionalRefresh: false
  };
}

function shouldRefreshOfficialBeforeRender(
  canRefreshOfficialHoliday,
  plan,
  hasCachedBaseData = false
) {
  if (!canRefreshOfficialHoliday || !plan || plan.optionalOnly === true) {
    return false;
  }

  const blockingYearsToFetch = Array.isArray(plan.blockingYearsToFetch)
    ? plan.blockingYearsToFetch
    : [];

  if (blockingYearsToFetch.length === 0) {
    return false;
  }

  return (
    plan.shouldBlockRenderForOfficialRefresh === true ||
    hasCachedBaseData === false
  );
}

async function refreshOfficialCache({
  ctx,
  officialHolidayStorageKey,
  currentYear,
  todayIso,
  officialHolidayCache,
  forceYearsToFetch
}) {
  const yearsToFetch = getOfficialFetchableYears(officialHolidayCache, forceYearsToFetch);

  if (yearsToFetch.length === 0) {
    return officialHolidayCache;
  }

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

  return refreshedCache || officialHolidayCache;
}

async function prepareOfficialHolidayCacheForWidget({
  ctx,
  currentYear,
  todayIso,
  dataEnvFingerprint,
  officialHolidayStorageKey,
  readBaseDailyCache
}) {
  let officialHolidayCache = readOfficialHolidayCache(ctx, officialHolidayStorageKey);

  const readBaseByCurrentOfficialState = () => {
    const envFingerprint = getOfficialEnvFingerprint(dataEnvFingerprint, officialHolidayCache);

    return {
      envFingerprint,
      cachedBaseData: readBaseDailyCache(envFingerprint)
    };
  };

  let { envFingerprint, cachedBaseData } = readBaseByCurrentOfficialState();

  const canRefreshOfficialHoliday = Boolean(ctx.http && ctx.storage);

  const plan = resolveOfficialRefreshPlan({
    officialHolidayCache,
    currentYear,
    todayIso,
    hasCachedBaseData: Boolean(cachedBaseData)
  });

  if (
    shouldRefreshOfficialBeforeRender(
      canRefreshOfficialHoliday,
      plan,
      Boolean(cachedBaseData)
    )
  ) {
    const fallbackEnvFingerprint = envFingerprint;
    const fallbackCachedBaseData = cachedBaseData;
    const oldOfficialFingerprint = getOfficialFingerprintText(officialHolidayCache);

    officialHolidayCache = await refreshOfficialCache({
      ctx,
      officialHolidayStorageKey,
      currentYear,
      todayIso,
      officialHolidayCache,
      forceYearsToFetch: plan.blockingYearsToFetch
    });

    ({ envFingerprint, cachedBaseData } = readBaseByCurrentOfficialState());

    if (
      !cachedBaseData &&
      fallbackCachedBaseData &&
      getOfficialFingerprintText(officialHolidayCache) === oldOfficialFingerprint
    ) {
      return {
        officialHolidayCache,
        envFingerprint: fallbackEnvFingerprint,
        cachedBaseData: fallbackCachedBaseData
      };
    }

    return {
      officialHolidayCache,
      envFingerprint,
      cachedBaseData
    };
  }

  if (
    canRefreshOfficialHoliday &&
    plan.optionalOnly === true &&
    plan.shouldDeferOptionalRefresh === true &&
    Array.isArray(plan.optionalYearsToFetch) &&
    plan.optionalYearsToFetch.length > 0
  ) {
    officialHolidayCache = await refreshOfficialCache({
      ctx,
      officialHolidayStorageKey,
      currentYear,
      todayIso,
      officialHolidayCache,
      forceYearsToFetch: plan.optionalYearsToFetch
    });

    ({ envFingerprint, cachedBaseData } = readBaseByCurrentOfficialState());

    return {
      officialHolidayCache,
      envFingerprint,
      cachedBaseData
    };
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

  if (!Number.isInteger(duration) || duration < 1 || duration > 30) {
    return false;
  }

  if (range.end !== undefined && !isValidISODate(range.end)) {
    return false;
  }

  if (range.startMs !== undefined && !Number.isFinite(Number(range.startMs))) {
    return false;
  }

  if (range.endMs !== undefined && !Number.isFinite(Number(range.endMs))) {
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

  if (!Number.isFinite(startMs) || !Number.isInteger(duration) || duration < 1) {
    return false;
  }

  const endMs = Number.isFinite(Number(range.endMs))
    ? Number(range.endMs)
    : startMs + (duration - 1) * DAY_MS;

  const yearStartMs = Date.UTC(year, 0, 1);
  const yearEndMs = Date.UTC(year, 11, 31);

  return startMs <= yearEndMs && endMs >= yearStartMs;
}

function getOfficialDayMs(day) {
  const ms = Number(day?.ms);

  if (Number.isFinite(ms)) {
    return ms;
  }

  return isoToMs(day?.date);
}

function buildOfficialHolidayRangesFromNormalizedDays(days) {
  if (!Array.isArray(days) || days.length === 0) {
    return [];
  }

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

    const ms = getOfficialDayMs(day);

    if (!Number.isFinite(ms)) {
      continue;
    }

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

  return buildOfficialHolidayRangesFromNormalizedDays(allDays);
}

function getOfficialLegalHolidaysFromRanges(officialRanges, year) {
  if (!Array.isArray(officialRanges) || officialRanges.length === 0) {
    return null;
  }

  const rows = officialRanges
    .filter(range => isValidOfficialRange(range) && officialRangeOverlapsYear(range, year))
    .map(range => {
      const startMs = Number.isFinite(Number(range.startMs))
        ? Number(range.startMs)
        : isoToMs(range.start);

      const ymd = range.startYMD || msToYMD(startMs) || isoToYMD(range.start);

      return [range.name.trim(), ymd, Number(range.duration), "official", startMs];
    })
    .filter(row => row[1]);

  return rows.length > 0 ? rows : null;
}

function officialRowDistanceToFallback(row, fallbackMs) {
  const startMs = Number.isFinite(Number(row?.[4])) ? Number(row[4]) : slashYMDToMs(row?.[1]);

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

  return {
    row,
    name,
    parts,
    partSet: new Set(parts),
    startMs: slashYMDToMs(row[1])
  };
}

function buildHolidayRowMetas(rows, keepInvalid = false) {
  if (!Array.isArray(rows)) {
    return [];
  }

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

    if (!partsIntersect(official.parts, fallback.partSet)) {
      continue;
    }

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

  if (officialRows.length === 0) {
    return [...fallbackLegal];
  }

  const fallbackRows = buildHolidayRowMetas(fallbackLegal, true);
  const merged = [];
  const usedOfficialIndexes = new Set();
  const coveredFallbackTokens = new Set();
  const fallbackTokenSet = new Set();

  for (const fallback of fallbackRows) {
    for (const part of fallback.parts) {
      fallbackTokenSet.add(part);
    }
  }

  for (const fallback of fallbackRows) {
    if (!fallback.name) {
      merged.push(fallback.row);
      continue;
    }

    if (holidayNameMatchesTokenSet(fallback.name, coveredFallbackTokens)) {
      continue;
    }

    const bestIndex = findBestOfficialMatchIndex(
      officialRows,
      usedOfficialIndexes,
      fallback
    );

    if (bestIndex >= 0) {
      const official = officialRows[bestIndex];

      usedOfficialIndexes.add(bestIndex);

      for (const part of official.parts) {
        coveredFallbackTokens.add(part);
      }

      merged.push(official.row);
    } else {
      merged.push(fallback.row);
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
  const parts = parseISODateParts(todayIso);

  if (!parts) {
    return null;
  }

  const years = officialHolidayCache?.years;

  if (!years || typeof years !== "object") {
    return null;
  }

  const findInYear = yearKey => {
    const days = years?.[String(yearKey)]?.days;

    if (!Array.isArray(days)) {
      return null;
    }

    return (
      days.find(
        day =>
          day &&
          day.date === todayIso &&
          typeof day.isOffDay === "boolean"
      ) || null
    );
  };

  const checkedYearKeys = new Set();
  const preferredYearKeys = [
    String(parts.y),
    String(parts.y - 1),
    String(parts.y + 1)
  ];

  for (const yearKey of preferredYearKeys) {
    checkedYearKeys.add(yearKey);

    const found = findInYear(yearKey);

    if (found) {
      return found;
    }
  }

  for (const yearKey of Object.keys(years).sort()) {
    if (checkedYearKeys.has(yearKey)) {
      continue;
    }

    const found = findInYear(yearKey);

    if (found) {
      return found;
    }
  }

  return null;
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
  const getStr = (key, defaultVal = "") => getStrFromNormalizedEnv(normalizedEnv, key, defaultVal);

  const getBool = (key, defaultVal = true) =>
    getBoolFromNormalizedEnv(normalizedEnv, key, defaultVal);

  const pinnedHolidays = [...new Set(splitNameList(getStr("PINNED_HOLIDAY")))];

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

    if (isValidLunarYear(y) && Number.isInteger(m) && m >= 1 && m <= 12) {
      const monthDays = Lunar.mDays(y, m);

      if (Number.isInteger(d) && d >= 1 && d <= monthDays) {
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

        const date = new Date(Date.UTC(1900, 0, 31) + (off + d - 1) * DAY_MS);

        resultDate = YMD(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
      }
    }

    lunarToSolarCache.set(cacheKey, resultDate);

    return resultDate;
  };
}

function buildYearFestivals({ year: y, annualCustomDays, l2s, officialRanges }) {
  const term = n => {
    if (!isValidLunarYear(y)) return null;

    const bjT = new Date(Lunar.term(y, n).getTime() + BJ_OFFSET_MS);

    return YMD(bjT.getUTCFullYear(), bjT.getUTCMonth() + 1, bjT.getUTCDate());
  };

  const wDay = (m, n, w) => {
    const x = w - new Date(Date.UTC(y, m - 1, 1)).getUTCDay();

    return YMD(y, m, 1 + (x < 0 ? x + 7 : x) + (n - 1) * 7);
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

  const officialLegal = getOfficialLegalHolidaysFromRanges(officialRanges, y);

  return {
    legal: mergeLegalHolidays(fallbackLegal, officialLegal),

    exclusive: annualCustomDays.map(item => {
      const { month, day } = item.spec;

      return [item.name, isValidMonthDay(y, month, day) ? YMD(y, month, day) : null, 1, "custom"];
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

function compareTodayItems(a, b) {
  const pa = a.priority ?? 0;
  const pb = b.priority ?? 0;

  if (pb !== pa) return pb - pa;
  if (b.diff !== a.diff) return b.diff - a.diff;

  return String(a.name).localeCompare(String(b.name));
}

function createPriorityResolver(enablePrioritySort, enableExclusiveWeight) {
  return (name, cat, sourceKind) => {
    if (!enablePrioritySort) return 1;

    if (sourceKind === "custom") {
      return enableExclusiveWeight ? 9 : basePriority[cat] ?? 1;
    }

    const special = getSpecialHolidayPriority(name);

    return special ?? basePriority[cat] ?? 1;
  };
}

function finalizeCountdownResult({
  rawResult,
  todayItemMap,
  pinnedMap,
  pinnedHolidays,
  pinnedTokenSet,
  enablePrioritySort
}) {
  const todayItems = Array.from(todayItemMap.values()).sort(compareTodayItems);

  const displayTodayItems = dedupeHolidayItemsByToken(todayItems);
  const todayFestTokenSet = new Set();

  for (const item of displayTodayItems) {
    addHolidayNameTokens(todayFestTokenSet, item.name);
  }

  const result = {};

  for (const cat of CATEGORY_KEYS) {
    result[cat] = Array.from(rawResult[cat].values())
      .filter(
        i =>
          !holidayNameMatchesTokenSet(i.name, pinnedTokenSet) &&
          !holidayNameMatchesTokenSet(i.name, todayFestTokenSet)
      )
      .sort((a, b) => {
        if (a.diff !== b.diff) return a.diff - b.diff;

        return enablePrioritySort ? b.priority - a.priority : 0;
      })
      .slice(0, 7);
  }

  const todayNoticeText =
    displayTodayItems.length > 0 ? formatTodayFestGroup(displayTodayItems) : "";

  const pinnedData = pinnedHolidays
    .filter(n => pinnedMap.has(n))
    .map(n => ({
      name: n,
      diff: pinnedMap.get(n)
    }))
    .sort((a, b) => a.diff - b.diff);

  return {
    result,
    todayNoticeText,
    pinnedData,
    todayItems
  };
}

function createCountdownCollectionState() {
  const rawResult = {};

  for (const cat of CATEGORY_KEYS) {
    rawResult[cat] = new Map();
  }

  return {
    rawResult,
    todayItemMap: new Map(),
    pinnedMap: new Map(),
    pinnedTokenSet: new Set()
  };
}

function buildPinnedHolidayPartsMap(pinnedHolidays) {
  const pinnedHolidayPartsMap = new Map();

  for (const pinnedName of pinnedHolidays) {
    pinnedHolidayPartsMap.set(pinnedName, splitHolidayNames(pinnedName));
  }

  return pinnedHolidayPartsMap;
}

function addTodayCountdownItem(state, name, diff, priority, cat, duration = 1) {
  const key = String(name);

  const nextItem = {
    name,
    diff,
    duration,
    priority: priority + 100,
    cat
  };

  const oldItem = state.todayItemMap.get(key);

  if (
    !oldItem ||
    nextItem.priority > oldItem.priority ||
    (nextItem.priority === oldItem.priority && nextItem.diff > oldItem.diff)
  ) {
    state.todayItemMap.set(key, nextItem);
  }
}

function updatePinnedCountdown(state, collectCtx, name, diff) {
  const { pinnedHolidays, pinnedHolidayPartsMap } = collectCtx;

  if (!Array.isArray(pinnedHolidays) || pinnedHolidays.length === 0) {
    return;
  }

  const nameParts = splitHolidayNames(name);
  const matched = [];

  for (const pinnedName of pinnedHolidays) {
    const pinnedParts = pinnedHolidayPartsMap.get(pinnedName);

    if (partsIntersectArray(pinnedParts, nameParts)) {
      matched.push(pinnedName);
    }
  }

  if (matched.length === 0) {
    return;
  }

  for (const pinnedName of matched) {
    const oldPinnedDiff = state.pinnedMap.get(pinnedName);

    if (oldPinnedDiff === undefined || diff < oldPinnedDiff) {
      state.pinnedMap.set(pinnedName, diff);
      addHolidayNameTokens(state.pinnedTokenSet, pinnedName);
    }
  }
}

function addCountdownFestival(
  state,
  collectCtx,
  cat,
  name,
  dateStr,
  duration = 1,
  sourceKind = ""
) {
  if (!name || !dateStr) return;

  const dateParts = parseSlashYMDParts(dateStr);

  if (!dateParts) {
    return;
  }

  const diff = (dateParts.ms - collectCtx.todayMs) / DAY_MS;
  const priority = collectCtx.getPriority(name, cat, sourceKind);
  const safeDuration = Math.max(1, Number(duration) || 1);

  if (diff <= 0 && diff > -safeDuration) {
    addTodayCountdownItem(state, name, diff, priority, cat, safeDuration);
    return;
  }

  if (diff > 0) {
    updatePinnedCountdown(state, collectCtx, name, diff);

    const old = state.rawResult[cat].get(name);

    if (!old || diff < old.diff) {
      state.rawResult[cat].set(name, {
        name,
        diff,
        duration: safeDuration,
        priority,
        cat
      });
    }
  }
}

function buildCountdownData({ normalizedEnv, officialHolidayCache, year: Y, todayMs }) {
  const officialRanges = buildOfficialHolidayRangeCache(officialHolidayCache);
  const userConfig = parseCountdownUserConfig(normalizedEnv);

  const {
    enablePrioritySort,
    enableExclusiveWeight,
    pinnedHolidays,
    annualCustomDays,
    onceCustomDays
  } = userConfig;

  const state = createCountdownCollectionState();
  const pinnedHolidayPartsMap = buildPinnedHolidayPartsMap(pinnedHolidays);
  const l2s = createLunarToSolarConverter();
  const getPriority = createPriorityResolver(enablePrioritySort, enableExclusiveWeight);

  const collectCtx = {
    todayMs,
    getPriority,
    pinnedHolidays,
    pinnedHolidayPartsMap
  };

  const yearsToScan = [Y - 1, Y, Y + 1];

  for (const y of yearsToScan) {
    const f = buildYearFestivals({
      year: y,
      annualCustomDays,
      l2s,
      officialRanges
    });

    for (const cat of CATEGORY_KEYS) {
      for (const [name, dateStr, duration = 1, sourceKind = ""] of f[cat]) {
        addCountdownFestival(
          state,
          collectCtx,
          cat,
          name,
          dateStr,
          duration,
          sourceKind
        );
      }
    }
  }

  for (const item of onceCustomDays) {
    const { year, month, day } = item.spec;

    addCountdownFestival(
      state,
      collectCtx,
      "exclusive",
      item.name,
      YMD(year, month, day),
      1,
      "custom"
    );
  }

  return finalizeCountdownResult({
    rawResult: state.rawResult,
    todayItemMap: state.todayItemMap,
    pinnedMap: state.pinnedMap,
    pinnedHolidays,
    pinnedTokenSet: state.pinnedTokenSet,
    enablePrioritySort
  });
}

function isValidCountdownResult(result) {
  return (
    result &&
    typeof result === "object" &&
    CATEGORY_KEYS.every(
      key => Array.isArray(result[key]) && result[key].every(isValidCountdownItem)
    )
  );
}

function isValidBaseDailyPayload(payload) {
  return (
    payload &&
    typeof payload === "object" &&
    isValidCountdownResult(payload.result) &&
    typeof payload.todayNoticeText === "string" &&
    Array.isArray(payload.pinnedData) &&
    payload.pinnedData.every(isValidPinnedItem) &&
    Array.isArray(payload.todayItems) &&
    payload.todayItems.every(isValidCountdownItem)
  );
}

function notifyTodayIfNeeded(ctx, notifyKey, notifyDate, todayItems, legacyNotifyKey) {
  if (
    typeof ctx.notify !== "function" ||
    !ctx.storage ||
    !Array.isArray(todayItems) ||
    todayItems.length === 0
  ) {
    return;
  }

  const readNotifyState = key => {
    if (!key) return {};

    try {
      const value = ctx.storage.getJSON(key);

      return value && typeof value === "object" ? value : {};
    } catch (e) {
      warnLog("[Countdown] failed to read notify state:", e);

      return {};
    }
  };

  const writeNotifyState = (key, value, errorMessage) => {
    if (!key) return false;

    try {
      ctx.storage.setJSON(key, value);

      return true;
    } catch (e) {
      warnLog(errorMessage, e);

      return false;
    }
  };

  try {
    const notifyNames = [
      ...new Set(
        todayItems
          .filter(i => i && i.diff === 0)
          .map(i => i.name)
          .filter(Boolean)
      )
    ];

    if (notifyNames.length === 0) {
      return;
    }

    const now = Date.now();
    const currentNotifyState = readNotifyState(notifyKey);
    let matchedNotifyState = currentNotifyState;

    if (
      matchedNotifyState.date !== notifyDate &&
      legacyNotifyKey &&
      legacyNotifyKey !== notifyKey
    ) {
      const legacyNotifyState = readNotifyState(legacyNotifyKey);

      if (legacyNotifyState.date === notifyDate) {
        matchedNotifyState = legacyNotifyState;

        writeNotifyState(
          notifyKey,
          {
            ...legacyNotifyState,
            migratedAt: now
          },
          "[Countdown] failed to migrate notify state:"
        );
      }
    }

    if (matchedNotifyState.date === notifyDate) {
      const failed = matchedNotifyState.failed === true;
      const retryAfter = Number(matchedNotifyState.retryAfter) || 0;

      if (!failed || retryAfter > now) {
        return;
      }
    }

    try {
      ctx.notify({
        title: "✨ 今日提醒",
        body: notifyNames.join("、"),
        sound: true
      });
    } catch (e) {
      warnLog("[Countdown] notify failed:", e);

      writeNotifyState(
        notifyKey,
        {
          date: notifyDate,
          names: notifyNames,
          time: Date.now(),
          failed: true,
          retryAfter: Date.now() + NOTIFY_FAILED_RETRY_INTERVAL_MS,
          error: String(e?.message || e || "notify failed").slice(0, 120)
        },
        "[Countdown] failed to save notify failure state:"
      );

      return;
    }

    writeNotifyState(
      notifyKey,
      {
        date: notifyDate,
        names: notifyNames,
        time: Date.now(),
        failed: false
      },
      "[Countdown] failed to save notify success state:"
    );
  } catch (e) {
    warnLog("[Countdown] notify process failed:", e);
  }
}

function buildPinnedStickyText(pinnedData, limit = TOP_PINNED_DISPLAY_LIMIT) {
  if (!Array.isArray(pinnedData) || pinnedData.length === 0) {
    return "";
  }

  const safeLimit = Math.max(1, Number(limit) || TOP_PINNED_DISPLAY_LIMIT);
  const validPinnedData = pinnedData.filter(isValidPinnedItem);

  if (validPinnedData.length === 0) {
    return "";
  }

  const parts = validPinnedData.slice(0, safeLimit).map(p => `${p.name} ${p.diff}天`);

  if (validPinnedData.length > safeLimit) {
    parts.push("…");
  }

  return parts.join("·");
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
  const officialHolidayStorageKey = `${storageScope}:official_holidays:v${OFFICIAL_HOLIDAY_STORAGE_VERSION}`;

  const dataEnvStorageFingerprint = buildEnvFingerprintFromNormalized(normalizedEnv, DATA_ENV_KEYS);
  const dataEnvCacheSuffix = hashString(dataEnvStorageFingerprint);

  const enableWeekendTheme = getBoolFromNormalizedEnv(
    normalizedEnv,
    "ENABLE_WEEKEND_THEME",
    true
  );

  const { year: Y, weekday: currentDay, todayMs, todayIso, todayStr } = dateCtx;

  const BASE_CACHE_KEY = `${storageScope}:daily:${dataEnvCacheSuffix}:v${DAILY_CACHE_SCHEMA_VERSION}`;
  const NOTIFY_KEY = `${storageScope}:notify:v1`;
  const LEGACY_NOTIFY_KEY = `${storageScope}:notify:${dataEnvCacheSuffix}`;
  const CACHE_VERSION = DAILY_CACHE_VERSION_TEXT;

  let baseDailyCacheRecordLoaded = false;
  let baseDailyCacheRecord = null;

  const readBaseDailyCacheRecord = () => {
    if (baseDailyCacheRecordLoaded) {
      return baseDailyCacheRecord;
    }

    baseDailyCacheRecordLoaded = true;

    if (!ctx.storage) {
      baseDailyCacheRecord = null;
      return null;
    }

    try {
      baseDailyCacheRecord = ctx.storage.getJSON(BASE_CACHE_KEY);
    } catch (e) {
      warnLog("[Countdown] failed to read base daily cache:", e);
      baseDailyCacheRecord = null;
    }

    return baseDailyCacheRecord;
  };

  const readBaseDailyCache = currentEnvFingerprint => {
    const stored = readBaseDailyCacheRecord();
    const payload = stored?.payload;

    if (
      stored &&
      stored.version === CACHE_VERSION &&
      stored.date === todayStr &&
      stored.envFingerprint === currentEnvFingerprint &&
      isValidBaseDailyPayload(payload)
    ) {
      return payload;
    }

    return null;
  };

  const writeBaseDailyCache = (envFingerprint, payload) => {
    if (!ctx.storage || !isValidBaseDailyPayload(payload)) return;

    const nextRecord = {
      version: CACHE_VERSION,
      date: todayStr,
      envFingerprint,
      payload
    };

    try {
      ctx.storage.setJSON(BASE_CACHE_KEY, nextRecord);

      baseDailyCacheRecordLoaded = true;
      baseDailyCacheRecord = nextRecord;
    } catch (e) {
      warnLog("[Countdown] failed to save base daily cache:", e);
    }
  };

  const { officialHolidayCache, envFingerprint, cachedBaseData } =
    await prepareOfficialHolidayCacheForWidget({
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

  const { result, todayNoticeText, pinnedData, todayItems } = baseData;

  const layoutConfig = LAYOUT_CONFIG;
  const displayCache = buildDisplayCache(result, layoutConfig.maxW);
  const stickyText = buildPinnedStickyText(pinnedData);

  notifyTodayIfNeeded(ctx, NOTIFY_KEY, todayIso, todayItems, LEGACY_NOTIFY_KEY);

  const officialTodayInfo = enableWeekendTheme
    ? getOfficialDayInfo(officialHolidayCache, todayIso)
    : null;

  const isOfficialOffDay = officialTodayInfo?.isOffDay === true;
  const isOfficialAdjustedWorkday = officialTodayInfo?.isOffDay === false;

  const hasActiveTodayItem = Array.isArray(todayItems) && todayItems.length > 0;

  const themeKey = hasActiveTodayItem
    ? "fest"
    : enableWeekendTheme &&
        (isOfficialOffDay ||
          (!isOfficialAdjustedWorkday && (currentDay === 0 || currentDay === 6)))
      ? "weekend"
      : "workday";

  const backgroundGradient = getBackgroundGradient(themeKey);
  const gridRows = buildGridRows(displayCache, result, layoutConfig);

  const rightHeaderElements = [];
  const topTextOpts = { maxLines: 1, minScale: 0.75 };

  if (todayNoticeText) {
    rightHeaderElements.push(
      mkIcon("sparkles", C.purple, layoutConfig.topFz),
      mkText(todayNoticeText, layoutConfig.topFz, "bold", C.purple, topTextOpts)
    );
  } else {
    rightHeaderElements.push(
      mkIcon("tortoise", C.blue2, Math.round(layoutConfig.topFz * 1.5)),
      mkText(
        RANDOM_NOTICES[Math.floor(Math.random() * RANDOM_NOTICES.length)],
        layoutConfig.topFz,
        "medium",
        C.green,
        topTextOpts
      )
    );
  }

  if (stickyText) {
    rightHeaderElements.push(
      mkText(" ｜ ", layoutConfig.topFz, "bold", C.red, { maxLines: 1 }),
      mkText(stickyText, layoutConfig.topFz, "bold", C.red, topTextOpts)
    );
  }

  return withRefresh({
    type: "widget",
    padding: 12,
    backgroundGradient,
    children: [
      mkRow(
        [
          mkIcon("hourglass.circle.fill", C.main, layoutConfig.titleIcz),
          mkText("时光倒数", layoutConfig.titleFz, "heavy", C.main),
          mkSpacer(),
          mkRow(rightHeaderElements, 4)
        ],
        6
      ),

      mkSpacer(gridRows.length <= 4 ? 12 : 10),

      ...(gridRows.length > 0
        ? [
            {
              type: "stack",
              direction: "column",
              alignItems: "start",
              gap: gridRows.length <= 4 ? 11 : 8,
              children: gridRows
            }
          ]
        : [mkText("近期暂无倒计时", layoutConfig.fz, "medium", C.muted)]),

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
        mkRow(
          [
            mkIcon("exclamationmark.triangle.fill", C.red, 16),
            mkText("时光倒数加载失败", 14, "heavy", C.main)
          ],
          6
        ),
        mkSpacer(8),
        mkText("请稍后刷新或检查脚本配置", 12, "medium", C.sub, { maxLines: 2 })
      ]
    };
  }
}