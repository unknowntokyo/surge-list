/**
 * ─────────────────────────────────────────────────────────────────
 * 以下为面板核心 JavaScript 脚本逻辑（仅保留法定节假日）
 * ─────────────────────────────────────────────────────────────────
 */

// ── 静态常量（农历基础算法） ─────────────────────────────────────────────
const Lunar = {
  info: [0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,0x092e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,0x0d520],
  term(y, n) {
    return new Date((31556925974.7 * (y - 1900)) + [0,21208,42467,63836,85337,107014,128867,150921,173149,195551,218072,240693,263343,285989,308563,331033,353350,375494,397447,419210,440795,462224,483532,504758][n-1] * 60000 + Date.UTC(1900,0,6,2,5));
  },
  lDays(y) {
    let s = 348;
    for (let i = 0x8000; i > 0x8; i >>= 1) s += (this.info[y - 1900] & i) ? 1 : 0;
    return s + ((this.info[y - 1900] & 0xf) ? ((this.info[y - 1900] & 0x10000) ? 30 : 29) : 0);
  },
  mDays(y, m) { return (this.info[y - 1900] & (0x10000 >> m)) ? 30 : 29; }
};

// ── 累计天数预计算缓存 ───────────────────────────────────────────────────
let lunarCumulativeCache = null;
function ensureLunarCumulative(maxYear) {
  if (lunarCumulativeCache && lunarCumulativeCache.maxYear >= maxYear) return;
  lunarCumulativeCache = { maxYear, off: new Map() };
  let off = 0;
  for (let i = 1900; i <= maxYear; i++) {
    lunarCumulativeCache.off.set(i, off);
    off += Lunar.lDays(i);
  }
}

// ── Surge 环境变量解析 ($argument) ──────────────────────────────────────
const env = {};
if (typeof $argument !== "undefined" && $argument) {
  $argument.split("&").forEach(item => {
    const eqIdx = item.indexOf("=");
    if (eqIdx !== -1) {
      env[item.substring(0, eqIdx).trim()] = item.substring(eqIdx + 1).trim();
    } else {
      env[item.trim()] = "true";
    }
  });
}

const getBool = (key, defaultVal = true) => {
  const v = env[key];
  if (v === undefined || v === null || String(v).trim() === "") return defaultVal;
  return String(v).trim().toLowerCase() !== "false";
};
const getStr = (key, defaultVal = "") => String(env[key] ?? defaultVal).trim();

const enablePrioritySort = getBool("ENABLE_PRIORITY_SORT", true);
const enableWeekendTheme = getBool("ENABLE_WEEKEND_THEME", true);
const qingmingDateStr    = getStr("QINGMING_DATE", "4/4");
const pinnedHolidays     = getStr("PINNED_HOLIDAY").split(",").map(s => s.trim()).filter(Boolean);

// ── 绝对时区计算 (UTC+8) ─────────────────────────────────────────────────
const bjDate = new Date(Date.now() + 8 * 3600000);
const Y = bjDate.getUTCFullYear();
const M = bjDate.getUTCMonth() + 1;
const D = bjDate.getUTCDate();
const currentDay  = bjDate.getUTCDay();
const todayMs = Date.UTC(Y, M - 1, D);

const YMD = (y, m, d) => `${y}/${m < 10 ? "0" + m : m}/${d < 10 ? "0" + d : d}`;
const formatItemStr = (name, diff) => diff <= 0 ? `今日 ${name}` : `${name} ${diff}天`;

const getCustomDate = (y, dateStr, fallbackFn) => {
  if (!dateStr || typeof dateStr !== 'string') return fallbackFn ? fallbackFn() : null;
  const parts = dateStr.split("/");
  if (parts.length !== 2) return fallbackFn ? fallbackFn() : null;
  const m = Number(parts[0]), d = Number(parts[1]);
  if (!m || !d || m > 12 || d > 31) return fallbackFn ? fallbackFn() : null;
  return YMD(y, m, d);
};

