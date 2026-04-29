/**
 * @file Countdown for Surge Panel (Optimized)
 * @description 彻底移除金融/学校代码，优化时区逻辑与内存分配。
 */

// --- 核心算法：农历数据表 (已校验 Hex 完整性) ---
const LUNAR_DATA = [
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
];

// --- 时间工具类 (针对 Surge 环境优化) ---
const DateHandler = {
    getNowBJ() {
        // 使用内置 offset 逻辑，确保在全球任何服务器/设备下都锁定北京时间
        const d = new Date();
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() + offset + 28800000);
    },
    toUTC(y, m, d) { return Date.UTC(y, m - 1, d); },
    diffDays(targetMs, nowMs) {
        return Math.ceil((targetMs - nowMs) / 86400000);
    }
};

const LunarCalc = {
    mDays(y, m) { return (LUNAR_DATA[y - 1900] & (0x10000 >> m)) ? 30 : 29; },
    lDays(y) {
        let s = 348;
        for (let i = 0x8000; i > 0x8; i >>= 1) s += (LUNAR_DATA[y - 1900] & i) ? 1 : 0;
        const leap = LUNAR_DATA[y - 1900] & 0xf;
        if (leap > 0) s += (LUNAR_DATA[y - 1900] & 0x10000) ? 30 : 29;
        return s;
    },
    // 将农历日期转为公历纪年
    lunarToSolar(y, m, d) {
        let offset = 0;
        for (let i = 1900; i < y; i++) offset += this.lDays(i);
        const leapMonth = LUNAR_DATA[y - 1900] & 0xf;
        for (let i = 1; i < m; i++) {
            offset += this.mDays(y, i);
            if (i === leapMonth) offset += (LUNAR_DATA[y - 1900] & 0x10000) ? 30 : 29;
        }
        const baseDate = new Date(Date.UTC(1900, 0, 31));
        const targetDate = new Date(baseDate.getTime() + (offset + d - 1) * 86400000);
        return { y: targetDate.getUTCFullYear(), m: targetDate.getUTCMonth() + 1, d: targetDate.getUTCDate() };
    },
    // 二十四节气简单近似 (清明专用)
    getQingMing(y) {
        const d = new Date((31556925974.7 * (y - 1900)) + 42467 * 60000 + Date.UTC(1900, 0, 6, 2, 5));
        return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
    }
};

// --- 主函数 ---
(function() {
    const nowBJ = DateHandler.getNowBJ();
    const currentY = nowBJ.getFullYear();
    const nowMs = Date.UTC(currentY, nowBJ.getMonth(), nowBJ.getDate());

    const holidayPresets = [
        { n: "元旦", m: 1, d: 1, type: 'solar' },
        { n: "春节", m: 1, d: 1, type: 'lunar' },
        { n: "清明", type: 'special', func: (y) => LunarCalc.getQingMing(y) },
        { n: "劳动节", m: 5, d: 1, type: 'solar' },
        { n: "端午", m: 5, d: 5, type: 'lunar' },
        { n: "中秋", m: 8, d: 15, type: 'lunar' },
        { n: "国庆", m: 10, d: 1, type: 'solar' },
        { n: "元宵", m: 1, d: 15, type: 'lunar' },
        { n: "除夕", m: 12, d: 0, type: 'lunar_end' }, // 特殊处理：腊月最后一天
        { n: "情人节", m: 2, d: 14, type: 'solar' },
        { n: "圣诞", m: 12, d: 25, type: 'solar' }
    ];

    let results = [];

    [currentY, currentY + 1].forEach(year => {
        holidayPresets.forEach(h => {
            let target;
            if (h.type === 'solar') target = { y: year, m: h.m, d: h.d };
            else if (h.type === 'lunar') target = LunarCalc.lunarToSolar(year, h.m, h.d);
            else if (h.type === 'lunar_end') target = LunarCalc.lunarToSolar(year, 12, LunarCalc.mDays(year, 12));
            else if (h.type === 'special') target = h.func(year);

            const targetMs = DateHandler.toUTC(target.y, target.m, target.d);
            const diff = DateHandler.diffDays(targetMs, nowMs);
            
            if (diff >= 0) results.push({ name: h.n, diff });
        });
    });

    // 排序并去重
    results.sort((a, b) => a.diff - b.diff);
    const finalItems = Array.from(new Set(results.map(r => r.name)))
        .map(name => results.find(r => r.name === name))
        .slice(0, 6);

    // 构建 UI
    const content = finalItems.map(item => {
        const icon = item.diff === 0 ? "🏮" : "⏳";
        const val = item.diff === 0 ? "今日" : `${item.diff}天`;
        return `${icon} ${item.name.padEnd(4, ' ')}: ${val}`;
    }).join("\n");

    const isToday = finalItems[0]?.diff === 0;
    
    $done({
        title: isToday ? `🎉 今日节日: ${finalItems[0].name}` : "⏳ 倒计时 (Countdown)",
        content: content || "近期暂无节日",
        icon: isToday ? "calendar.badge.exclamationmark" : "hourglass.circle.fill",
        "icon-color": isToday ? "#FF3B30" : "#007AFF"
    });
})();