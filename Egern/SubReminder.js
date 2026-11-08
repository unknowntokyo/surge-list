/**
 * =======================================
 * 🔔 订阅提醒（Egern 小组件 + 定时提醒）
 *
 * ✨ 功能：
 * • 适用任何周期性扣费：AI 服务、流媒体、云存储、会员、域名、VPS、机场等。
 * • 小组件：大号数字突出最近一笔续费，其余按剩余天数排序；
 *   支持桌面小/中/大号，以及锁屏圆形、矩形、单行组件。
 * • 提醒：默认在续费前一天和当天各推送一次，同一订阅同一档位只推一次；每个周期自动循环。
 *   同一个脚本既可作 generic（小组件），也可作 schedule（每天定时检查提醒）。
 * • 周期：按月（默认）、每 N 个月、按年、每 N 天；31 号等月末日期自动落到当月最后一天。
 * • 时区：默认按 UTC+8 计算"今天"，可用 TZ_OFFSET 修改。
 *
 * ⚙️ 环境变量：
 *
 * 1. SUB_1 ~ SUB_20   订阅条目，格式：名称|日期|金额|周期|颜色
 *    • 名称：如 Claude Pro、Netflix、iCloud+
 *    • 日期：
 *        D           每月第 D 天续费（如 15），只能配合按月周期
 *        YYYY/M/D    保留原扣费日号的锚点；未来日期视为首次扣费日，此前不显示周期进度
 *                    月末/闰日请填原始日号，勿用被钳制的 2/28 代替 1/31 或 2/29
 *                    年份范围 1970–2100
 *    • 金额：可选，原样显示，如 $20、20 USD、¥140（用于计算月均支出，按币种分别合计）
 *    • 周期：可选，默认 1M。写法：1M / 3M / 1Y / 30D（也可写"月""年""3个月""30天"）
 *    • 颜色：可选，#RRGGBB；不填时常见服务用品牌色，其余按名称自动取色
 *    中间字段留空即用默认值，如 "域名|2025/3/8||1Y"
 *
 *    示例：
 *      SUB_1: "Claude Pro|15|$20"
 *      SUB_2: "ChatGPT Plus|2025/6/3|$20|1M"
 *      SUB_3: "Netflix|2025/1/31|$15.49"
 *      SUB_4: "iCloud+|8|¥21"
 *      SUB_5: "域名 example.com|2025/9/10|$12|1Y"
 *      SUB_6: "机场|2026/10/20|¥15|30D|#5856D6"
 *
 * 2. REMIND_DAYS   提前几天提醒，默认 "1,0"（前一天、当天）；空值或非法值回退默认
 *                  漏跑时补当前续费期窗口内最接近的一个档位，不追溯已过期续费
 * 3. NOTIFY        通知全局开关，默认 true；仅无 widgetFamily 的定时/手动运行发送
 * 4. TZ_OFFSET     固定时区偏移（小时），-12～14，默认 8；不自动处理夏令时
 * 5. SHOW_TOTAL    桌面小/中/大号显示月均支出，默认 true
 *    月均为估算：按天周期以 30 天折算；不同币种不换汇，顺序按 SUB_n
 *    金额支持非负数（含 .99）、规范千分位及前/后缀币种；无法解析或未填的不计入
 *    周期上限：3660D / 120M / 10Y。名称固定为"订阅提醒"。
 *    通知调用与存储没有事务性保证；写入失败后下次运行可能重发。
 *    REMIND_DAYS 默认只提醒前一天和当天；小组件中 1 天内标红、3 天内标橙
 * =======================================
 */