const l2s = (y, m, d) => {
  ensureLunarCumulative(y + 1);
  let off = (lunarCumulativeCache.off.get(y) ?? 0);
  const lp = Lunar.info[y - 1900] & 0xf;
  for (let i = 1; i < m; i++) {
    off += Lunar.mDays(y, i);
    if (lp > 0 && i === lp) off += (Lunar.info[y - 1900] & 0x10000) ? 30 : 29;
  }
  const date = new Date(Date.UTC(1900, 0, 31) + (off + d - 1) * 86400000);
  return YMD(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
};

const getFests = (y) => {
  const term = n => {
    const t = Lunar.term(y, n);
    const bjT = new Date(t.getTime() + 8 * 3600000);
    return YMD(bjT.getUTCFullYear(), bjT.getUTCMonth() + 1, bjT.getUTCDate());
  };

  const qmDateStr = getCustomDate(y, qingmingDateStr, () => term(7));

  return [
    ["元旦",   YMD(y, 1, 1),  1], ["春节",   l2s(y, 1, 1),  3],
    ["清明节", qmDateStr,     1],
    ["劳动节", YMD(y, 5, 1),  1], ["端午节", l2s(y, 5, 5),  1],
    ["中秋节", l2s(y, 8, 15), 1], ["国庆节", YMD(y, 10, 1), 3]
  ];
};

const festCache = new Map();
const getFestsCached = (y) => {
  if (!festCache.has(y)) festCache.set(y, getFests(y));
  return festCache.get(y);
};

// ── 优先级运算系统 ───────────────────────────────────────────────────────
const specialPriority = { 春节: 10, 国庆节: 9, 元旦: 7, 清明节: 7, 端午节: 7, 中秋节: 7 };
const getPriority = (name) => {
  if (!enablePrioritySort) return 1;
  return specialPriority[name] !== undefined ? specialPriority[name] : 1;
};

// ── 核心数据运算 ────────────────────────────────────────────────────────
const legalMap = new Map();
const todayFests = new Set(), pinnedMap = new Map();

for (const y of [Y, Y + 1]) {
  const legalList = getFestsCached(y);
  for (const item of legalList) {
    const [name, dateStr, duration = 1] = item;
    if (!dateStr) continue;
    const [yy, mm, dd] = dateStr.split("/").map(Number);
    const diff = Math.floor((Date.UTC(yy, mm - 1, dd) - todayMs) / 86400000);

    if (diff <= 0) {
      if (diff > -duration) {
        todayFests.add(name);
      }
      continue;
    }

    if (pinnedHolidays.includes(name) && diff <= 200) {
      if (!pinnedMap.has(name) || diff < pinnedMap.get(name)) pinnedMap.set(name, diff);
    }

    if (!legalMap.has(name)) {
      legalMap.set(name, { name, diff, priority: getPriority(name) });
    }
  }
}

const sortedList = Array.from(legalMap.values())
  .filter(i => !pinnedMap.has(i.name))
  .sort((a, b) => {
    if (a.diff !== b.diff) return a.diff - b.diff;
    return enablePrioritySort ? b.priority - a.priority : 0;
  });

// 节假日单行适配最大展示个数（目前只剩法定节假日，推荐展示前 5-6 个）
const maxDisplayLimit = 6;
const rawText = sortedList.slice(0, maxDisplayLimit).map(i => formatItemStr(i.name, i.diff)).join("，");

// ── 随机标题抽取 ────────────────────────────────────────────────────────
const titles = [
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
  "今天的目标是先活下去",
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
const randomTitleText = titles[Math.floor(Math.random() * titles.length)].trim();

// ── 实时通知与置顶数据处理 ─────────────────────────────────────────────────
const todayNoticeParts = [];
if (todayFests.size > 0) todayNoticeParts.push(`今日 ${Array.from(todayFests).slice(0, 2).join("·")}${todayFests.size > 2 ? "…" : ""}`);
const todayNoticeText = todayNoticeParts.join(" ｜ ");

const stickyParts = pinnedHolidays.filter(n => pinnedMap.has(n)).map(n => `${n} ${pinnedMap.get(n)}天`);
const stickyText  = stickyParts.length > 0 ? `${stickyParts.join("·")}` : "";

const themeKey = (todayFests.size > 0) ? "fest"
  : (enableWeekendTheme && (currentDay === 0 || currentDay === 6)) ? "weekend" : "workday";

// 状态图标颜色自适应
let iconColor = "#8E8E93"; 
if (themeKey === "fest") iconColor = "#FF453A";
else if (themeKey === "weekend") iconColor = "#007AFF";

// ── Surge Panel 纯文本排版构建 ──────────────────────────────────────────
let panelContentLines = [];

// 将今日提醒和置顶放置在顶部
let noticeHeaderParts = [];
if (todayNoticeText) noticeHeaderParts.push(`今日提醒：${todayNoticeText}`);
if (stickyText) noticeHeaderParts.push(`置顶关注：${stickyText}`);

if (noticeHeaderParts.length > 0) {
  panelContentLines.push(noticeHeaderParts.join(" ｜ "));
  panelContentLines.push(""); // 换行
}

if (rawText) {
  panelContentLines.push(`放假倒计时：${rawText}`);
} else {
  panelContentLines.push("近期暂无放假安排");
}

// ── 结束脚本并将数据传递给 Surge Panel ──────────────────────────────────
$done({
  title: randomTitleText,
  content: panelContentLines.join("\n"),
  icon: "hourglass.circle.fill",
  "icon-color": iconColor
});