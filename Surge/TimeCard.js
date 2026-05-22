const WEIGHTS = { 春节: 10, 国庆: 9, 五一: 9, 元旦: 7, 清明: 7, 端午: 7, 中秋: 7, Ann: 5, 老婆🎂: 5, D.O.B: 5 };
const TITLES = [
  "距离放假，还要摸鱼多少天？", "坚持住，就快放假啦！", "上班好累呀，下顿吃啥？",
  "努力，我还能加班24小时！", "躺平中，等放假", "施主请回，此饼不吃",
  "只有摸鱼才是赚老板的钱", "小乌龟慢慢爬", "加油，明天会更好！",
  "生活本该如此轻松", "好累，但还能坚持一会儿", "快放假啦，期待放松的时光",
  "今天的目标是先活下去", "给自己加个鸡腿！", "佛系上班，一切随缘",
  "我的理想是：不上班还有钱", "放弃幻想，认清现状，低调搬砖", "生活碎片，拼凑成诗",
  "慢慢走，沿途的花都开了", "没什么期待，也就没什么失望", "所谓的成长，就是学会不抱希望",
  "今天的任务是：不干活！", "用力生活，用力摸鱼"
];

const Lunar = {
  info: [0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,0x092e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,0x0d520],
  getQingMingMs(y) { 
    const t = (31556925974.7 * (y - 1900)) + 107014 * 60000 + Date.UTC(1900,0,6,2,5);
    const bjStr = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date(t));
    const [yr, mo, dy] = bjStr.split(/\D+/).filter(Boolean).map(Number);
    return Date.UTC(yr, mo - 1, dy);
  },
  lDays(y) { let s = 348; for (let i = 0x8000; i > 0x8; i >>= 1) s += (this.info[y - 1900] & i) ? 1 : 0; return s + ((this.info[y - 1900] & 0xf) ? ((this.info[y - 1900] & 0x10000) ? 30 : 29) : 0); }
};

const _lunarOffsets = [];
(() => {
  let acc = 0;
  for (let i = 1900; i <= 2100; i++) {
    _lunarOffsets[i] = acc;
    acc += Lunar.lDays(i);
  }
})();

const bjTodayStr = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date());
const [Y, currentMonth, currentDay] = bjTodayStr.split(/\D+/).filter(Boolean).map(Number);
const todayMs = Date.UTC(Y, currentMonth - 1, currentDay);

const l2sMs = (y, m, d) => {
  let off = _lunarOffsets[y] || 0;
  const info = Lunar.info[y - 1900], lp = info & 0xf;
  for (let i = 1; i < m; i++) { 
    off += (info & (0x10000 >> i)) ? 30 : 29; 
  }
  if (lp > 0 && m > lp) {
    off += (info & 0x10000) ? 30 : 29;
  }
  return Date.UTC(1900, 0, 31) + (off + d - 1) * 86400000;
};

const list = [], today = [];

for (let y = Y - 1; y <= Y + 1; y++) {
  const fests = [
    ["元旦", Date.UTC(y, 0, 1), 1], 
    ["春节", l2sMs(y, 1, 1), 3], 
    ["清明", Lunar.getQingMingMs(y), 1], 
    ["五一", Date.UTC(y, 4, 1), 1],
    ["老婆🎂", Date.UTC(y, 4, 12), 0], 
    ["端午", l2sMs(y, 5, 5), 1], 
    ["中秋", l2sMs(y, 8, 15), 1],
    ["国庆", Date.UTC(y, 9, 1), 3], 
    ["Ann", Date.UTC(y, 9, 4), 0],   
    ["D.O.B", l2sMs(y, 12, 3), 0]   
  ];
  for (const [n, ms, dur] of fests) {
    const diff = Math.round((ms - todayMs) / 86400000);
    
    if (diff > 365 || diff < -3) continue;

    if (diff <= 0) {
      if (diff > -dur || (dur === 0 && diff === 0)) today.push(n);
    } else if (!list.some(i => i.n === n)) {
      list.push({ n, diff, dur, p: WEIGHTS[n] || 1 });
    }
  }
}

const countdown = list.sort((a, b) => a.diff - b.diff || b.p - a.p)
  .slice(0, 3)
  .map(i => i.dur === 0 ? `${i.n}倒计时${i.diff}天` : `${i.n} ${i.diff}天`)
  .join("，");

const currentDayOfWeek = new Date(Date.now() + 28800000).getUTCDay();

$done({
  title: TITLES[Math.floor(Math.random() * TITLES.length)],
  content: (today.length ? `🎉今天是：${today.join("·")}\n` : "") + (countdown ? `${countdown}` : ""),
  icon: "hourglass.circle.fill",
  "icon-color": today.length ? "#FF3B30" : (currentDayOfWeek % 6 === 0 ? "#34C759" : "#8E8E93")
});