// 名称包含关键字即使用对应品牌色；未命中的按名称哈希取色
const BRANDS = [
  [/claude|anthropic|ANT/i, "#D97757"],
  [/chatgpt|openai|gpt|RESIP/i, "#10A37F"],
  [/gemini|google/i, "#4285F4"],
  [/grok|x\.ai|xai/i, "#6E6E73"],
  [/perplexity/i, "#20808D"],
  [/cursor/i, "#5B5BD6"],
  [/copilot|github/i, "#8250DF"],
  [/midjourney/i, "#E4572E"],
  [/deepseek/i, "#4D6BFE"],
  [/kimi|moonshot/i, "#1A73E8"],
  [/^poe\b/i, "#7B61FF"],
  [/netflix/i, "#E50914"],
  [/spotify/i, "#1DB954"],
  [/youtube/i, "#FF0000"],
  [/disney/i, "#113CCF"],
  [/icloud|apple|app store/i, "#0A84FF"],
  [/microsoft|office|365|xbox/i, "#0078D4"],
  [/notion/i, "#6E6E73"],
  [/adobe/i, "#FA0F00"],
  [/1password/i, "#0572EC"],
  [/哔哩|bilibili|b站/i, "#FB7299"],
  [/爱奇艺|iqiyi/i, "#00BE06"],
  [/腾讯|qq|微信/i, "#12B7F5"],
  [/网易云/i, "#C20C0C"],
  [/优酷/i, "#1EBCFF"],
  [/京东/i, "#E1251B"],
  [/淘宝|88vip|天猫/i, "#FF5000"]
];
const FALLBACK_COLORS = ["#FF9500", "#34C759", "#30B0C7", "#AF52DE", "#FF2D55", "#5856D6"];

const C = {
  main: { light: "#20232B", dark: "#F3F4F6" },
  muted: { light: "#626875", dark: "#A4A9B3" },
  red: { light: "#B42318", dark: "#FF8078" },
  orange: { light: "#A94F0A", dark: "#FFBD66" }
};

const DAY_MS = 86400000;
const MAX_SUBS = 20;
const NOTIFY_KEY = "sub_reminder:notified:v2";
const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

// ---------- 基础工具 ----------

const pad2 = n => String(n).padStart(2, "0");
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m 为 1–12
const toMs = (y, m, d) => Date.UTC(y, m - 1, d);
const isoOf = ms => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};

// 从锚点起加 k 个月，日号超出当月时取月末（1/31 → 2/28 → 3/31）
function addMonths(y, m, d, k) {
  const total = y * 12 + (m - 1) + k;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return toMs(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

function today(tzOffsetHours) {
  const local = new Date(Date.now() + tzOffsetHours * 3600000);
  const todayMs = toMs(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate());
  // 下一次刷新：本地次日 00:01
  const refreshMs = todayMs + DAY_MS + 60000 - tzOffsetHours * 3600000;
  return { todayMs, refreshIso: new Date(refreshMs).toISOString() };
}

function hash(str) {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h;
}

function brandColor(name) {
  const hit = BRANDS.find(([re]) => re.test(name));
  return hit ? hit[1] : FALLBACK_COLORS[hash(name) % FALLBACK_COLORS.length];
}

const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

// ---------- 解析配置 ----------

function parseCycle(raw) {
  const s = String(raw || "").trim().toUpperCase().replace("个月", "M").replace("月", "M").replace("年", "Y").replace("天", "D");
  if (!s) return { unit: "M", n: 1 };
  const m = s.match(/^(\d*)\s*([MYD])$/);
  if (!m) return null;
  const n = Number(m[1] || 1);
  const limit = { D: 3660, M: 120, Y: 10 }[m[2]];
  if (!(n >= 1 && n <= limit)) return null;
  return m[2] === "Y" ? { unit: "M", n: n * 12 } : { unit: m[2], n };
}

// 完整匹配：前缀币种 + 非负数字 + 后缀币种；小数点固定为点，不猜测地区格式。
function parseAmount(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  const m = s.match(/^([A-Za-z$¥￥€£₩₽₹元]*)\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)\s*([A-Za-z$¥￥€£₩₽₹元]*)$/);
  const value = m ? Number(m[2].replace(/,/g, "")) : NaN;
  // 同时填写前后缀币种时，只接受相同币种，避免把 "$20 USD" 擅自合并为某币种。
  if (!m || !Number.isFinite(value) || (m[1] && m[3] && m[1] !== m[3])) {
    return { text: s, value: null, cur: "" };
  }
  return { text: s, value, cur: m[1] || m[3] };
}

function parseSubs(env, errors) {
  const subs = [];
  for (let i = 1; i <= MAX_SUBS; i++) {
    const raw = env[`SUB_${i}`];
    if (!raw || !String(raw).trim()) continue;
    const fields = String(raw).split("|").map(s => s.trim());
    const [name, dateRaw, amountRaw, cycleRaw, colorRaw] = fields;
    const cycle = parseCycle(cycleRaw);
    let anchor = null;

    const full = (dateRaw || "").match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    const dayOnly = (dateRaw || "").match(/^(\d{1,2})$/);
    if (full) {
      const [y, m, d] = full.slice(1).map(Number);
      if (y >= 1970 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m)) anchor = { y, m, d };
    } else if (dayOnly && cycle && cycle.unit === "M" && cycle.n === 1) {
      const d = Number(dayOnly[1]);
      if (d >= 1 && d <= 31) anchor = { y: 2000, m: 1, d };
    }

    if (!name || !anchor || !cycle || fields.length > 5) {
      errors.push(`SUB_${i} 格式有误`);
      continue;
    }
    const color = /^#[0-9A-Fa-f]{6}$/.test(colorRaw || "") ? colorRaw.toUpperCase() : brandColor(name);
    subs.push({ id: `SUB_${i}`, slot: i, name, anchor, cycle, amount: parseAmount(amountRaw), color });
  }
  return subs;
}

