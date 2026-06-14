/**
 * =========================================
 * 📌 时光倒数 (Countdown) 小组件
 *
 * ✨ 主要功能：
 * • 尺寸适配：支持 Small、Medium、Large 三种组件尺寸，区分紧凑列表与定宽多行列表排版。
 * • 节日计算：内置农历算法数组，支持计算法定节假日、民俗节日、国际节日、金融交割/行权日的倒计时。
 * • 时区基准：采用 UTC+8 固定时区进行绝对时间计算。
 * • 自定义配置：支持通过环境变量设置最多 6 个专属纪念日，支持修改清明节及春/秋假的起始日期。
 * • 排序与显示：支持按倒数天数及分类优先级进行排序，支持指定节日跨分类置顶。
 * • 状态响应：根据工作日、周末、节假日当天状态切换背景渐变色；当天节日提示于中大号标题栏显示，小号于分类行内显示。
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
  bgWorkday:   [{ light: '#FFFFFF', dark: '#1C1C1E' }, { light: '#F2F2F7', dark: '#0C0C0E' }],
  bgWeekend:   [{ light: '#F4F8FF', dark: '#111827' }, { light: '#E6F2FF', dark: '#0B0F19' }],
  bgFest:      [{ light: '#FFFFFF', dark: '#1C1C1E' }, { light: '#F2F2F7', dark: '#0C0C0E' }],
  main:        { light: '#1C1C1E', dark: '#FFFFFF'  }, sub:   { light: '#48484A', dark: '#D1D1D6'  },
  muted:       { light: '#8E8E93', dark: '#8E8E93'  }, gold:  { light: '#B58A28', dark: '#D6A53A'  },
  red:         { light: '#CA3B32', dark: '#FF453A'  }, blue:  { light: '#3A5F85', dark: '#5E8EB8'  },
  blue2:       { light: '#007AFF', dark: '#0A84FF'  }, teal:  { light: '#628C7B', dark: '#73A491'  },
  green:       { light: '#34C759', dark: '#30D158'  }, transparent: '#00000000'
};

const CATEGORY_CONFIG = [
  { key: "legal", label: "法定", icon: "building.columns.fill", color: C.red },
  { key: "folk", label: "民俗", icon: "moon.stars.fill", color: C.gold },
  { key: "intl", label: "国际", icon: "globe.americas.fill", color: C.blue },
  { key: "exclusive", label: "专属", icon: "gift.fill", color: C.teal }
];

const basePriority = { legal: 3, folk: 2, intl: 1, exclusive: 2 };
const specialPriority = { 春节: 10, 国庆节: 9, 交割: 8, 行权: 8, 元旦: 7, 清明节: 7, 端午节: 7, 中秋节: 7, 春假: 6, 秋假: 6, 除夕: 6 };

const mkText = (text, size, weight, color, opts = {}) => ({ type: "text", text: String(text ?? ""), font: { size, weight }, textColor: color, ...opts });
const mkRow = (children, gap = 4, opts = {}) => ({ type: "stack", direction: "row", alignItems: "center", gap, children, ...opts });
const mkIcon   = (src, color, size = 13) => ({ type: "image", src: `sf-symbol:${src}`, color, width: size, height: size });
const mkSpacer = (length) => length != null ? { type: "spacer", length } : { type: "spacer" };

const YMD = (y, m, d) => `${y}/${m < 10 ? "0" + m : m}/${d < 10 ? "0" + d : d}`;
const formatItemStr = (name, diff) => diff <= 0 ? `今日 ${name}` : `${name} ${diff}天`;

const splitTextToLines = (str, maxW) => {
  let lines = [], line = "", w = 0;
  for (const token of (str?.match(/[\d\/a-zA-Z.\-]+|./gu) || [])) {
    const tw = token.length > 1 ? token.length * 1.1 : (token.charCodeAt(0) > 255 ? 2 : 1.1);
    if (w + tw > maxW) { lines.push(line.replace(/^[，\s]+|[，\s]+$/g, "")); line = token; w = tw; } else { line += token; w += tw; }
  }
  if (line) lines.push(line.replace(/^[，\s]+|[，\s]+$/g, ""));
  return lines;
};

const Lunar = {
  info: [0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,0x092e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,0x0d520],
  term(y, n) { return new Date((31556925974.7 * (y - 1900)) + [0,21208,42467,63836,85337,107014,128867,150921,173149,195551,218072,240693,263343,285989,308563,331033,353350,375494,397447,419210,440795,462224,483532,504758][n-1] * 60000 + Date.UTC(1900,0,6,2,5)); },
  lDays(y) {
    let s = 348;
    for (let i = 0x8000; i > 0x8; i >>= 1) s += (this.info[y - 1900] & i) ? 1 : 0;
    return s + ((this.info[y - 1900] & 0xf) ? ((this.info[y - 1900] & 0x10000) ? 30 : 29) : 0);
  },
  mDays(y, m) { return (this.info[y - 1900] & (0x10000 >> m)) ? 30 : 29; }
};

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

export default function (ctx) {
  const env = ctx.env ?? {};

  const getBool = (key, defaultVal = true) => {
    const v = env[key];
    if (v === undefined || v === null || String(v).trim() === "") return defaultVal;
    return String(v).trim().toLowerCase() !== "false";
  };
  
  const enableWeekendTheme = getBool("ENABLE_WEEKEND_THEME", true);
  const family  = (ctx.widgetFamily || "systemMedium").toLowerCase();
  const isSmall = family.includes("small");
  const isLarge = family.includes("large");

  const bjDate = new Date(Date.now() + 8 * 3600000);
  const Y = bjDate.getUTCFullYear(), M = bjDate.getUTCMonth() + 1, D = bjDate.getUTCDate();
  const currentHour = bjDate.getUTCHours(), currentDay = bjDate.getUTCDay();
  const todayMs = Date.UTC(Y, M - 1, D);

  const envFingerprint = Object.keys(env).sort().map(k => `${k}:${env[k]}`).join('|');
  const CACHE_KEY = `countdown_daily_cache`;
  const timePhase = currentHour >= 15 ? 'after3pm' : 'before3pm';
  const todayStr = `${Y}_${M}_${D}_${timePhase}`; 
  
  let cachedData = null;
  if (ctx.storage) {
    try {
      const stored = ctx.storage.getJSON(CACHE_KEY);
      if (stored && stored.date === todayStr && stored.envFingerprint === envFingerprint) {
        cachedData = stored.payload;
      }
    } catch (e) {}
  }

  let result, todayNoticeText, pinnedData, todayItems;

  if (cachedData) {
    ({ result, todayNoticeText, pinnedData, todayItems } = cachedData);
  } else {
    const getStr = (key, defaultVal = "") => String(env[key] ?? defaultVal).trim();
    const showSchoolHolidays    = getBool("SHOW_SCHOOL_HOLIDAYS", true);
    const showFinanceDates      = getBool("SHOW_FINANCE_DATES", true);
    const enablePrioritySort    = getBool("ENABLE_PRIORITY_SORT", true);
    const enableExclusiveWeight = getBool("ENABLE_EXCLUSIVE_WEIGHT", true);
    const springDateStr   = getStr("SPRING_BREAK_DATE");
    const autumnDateStr   = getStr("AUTUMN_BREAK_DATE");
    const qingmingDateStr = getStr("QINGMING_DATE", "");
    const pinnedHolidays = getStr("PINNED_HOLIDAY").split(",").map(s => s.trim()).filter(Boolean);
    const customDays = [1,2,3,4,5,6].map(i => ({
      name: getStr(`EXCLUSIVE_NAME_${i}`, i === 1 ? getStr("EXCLUSIVE_NAME", "我的生日") : ""),
      date: getStr(`EXCLUSIVE_DATE_${i}`, i === 1 ? getStr("EXCLUSIVE_DATE", "11/10") : "")
    })).filter(item => item.name && /^\d{1,2}\/\d{1,2}$/.test(item.date));

    const getFinanceDate = (y, monthIndex, nth, targetDow) => {
      const firstDow = new Date(Date.UTC(y, monthIndex, 1)).getUTCDay();
      return Date.UTC(y, monthIndex, 1 + ((targetDow - firstDow + 7) % 7) + (nth - 1) * 7);
    };

    const nextFinanceDate = (nth, dow) => {
      let d = getFinanceDate(Y, M - 1, nth, dow);
      if (todayMs > d || (todayMs === d && currentHour >= 15)) d = getFinanceDate(M === 12 ? Y + 1 : Y, M === 12 ? 0 : M, nth, dow);
      return d;
    };

    const getCustomDate = (y, dateStr, fallbackFn) => {
      if (!dateStr || typeof dateStr !== 'string') return fallbackFn ? fallbackFn() : null;
      const parts = dateStr.split("/").map(Number);
      if (parts.length !== 2 || !Number.isInteger(parts[0]) || !Number.isInteger(parts[1]) || parts[0] > 12 || parts[1] > 31) {
        return fallbackFn ? fallbackFn() : null;
      }
      return YMD(y, parts[0], parts[1]);
    };

    const l2s = (y, m, d) => {
      ensureLunarCumulative(y + 1);
      let off = (lunarCumulativeCache.off.get(y) ?? 0), lp = Lunar.info[y - 1900] & 0xf;
      for (let i = 1; i < m; i++) off += Lunar.mDays(y, i) + (lp > 0 && i === lp ? (Lunar.info[y - 1900] & 0x10000 ? 30 : 29) : 0);
      const date = new Date(Date.UTC(1900, 0, 31) + (off + d - 1) * 86400000);
      return YMD(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    };

    const getFests = (y) => {
      const term = n => { const bjT = new Date(Lunar.term(y, n).getTime() + 8 * 3600000); return YMD(bjT.getUTCFullYear(), bjT.getUTCMonth() + 1, bjT.getUTCDate()); };
      const wDay = (m, n, w) => { const x = w - new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); return YMD(y, m, 1 + (x < 0 ? x + 7 : x) + (n - 1) * 7); };
      const qmDateStr = getCustomDate(y, qingmingDateStr, () => term(7));
      const legal = [
        ["元旦", YMD(y, 1, 1), 1], ["春节", l2s(y, 1, 1), 3], ["清明节", qmDateStr, 1], ["劳动节", YMD(y, 5, 1), 1], 
        ["端午节", l2s(y, 5, 5), 1], ["中秋节", l2s(y, 8, 15), 1], ["国庆节", YMD(y, 10, 1), 3]
      ];
      if (showSchoolHolidays) {
        const springDate = getCustomDate(y, springDateStr, () => { const [qy, qm, qd] = qmDateStr.split("/").map(Number); const s = new Date(Date.UTC(qy, qm - 1, qd - 3)); return YMD(s.getUTCFullYear(), s.getUTCMonth() + 1, s.getUTCDate()); });
        if (springDate) legal.push(["春假", springDate, 3]);
        const autumnDate = getCustomDate(y, autumnDateStr, () => { const nov1 = new Date(Date.UTC(y, 10, 1)); return YMD(y, 11, 1 + ((3 - nov1.getUTCDay() + 7) % 7) + 7); });
        if (autumnDate) legal.push(["秋假", autumnDate, 3]);
      }
      return {
        legal, exclusive: customDays.map(item => [item.name, getCustomDate(y, item.date), 1, "custom"]),
        folk: [ ["元宵节", l2s(y, 1, 15), 1], ["龙抬头", l2s(y, 2, 2), 1], ["七夕节", l2s(y, 7, 7), 1], ["中元节", l2s(y, 7, 15), 1], ["重阳节", l2s(y, 9, 9), 1], ["寒衣节", l2s(y, 10, 1), 1], ["腊八节", l2s(y, 12, 8), 1], ["小年", l2s(y, 12, 23), 1], ["除夕", l2s(y, 12, Lunar.mDays(y, 12)), 1] ],
        intl: [ ["情人节", YMD(y, 2, 14), 1], ["妇女节", YMD(y, 3, 8), 1], ["母亲节", wDay(5, 2, 0), 1], ["儿童节", YMD(y, 6, 1), 1], ["父亲节", wDay(6, 3, 0), 1], ["万圣节", YMD(y, 10, 31),1], ["感恩节", wDay(11, 4, 4),1], ["平安夜", YMD(y, 12, 24),1], ["圣诞节", YMD(y, 12, 25),1] ]
      };
    };

    const getPriority = (name, cat, sourceKind) => !enablePrioritySort ? 1 : (sourceKind === "custom" ? (enableExclusiveWeight ? 9 : (basePriority[cat] ?? 1)) : (specialPriority[name] ?? basePriority[cat] ?? 1));

    const rawResult = { legal: new Map(), folk: new Map(), intl: new Map(), exclusive: new Map() };
    const todayFests = [], todayFinance = [], pinnedMap = new Map(), processedFests = new Set();
    todayItems = []; 

    for (const y of [Y - 1, Y, Y + 1]) {
      const f = getFests(y);
      for (const cat of Object.keys(rawResult)) {
        const catMap = rawResult[cat];
        for (const [name, dateStr, duration = 1, sourceKind = ""] of f[cat]) {
          if (!dateStr || processedFests.has(name)) continue;

          const [yy, mm, dd] = dateStr.split("/").map(Number);
          const diff = (Date.UTC(yy, mm - 1, dd) - todayMs) / 86400000;

          if (diff <= 0) {
            if (diff > -duration) {
              todayFests.push(name);
              processedFests.add(name);
              todayItems.push({ name, diff, priority: getPriority(name, cat, sourceKind) + 100, cat });
            }
            continue;
          }

          processedFests.add(name);
          if (pinnedHolidays.includes(name) && diff <= 200) {
            if (!pinnedMap.has(name) || diff < pinnedMap.get(name)) pinnedMap.set(name, diff);
          }
          if (!catMap.has(name)) catMap.set(name, { name, diff, priority: getPriority(name, cat, sourceKind), cat });
        }
      }
    }

    if (showFinanceDates) {
      const processFinance = (name, nth, dow) => {
        const diff = (nextFinanceDate(nth, dow) - todayMs) / 86400000;
        if (diff === 0 && currentHour < 15) {
          todayFinance.push(name);
          todayItems.push({ name, diff, priority: getPriority(name, "exclusive") + 100, cat: "exclusive" });
        } else if (diff > 0) rawResult.exclusive.set(name, { name, diff, priority: getPriority(name, "exclusive"), cat: "exclusive" });
      };
      processFinance("交割", 3, 5); processFinance("行权", 4, 3);
    }

    result = {};
    Object.keys(rawResult).forEach(cat => {
      result[cat] = Array.from(rawResult[cat].values())
        .filter(i => !pinnedMap.has(i.name))
        .sort((a, b) => a.diff !== b.diff ? a.diff - b.diff : (enablePrioritySort ? b.priority - a.priority : 0))
        .slice(0, 7);
    });

    const todayNoticeParts = [];
    if (todayFests.length > 0) todayNoticeParts.push(`今日 ${todayFests.slice(0, 2).join("·")}${todayFests.length > 2 ? "…" : ""}`);
    if (todayFinance.length > 0) todayNoticeParts.push(`今日 ${todayFinance.join("·")}`);
    todayNoticeText = todayNoticeParts.join(" ｜ ");

    pinnedData = pinnedHolidays.filter(n => pinnedMap.has(n)).map(n => ({ name: n, diff: pinnedMap.get(n) }));

    if (ctx.storage) {
      try { 
        ctx.storage.setJSON(CACHE_KEY, { 
          date: todayStr, 
          envFingerprint: envFingerprint, 
          payload: { result, todayNoticeText, pinnedData, todayItems } 
        }); 
      } catch (e) {}
    }
  }

  const stickyParts = (pinnedData || []).map(p => `${p.name} ${p.diff}天`);
  const stickyText  = stickyParts.join("·");

  const formatStr = (cat, limit) => (result[cat] || []).slice(0, limit).map(i => formatItemStr(i.name, i.diff)).join("，");

  const themeKey = (todayItems && todayItems.length > 0) ? "fest" : (enableWeekendTheme && (currentDay === 0 || currentDay === 6)) ? "weekend" : "workday";
  const backgroundGradient = { type: "linear", colors: themeKey === "fest" ? C.bgFest : themeKey === "weekend" ? C.bgWeekend : C.bgWorkday, startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } };

  if (isSmall) {
    const smallRows = CATEGORY_CONFIG.map(cfg => {
      const catTodayItems = (todayItems || []).filter(i => i.cat === cfg.key);
      const fests = [...catTodayItems, ...(result[cfg.key] || [])].slice(0, 2);
      if (fests.length === 0) return null;
      return mkRow([
        mkRow([mkSpacer(), mkIcon(cfg.icon, cfg.color, 13), mkSpacer()], 0, { width: 16 }),
        mkText(fests.map(i => formatItemStr(i.name, i.diff)).join("，"), 12, "medium", cfg.color, { flex: 1, maxLines: 1 })
      ], 6);
    }).filter(Boolean);

    return {
      type: "widget", padding: 14, backgroundGradient,
      children: [
        mkRow([
          mkIcon("hourglass", C.main, 16), mkText("时光\n倒数", 14, "heavy", C.main, { maxLines: 2 }), mkSpacer(),
          ...(stickyParts.length > 0 ? [mkText(stickyParts[0], 11, "bold", C.red, { maxLines: 1 })] : [])
        ], 6),
        mkSpacer(10), { type: "stack", direction: "column", gap: 8, flex: 1, children: smallRows }
      ]
    };
  }

  const layoutConfig = { fz: isLarge ? 14 : 13.5, icz: isLarge ? 15 : 13.5, lw: isLarge ? 60 : 52, maxW: isLarge ? 36 : 45, rowGap: isLarge ? 6 : 4, titleFz: isLarge ? 17 : 15, titleIcz: isLarge ? 18 : 16, topFz: isLarge ? 13 : 12.5 };
  
  const gridRows = CATEGORY_CONFIG.flatMap(cfg => {
    const rawText = formatStr(cfg.key, isLarge ? 7 : (cfg.key === "exclusive" ? 6 : 3));
    return rawText ? splitTextToLines(rawText, layoutConfig.maxW).map((lineStr, idx) => ({
      type: "stack", direction: "row", alignItems: "start", gap: layoutConfig.rowGap,
      children: [
        mkRow([ 
          mkRow([mkSpacer(), mkIcon(idx === 0 ? cfg.icon : "circle.fill", idx === 0 ? cfg.color : C.transparent, layoutConfig.icz), mkSpacer()], 0, { width: layoutConfig.titleIcz }), 
          mkText(idx === 0 ? cfg.label : " ", layoutConfig.fz, "heavy", idx === 0 ? cfg.color : C.transparent), 
          mkSpacer() 
        ], 2, { width: layoutConfig.lw }),
        mkText(lineStr, layoutConfig.fz, "medium", cfg.key === "exclusive" && /(交割|行权)/.test(lineStr) ? C.red : C.sub, { flex: 1, maxLines: 1 })
      ]
    })) : [];
  });

  const rightHeaderElements = [];
  if (todayNoticeText) {
    rightHeaderElements.push(mkIcon("sparkles", C.red, layoutConfig.topFz), mkText(todayNoticeText, layoutConfig.topFz, "bold", C.red));
  } else {
    rightHeaderElements.push(mkIcon("tortoise", C.blue2, Math.round(layoutConfig.topFz * 1.5)), mkText(RANDOM_NOTICES[Math.floor(Math.random() * RANDOM_NOTICES.length)], layoutConfig.topFz, "medium", C.green));
  }
  
  if (stickyText) {
    if (rightHeaderElements.length > 0) rightHeaderElements.push(mkText(" ｜ ", layoutConfig.topFz, "bold", C.red));
    rightHeaderElements.push(mkText(stickyText, layoutConfig.topFz, "bold", C.red));
  }

  return {
    type: "widget", padding: isLarge ? 16 : 12, backgroundGradient,
    children: [
      mkRow([ mkIcon("hourglass", C.main, layoutConfig.titleIcz), mkText("时光倒数", layoutConfig.titleFz, "heavy", C.main), mkSpacer(), ...(rightHeaderElements.length > 0 ? [mkRow(rightHeaderElements, 4)] : []) ], 6),
      mkSpacer(gridRows.length <= 4 ? 12 : 10),
      ...(gridRows.length > 0 ? [{ type: "stack", direction: "column", alignItems: "start", gap: gridRows.length <= 4 ? (isLarge ? 14 : 11) : (isLarge ? 10 : 8), children: gridRows }] : [mkText("近期暂无倒计时", layoutConfig.fz, "medium", C.muted)]),
      mkSpacer()
    ]
  };
}