// ---------- 计算续费日 ----------

function nthRenewal(sub, k) {
  const { y, m, d } = sub.anchor;
  return sub.cycle.unit === "D" ? toMs(y, m, d) + k * sub.cycle.n * DAY_MS : addMonths(y, m, d, k * sub.cycle.n);
}

function cycleText(cycle) {
  if (cycle.unit === "D") return `${cycle.n}天`;
  if (cycle.n === 1) return "月";
  if (cycle.n % 12 === 0) return cycle.n === 12 ? "年" : `${cycle.n / 12}年`;
  return `${cycle.n}个月`;
}

function computeRenewal(sub, todayMs) {
  const anchorMs = toMs(sub.anchor.y, sub.anchor.m, sub.anchor.d);
  // 先估一个接近今天的 k，再前后微调，避免从锚点逐期循环
  const approxDays = sub.cycle.unit === "D" ? sub.cycle.n : sub.cycle.n * 30.44;
  let k = Math.max(0, Math.floor((todayMs - anchorMs) / DAY_MS / approxDays) - 1);
  while (nthRenewal(sub, k) < todayMs) k++;
  while (k > 0 && nthRenewal(sub, k - 1) >= todayMs) k--;

  const nextMs = nthRenewal(sub, k);
  // 首次扣费尚未发生时没有实际周期进度；其余周期始终从原始锚点推算。
  const hasProgress = anchorMs <= todayMs;
  const prevMs = k > 0 ? nthRenewal(sub, k - 1) : nthRenewal(sub, -1);
  const diff = Math.round((nextMs - todayMs) / DAY_MS);
  const span = Math.max(1, Math.round((nextMs - prevMs) / DAY_MS));
  const nd = new Date(nextMs);
  const cyc = cycleText(sub.cycle);
  return {
    ...sub,
    nextIso: isoOf(nextMs),
    month: nd.getUTCMonth() + 1,
    day: nd.getUTCDate(),
    week: `周${WEEK[nd.getUTCDay()]}`,
    diff,
    hasProgress,
    progress: Math.min(1, Math.max(0, 1 - diff / span)),
    price: sub.amount ? sub.amount.value == null ? sub.amount.text : `${sub.amount.text}/${cyc}` : `每${cyc}`
  };
}

function monthlyTotals(items) {
  const totals = new Map();
  for (const it of [...items].sort((a, b) => a.slot - b.slot)) {
    const a = it.amount;
    if (!a || a.value == null) continue;
    const perMonth = it.cycle.unit === "D" ? (a.value * 30) / it.cycle.n : a.value / it.cycle.n;
    totals.set(a.cur, (totals.get(a.cur) || 0) + perMonth);
  }
  return [...totals].map(([cur, v]) => {
    const num = Math.abs(v - Math.round(v)) < 0.005 ? String(Math.round(v)) : v.toFixed(2);
    // 符号类币种放前面（$20），字母代码放后面（20 USD）
    return /^[A-Za-z]+$/.test(cur) ? `${num} ${cur}` : `${cur}${num}`;
  });
}

const dayShort = diff => (diff === 0 ? "今天" : diff === 1 ? "明天" : `${diff}天`);
const whenText = diff => (diff <= 1 ? `${dayShort(diff)}续费` : `${diff}天后续费`);

// ---------- 提醒 ----------

function parseRemindDays(raw, errors) {
  const tokens = String(raw ?? "").trim().split(/[、，,\s]+/).map(s => s.trim()).filter(Boolean);
  if (!tokens.length) return [0, 1];
  if (tokens.some(s => !/^\d+$/.test(s) || Number(s) > 60)) {
    errors.push("REMIND_DAYS 有误，已使用 1,0");
    return [0, 1];
  }
  return [...new Set(tokens.map(Number))].sort((a, b) => a - b);
}

function parseTimezone(raw, errors) {
  const s = String(raw ?? "").trim();
  if (!s) return 8;
  const n = Number(s);
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(s) || !Number.isFinite(n) || n < -12 || n > 14) {
    errors.push("TZ_OFFSET 有误，已使用 UTC+8");
    return 8;
  }
  return n;
}

// 在当前尚未过去的续费期窗口内补最接近的一个档位；跨过续费日后不追溯上一期。
const remindStage = (diff, remindDays) => remindDays.find(n => n >= diff);

function notifyIfNeeded(ctx, items, remindDays, todayMs) {
  if (typeof ctx.notify !== "function" || !ctx.storage) return;
  let state;
  try {
    state = ctx.storage.getJSON(NOTIFY_KEY);
  } catch (e) {
    console.log(`[SubReminder] read notify state failed; skipped: ${e}`);
    return; // 无法读取去重状态时跳过本轮，避免把未知状态当成未提醒。
  }
  let dirty = false;
  if (state == null) state = {};
  else if (typeof state !== "object" || Array.isArray(state) || ![Object.prototype, null].includes(Object.getPrototypeOf(state))) {
    console.log("[SubReminder] invalid notify state; reset");
    state = {};
    dirty = true;
  }
  const todayIso = isoOf(todayMs);
  const active = new Map(items.map(it => [it.id, it.nextIso]));
  for (const key of Object.keys(state)) {
    const m = key.match(/^(SUB_\d+)@(\d{4}-\d{2}-\d{2})@(\d+)$/);
    if (!m || m[2] < todayIso || active.get(m[1]) !== m[2] || Number(m[3]) > 60 || !Number.isFinite(state[key]) || state[key] < 0) {
      delete state[key];
      dirty = true;
    }
  }
  const due = [];
  for (const it of items) {
    const stage = remindStage(it.diff, remindDays);
    if (stage === undefined) continue;
    const key = `${it.id}@${it.nextIso}@${stage}`;
    if (Object.hasOwn(state, key)) continue;
    due.push({ it, key });
  }
  if (due.length) {
    const lines = due.map(({ it }) => {
      const when = it.diff <= 1 ? whenText(it.diff) : `${whenText(it.diff)}（${it.month}/${it.day}）`;
      return `${it.name}${it.amount ? ` ${it.amount.text}` : ""}：${when}`;
    });
    // 调用失败让入口的通知隔离层记录；成功后才更新去重状态，失败可重试。
    ctx.notify({ title: "🔔 订阅提醒", body: lines.join("\n"), sound: true });
    for (const { key } of due) state[key] = Date.now();
    dirty = true;
  }
  if (dirty) ctx.storage.setJSON(NOTIFY_KEY, state);
}

// ---------- 小组件元素 ----------

const mkText = (text, size, weight, color, opts = {}) => ({
  type: "text", text: String(text ?? ""), font: { size, weight }, textColor: color,
  maxLines: 1, minScale: 0.85, ...opts
});
const mkRow = (children, gap = 0, opts = {}) => ({ type: "stack", direction: "row", alignItems: "center", gap, children, ...opts });
const mkCol = (children, gap = 0, opts = {}) => ({ type: "stack", direction: "column", alignItems: "start", gap, children, ...opts });
const mkSpacer = length => length != null ? { type: "spacer", length } : { type: "spacer" };
const BG = {
  type: "linear", colors: [{ light: "#FFFFFF", dark: "#1C1C1E" }, { light: "#F2F2F7", dark: "#0C0C0E" }],
  startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 }
};
const mix = (brand, base, ratio) => {
  const a = hexRgb(brand), b = hexRgb(base);
  return "#" + a.map((v, i) => Math.round(v * ratio + b[i] * (1 - ratio)).toString(16).padStart(2, "0")).join("").toUpperCase();
};
const tinted = (color, lightRatio, darkRatio) => ({ light: mix(color, "#FAF6F2", lightRatio), dark: mix(color, "#1B1D22", darkRatio) });
const luminance = color => hexRgb(color).map(v => v / 255).reduce((sum, v, i) => sum + [0.2126, 0.7152, 0.0722][i] * (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4), 0);
function surfaceTint(color, lightRatio, darkRatio) {
  const result = {};
  for (const [mode, base, ratio] of [["light", "#FAF6F2", lightRatio], ["dark", "#1B1D22", darkRatio]]) {
    const text = luminance(C.muted[mode]);
    let strength = ratio, background = mix(color, base, strength);
    // Netflix等深色和自定义黑/白色不应降低小号次文字的可读性。
    while ((Math.max(text, luminance(background)) + 0.05) / (Math.min(text, luminance(background)) + 0.05) < 4.5 && strength > 0) {
      strength = Math.max(0, strength - 0.01);
      background = mix(color, base, strength);
    }
    result[mode] = background;
  }
  return result;
}
const cardGradient = it => ({ type: "linear", colors: [surfaceTint(it.color, 0.15, 0.17), surfaceTint(it.color, 0.035, 0.055)], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } });
const dayColor = diff => diff <= 1 ? C.red : diff <= 3 ? C.orange : C.main;
const errorSummary = opts => `${opts.errors.length}项配置有误`;
const mkDot = color => ({ type: "stack", width: 5, height: 5, borderRadius: 2.5, backgroundColor: color, children: [] });
function mkTitle(count, opts, small = false, showCount = false) {
  // 总数需要额外空间时先合并币种，不降低缩放下限。
  const monthly = totalText(opts, small || showCount ? 1 : 2);
  // 右上角信息统一不加粗；小号仍用窄体字防止标题行挤压。DIN Condensed 只有粗体，改用 Avenir Next Condensed Medium，
  // 它比 DIN 宽约 14%，小号字号从 11 降到 10，宽度与原版基本持平。
  const font = { size: small ? 10 : 12.5, weight: "medium", ...(small ? { family: "AvenirNextCondensed-Medium" } : {}) };
  const sub = { light: "#48484A", dark: "#D1D1D6" };
  const note = opts.errors.length
    ? [mkText(errorSummary(opts), font.size, "medium", C.red, { font })]
    : monthly ? [
      mkText(monthly, font.size, "medium", { light: "#34C759", dark: "#30D158" }, { font }),
      ...(showCount ? [mkText(`· 共${count}项`, font.size, "medium", sub)] : [])
    ] : [mkText(`共${count}项`, font.size, "medium", sub, { font })];
  return mkRow([
    { type: "image", src: "sf-symbol:bell.circle.fill", width: small ? 14 : 16, height: small ? 14 : 16, color: C.main },
    mkText("订阅提醒", small ? 13.5 : 15, "heavy", C.main), mkSpacer(),
    ...(note.length === 1 ? note : [mkRow(note, 4)])
  ], 6);
}
const widget = (opts, children) => ({ type: "widget", padding: 12, refreshAfter: opts.refreshIso, backgroundGradient: BG, children });
const datePrice = (it, long = false) => `${long ? `${it.month}月${it.day}日 ${it.week}` : `${it.month}/${it.day}`} · ${it.price}`;

// 主卡中最多一条细进度条；首期锚点在未来时不产生进度节点。
function mkProgress(it) {
  if (!it.hasProgress) return [];
  const p = Math.round(it.progress * 100);
  const bar = (flex, color) => ({ type: "stack", direction: "row", flex, height: 3, borderRadius: 1.5, backgroundColor: color, children: [] });
  const fill = tinted(it.color, 0.78, 0.85), track = tinted(it.color, 0.22, 0.30);
  return [mkRow(p <= 0 ? [bar(1, track)] : p >= 100 ? [bar(1, fill)] : [bar(p, fill), bar(100 - p, track)], 0, { height: 3 })];
}
function mkBigDays(it, size, compact = false) {
  const digits = String(it.diff).length;
  const fitSize = digits <= 2 ? size : Math.min(size, compact ? ({ 3: 29, 4: 24 }[digits] || 20) : 32);
  const digitSize = it.diff === 0 ? Math.round(size * 0.72) : fitSize;
  return mkRow([
    mkText(it.diff === 0 ? "今天" : it.diff, digitSize, "bold", dayColor(it.diff)),
    ...(it.diff === 0 ? [] : [mkCol([mkText("天", 12, "medium", C.muted)], 0, { padding: [0, 0, Math.round(digitSize * 0.24 - 2), 0] })])
  ], 3, { alignItems: "end" });
}
const mkDaysCol = (it, size, width, color = dayColor(it.diff)) => mkRow([
  mkSpacer(), mkText(dayShort(it.diff), size, "semibold", color)
], 0, { width });

// 三列由原生布局按各列内容决定宽度；等权空白吸收组件的实际剩余宽度。
// 天数与价格列右对齐，整列的行高一致，不再估算字宽或假定组件总宽为338。
function mkList(items, large = false) {
  const rowHeight = large ? 30 : 26;
  const height = items.length * rowHeight;
  const column = (makeCell, alignItems) => mkCol(items.map(makeCell), 0, { alignItems, height });
  const cell = text => mkRow([text], 0, { height: rowHeight });
  const equalSpace = () => ({ type: "spacer", flex: 1 });
  return mkRow([
    column(it => mkRow([mkDot(it.color), mkSpacer(7), mkText(it.name, 13, "medium", C.main)], 0, { height: rowHeight }), "start"),
    equalSpace(),
    column(it => cell(mkText(dayShort(it.diff), 13, "semibold", dayColor(it.diff), { textAlign: "right" })), "end"),
    equalSpace(),
    column(it => cell(mkText(it.price, 12, "regular", C.muted, { textAlign: "right" })), "end")
  ], 0, { height: large ? height : 104, alignItems: "start", flex: 1 });
}
function totalText(opts, maxCurrencies = 2) {
  if (!opts.showTotal || !opts.totals.length) return "";
  const values = opts.totals;
  const limit = maxCurrencies === 1 || values.slice(0, 2).join(" · ").length > 23 ? 1 : 2;
  return `月均 ${values.slice(0, limit).join(" · ")}${values.length > limit ? ` +${values.length - limit}` : ""}`;
}

function emptyWidget(opts, small) {
  return widget(opts, [
    mkTitle(0, opts, small), mkSpacer(12), mkSpacer(),
    mkRow([mkText(opts.errors.length ? errorSummary(opts) : "还没有订阅", 15, "semibold", opts.errors.length ? C.red : C.main), mkSpacer()]),
    mkSpacer(4), mkRow([mkText("在模块中配置 SUB_1～SUB_20", 11, "regular", C.muted, { maxLines: 2 }), mkSpacer()]), mkSpacer()
  ]);
}

// 小号 158×158：无内卡、无进度条；主内容和底部预告均沿根内边距起排。
function renderSmall(items, opts) {
  const hero = items[0], next = items[1];
  const bottom = opts.errors.length ? mkRow([mkText(errorSummary(opts), 11, "medium", C.red), mkSpacer()])
    : next ? mkRow([mkDot(next.color), mkText(next.name, 12, "medium", C.main), mkSpacer(), mkDaysCol(next, 12, 32)], 5)
    : mkRow([mkText(`每${cycleText(hero.cycle)}续费`, 11, "medium", C.muted), mkSpacer()]);
  return widget(opts, [
    mkTitle(items.length, opts, true), mkSpacer(12), mkRow([mkBigDays(hero, 38), mkSpacer()]),
    mkRow([mkText(hero.name, 15, "semibold", C.main), mkSpacer()]), mkSpacer(2),
    mkRow([mkText(`${hero.month}月${hero.day}日 · ${hero.price}`, 11, "regular", C.muted), mkSpacer()]),
    mkSpacer(), mkSpacer(8), bottom
  ]);
}

// 中号主卡固定为104×104；每行都有明确行高，剩余空间不再混用多层弹性空白。
// 数字收至32号，保留主次层级并为相邻内容留白。间隔考虑系统字体行框内的留白，
// 目标是普通两位以内天数时视觉间隔接近一致；字形或缩放改变时不承诺像素级等距。
function renderMedium(items, opts) {
  const hero = items[0], rest = items.slice(1, 5);
  const progress = mkProgress(hero).map(node => ({ ...node, width: 88 }));
  const hasBar = progress.length > 0;
  const line = (content, height) => mkRow([content], 0, { height });
  const left = mkCol([
    mkSpacer(hasBar ? 3.5 : 7.5),
    line(mkBigDays(hero, 32, true), 39),
    ...(hasBar ? [] : [mkSpacer(3)]),
    line(mkText(hero.name, 14, "semibold", C.main, { textAlign: "center" }), 18),
    mkSpacer(hasBar ? 5 : 9),
    line(mkText(datePrice(hero), 11, "regular", C.muted, { textAlign: "center" }), 14),
    mkSpacer(hasBar ? 10 : 13.5),
    ...progress,
    ...(hasBar ? [mkSpacer(11.5)] : [])
  ], 0, {
    width: 104, height: 104, alignItems: "center", padding: [0, 8, 0, 8], borderRadius: 14, backgroundGradient: cardGradient(hero)
  });
  const right = rest.length ? mkList(rest) : mkRow([mkText("没有其他订阅", 12, "regular", C.muted), mkSpacer()], 0, { flex: 1, height: 104 });
  return widget(opts, [
    mkTitle(items.length, opts, false, true), mkSpacer(12), mkRow([left, right], 20, { alignItems: "start" })
  ]);
}

// 大号 338×354：330pt内容预算，标题约18pt + 12 + 72 + 14 + 7×30 = 326pt。
function renderLarge(items, opts) {
  const hero = items[0];
  // 未计入说明约13.2pt，改用六行后仍有约20.8pt底部弹性空间。
  const rest = items.slice(1, opts.omitted ? 7 : 8);
  const main = mkRow([
    mkBigDays(hero, 42, true),
    mkCol([
      mkRow([mkText(hero.name, 17, "semibold", C.main), mkSpacer()]),
      mkRow([mkText(datePrice(hero, true), 11.5, "regular", C.muted), mkSpacer()])
    ], 3, { flex: 1 })
  ], 10, { alignItems: "center" });
  const card = mkCol([main, mkSpacer(), ...mkProgress(hero)], 0, {
    height: 72, padding: 10, borderRadius: 16, backgroundGradient: cardGradient(hero)
  });
  const list = rest.length ? mkRow([mkList(rest, true)], 0, { alignItems: "start" }) : mkRow([mkText("没有其他订阅", 13, "regular", C.muted), mkSpacer()]);
  return widget(opts, [
    mkTitle(items.length, opts, false, true), mkSpacer(12), card, mkSpacer(14),
    list, mkSpacer(),
    ...(opts.omitted ? [mkRow([mkText(`${opts.omitted}项金额未计入月均`, 11, "regular", C.muted), mkSpacer()])] : [])
  ]);
}

function renderAccessory(family, items, opts) {
  const base = children => ({ type: "widget", refreshAfter: opts.refreshIso, children });
  const first = items[0], error = opts.errors.length ? errorSummary(opts) : "";
  if (!first) return base([mkText(error || "无订阅", 12, "medium", "#FFFFFF")]);
  if (family === "accessoryInline") {
    return base([mkText(error ? `${error} · ${first.name}` : `${first.name} · ${whenText(first.diff)}`, 12, "medium", "#FFFFFF")]);
  }
  if (family === "accessoryCircular") {
    // 错误优先占据名称行；单色锁屏保留圆环轨道，未来首期不绘制进度弧。
    const name = error ? `${opts.errors.length}项配置有误` : Array.from(first.name).slice(0, 5).join("");
    return base([mkRow([mkSpacer(), mkCol([
      mkSpacer(),
      mkRow([
        mkText(first.diff === 0 ? "今天" : first.diff, first.diff === 0 ? 17 : String(first.diff).length > 4 ? 13.5 : String(first.diff).length > 3 ? 16 : 22, "bold", "#FFFFFF"),
        ...(first.diff === 0 ? [] : [mkText("天", 8.5, "medium", "#FFFFFFCC")])
      ], 2, { alignItems: "end" }),
      mkText(name, 9, "medium", "#FFFFFFCC", { textAlign: "center" }), mkSpacer()
    ], 1, { width: 64, height: 64, alignItems: "center", padding: [0, 6], backgroundImage: ringSrc(first.hasProgress ? first.progress : null) }), mkSpacer()])]);
  }
  const row = (it, size, weight) => mkRow([
    mkText(it.name, size, weight, "#FFFFFF", { flex: 1 }),
    mkRow([mkText(dayShort(it.diff), size, "semibold", "#FFFFFF", { flex: 1, textAlign: "right" })], 0, { width: 34 })
  ], 4);
  return base([
    row(first, 13.5, "semibold"), mkSpacer(1),
    mkText(error || datePrice(first), 10.5, "regular", "#FFFFFFCC"), mkSpacer(2),
    ...(items[1] ? [row(items[1], 12, "medium")] : [])
  ]);
}

function ringSrc(progress) {
  const stroke = 4.7, radius = 50 - stroke / 2 - 0.5, length = 2 * Math.PI * radius;
  const arc = progress == null ? "" : `<circle cx='50' cy='50' r='${radius}' fill='none' stroke='white' stroke-width='${stroke}' stroke-linecap='round' stroke-dasharray='${(length * Math.max(0.015, progress)).toFixed(1)} ${length.toFixed(1)}' transform='rotate(-90 50 50)'/>`;
  return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='${radius}' fill='none' stroke='white' stroke-opacity='0.20' stroke-width='${stroke}'/>${arc}</svg>`;
}

// ---------- 入口 ----------

export default async function (ctx = {}) {
  try {
    const env = ctx.env || {}, errors = [];
    const tz = parseTimezone(env.TZ_OFFSET, errors);
    const t = today(tz), remindDays = parseRemindDays(env.REMIND_DAYS, errors);
    const items = parseSubs(env, errors).map(sub => computeRenewal(sub, t.todayMs)).sort((a, b) => a.diff - b.diff || a.slot - b.slot);
    if (errors.length) console.log(`[SubReminder] ${errors.join("；")}`);
    // NOTIFY 只是全局开关。任何带 widgetFamily 的入口都只负责渲染。
    if (!ctx.widgetFamily && String(env.NOTIFY ?? "true").trim().toLowerCase() !== "false") {
      try {
        notifyIfNeeded(ctx, items, remindDays, t.todayMs);
      } catch (e) {
        console.log(`[SubReminder] notification phase failed: ${e}`);
      }
    }
    if (!ctx.widgetFamily) return;
    const showTotal = String(env.SHOW_TOTAL ?? "true").trim().toLowerCase() !== "false";
    const totals = monthlyTotals(items);
    const opts = {
      showTotal, totals,
      // 只有标题实际显示月均时（无配置错误且有月均），"未计入月均"的说明才有意义，否则不占大号列表的行位。
      omitted: !errors.length && showTotal && totals.length ? items.filter(it => !it.amount || it.amount.value == null).length : 0,
      errors, refreshIso: t.refreshIso
    };
    const family = String(ctx.widgetFamily);
    if (family.startsWith("accessory")) return renderAccessory(family, items, opts);
    if (!items.length) return emptyWidget(opts, family === "systemSmall");
    if (family === "systemSmall") return renderSmall(items, opts);
    if (family === "systemMedium") return renderMedium(items, opts);
    return renderLarge(items, opts);
  } catch (e) {
    console.log(`[SubReminder] failed: ${e}`);
    // 此兜底不读取环境、时区或当前日期，入口任意阶段失败仍可返回组件。
    return { type: "widget", padding: 8, children: [mkText("订阅提醒出错", 12, "medium", C.red)] };
  }
}