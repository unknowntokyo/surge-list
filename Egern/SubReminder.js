/**
 * =======================================
 * 🔔 订阅提醒（Egern 小组件 + 定时提醒）
 *
 * ✨ 功能：
 * • 适用任何周期性扣费：AI 服务、流媒体、云存储、会员、域名、VPS、机场等。
 * • 小组件：大号数字突出最近一笔续费，其余按剩余天数排序；
 *   支持桌面小/中/大号，以及锁屏圆形、矩形、单行组件。
 * • 提醒：续费前按 REMIND_DAYS 推送通知，同一订阅同一档位只推一次，每个周期自动循环。
 *   同一个脚本既可作 generic（小组件），也可作 schedule（每天定时检查提醒）。
 * • 周期：按月（默认）、每 N 个月、按年、每 N 天；31 号等月末日期自动落到当月最后一天。
 * • 时区：默认按 UTC+8 计算“今天”，可用 TZ_OFFSET 修改。
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
 *    • 周期：可选，默认 1M。写法：1M / 3M / 1Y / 30D（也可写“月”“年”“3个月”“30天”）
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
 * 2. REMIND_DAYS   提前几天提醒，默认 "3,1,0"；空值用默认，非法值报错并回退默认
 *                  漏跑时补当前续费期窗口内最接近的一个档位，不追溯已过期续费
 * 3. NOTIFY        通知全局开关，默认 true；仅无 widgetFamily 的定时/手动运行发送
 * 4. TZ_OFFSET     固定时区偏移（小时），-12～14，默认 8；不自动处理夏令时
 * 5. SHOW_TOTAL    中/大号显示月均支出，默认 true
 *    月均为估算：按天周期以 30 天折算；不同币种不换汇，顺序按 SUB_n
 *    金额支持非负数（含 .99）、规范千分位及前/后缀币种；无法解析或未填的不计入
 *    周期上限：3660D / 120M / 10Y。名称固定为“订阅提醒”。
 *    通知调用与存储没有事务性保证；写入失败后下次运行可能重发。
 *    REMIND_DAYS 只影响通知；小组件中 1 天内标红、3 天内标橙
 * =======================================
 */

// 名称包含关键字即使用对应品牌色；未命中的按名称哈希取色
const BRANDS = [
  [/claude|anthropic/i, "#D97757"],
  [/chatgpt|openai|gpt/i, "#10A37F"],
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
  if (!tokens.length) return [0, 1, 3];
  if (tokens.some(s => !/^\d+$/.test(s) || Number(s) > 60)) {
    errors.push("REMIND_DAYS 有误，已使用 3,1,0");
    return [0, 1, 3];
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
  type: "linear", colors: [{ light: "#FAF9F7", dark: "#1B1D22" }, { light: "#F0F2F6", dark: "#111318" }],
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
const mkTitle = size => mkRow([
  { type: "image", src: "sf-symbol:bell.fill", width: 12, height: 12, color: C.main },
  mkText("订阅提醒", size, "semibold", C.main)
], 4);
const widget = (opts, padding, children, gradient = BG) => ({ type: "widget", padding, refreshAfter: opts.refreshIso, backgroundGradient: gradient, children });
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
  return mkRow([
    mkText(it.diff === 0 ? "今天" : it.diff, it.diff === 0 ? Math.round(size * 0.72) : fitSize, "bold", dayColor(it.diff)),
    ...(it.diff === 0 ? [] : [mkCol([mkText("天", 12, "medium", C.muted)], 0, { padding: [0, 0, 5, 0] })])
  ], 3, { alignItems: "end" });
}
const mkDaysCol = (it, size, width, color = dayColor(it.diff)) => mkRow([
  mkText(dayShort(it.diff), size, "semibold", color, { flex: 1, textAlign: "right" })
], 0, { width });

// 两行列表：名称占独立一行；日期与金额不再挤占名称的宽度。
function mkListRow(it, large, tail = "") {
  return mkRow([
    mkDot(it.color),
    mkCol([
      mkText(it.name, large ? 14 : 13, "medium", C.main),
      mkText(datePrice(it) + tail, 11, "regular", C.muted)
    ], 1, { flex: 1 }),
    mkDaysCol(it, large ? 14 : 13, large ? 42 : 38)
  ], large ? 8 : 7, { height: large ? 33 : 32 });
}
function totalText(opts) {
  if (!opts.showTotal || !opts.totals.length) return "";
  const values = opts.totals;
  const limit = values.slice(0, 2).join(" · ").length > 23 ? 1 : 2;
  return `月均 ${values.slice(0, limit).join(" · ")}${values.length > limit ? ` · 另${values.length - limit}币种` : ""}`;
}
const noteText = (text, color = C.muted) => mkText(text, 11, "medium", color, { flex: 1, textAlign: "right" });

function emptyWidget(opts) {
  return widget(opts, 14, [
    mkTitle(12), mkSpacer(),
    mkText(opts.errors.length ? errorSummary(opts) : "还没有订阅", 15, "semibold", opts.errors.length ? C.red : C.main),
    mkSpacer(4), mkText("在模块中配置 SUB_1～SUB_20", 11, "regular", C.muted, { maxLines: 2 }), mkSpacer()
  ]);
}

// 小号 158×158：无内卡、无进度条；标题计数与下方预告有独立空间。
function renderSmall(items, opts) {
  const hero = items[0], next = items[1];
  const bottom = opts.errors.length ? mkText(errorSummary(opts), 11, "medium", C.red)
    : next ? mkRow([mkDot(next.color), mkText(next.name, 12, "medium", C.main, { flex: 1 }), mkDaysCol(next, 12, 32)], 5)
    : mkText(`每${cycleText(hero.cycle)}续费`, 11, "medium", C.muted);
  return widget(opts, 14, [
    mkRow([mkTitle(12), mkSpacer(), mkText(`共${items.length}项`, 10.5, "medium", C.muted)], 3),
    mkSpacer(4), mkBigDays(hero, 38),
    mkText(hero.name, 15, "semibold", C.main), mkSpacer(2),
    mkText(`${hero.month}月${hero.day}日 · ${hero.price}`, 11, "regular", C.muted),
    mkSpacer(), mkSpacer(8), bottom
  ], { ...BG, colors: [surfaceTint(hero.color, 0.075, 0.09), BG.colors[1]] });
}

// 中号 338×158：全宽顶栏 + 104pt 主卡 + 三个两行项目，无竖分隔线。
function renderMedium(items, opts) {
  const hero = items[0], rest = items.slice(1, 4), hidden = items.length - 1 - rest.length;
  const note = opts.errors.length ? errorSummary(opts) : totalText(opts) || `共${items.length}项`;
  const left = mkCol([
    mkBigDays(hero, 38, true), mkSpacer(1),
    mkText(hero.name, 14, "semibold", C.main), mkSpacer(2),
    mkText(datePrice(hero), 11, "regular", C.muted), mkSpacer(), ...mkProgress(hero)
  ], 0, { width: 104, height: 106, padding: 8, borderRadius: 14, backgroundGradient: cardGradient(hero) });
  const right = mkCol(rest.length ? rest.flatMap((it, i) => [
    ...(i ? [mkSpacer()] : []), mkListRow(it, false, i === rest.length - 1 && hidden > 0 ? ` · 另${hidden}项` : "")
  ]) : [mkSpacer(), mkText("没有其他订阅", 12, "regular", C.muted), mkSpacer()], 0, { flex: 1, height: 106 });
  return widget(opts, 14, [
    mkRow([mkTitle(12), noteText(note, opts.errors.length ? C.red : C.muted)], 8, { height: 16 }),
    mkSpacer(8), mkRow([left, right], 12, { alignItems: "start" })
  ]);
}

// 大号 338×354：72pt 主卡、最多五个后续项目、底部汇总。
function renderLarge(items, opts) {
  const hero = items[0];
  // 未计入说明需要独立页脚行，减少一条列表以维持最小尺寸预算。
  const rest = items.slice(1, opts.omitted ? 5 : 6), hidden = items.length - 1 - rest.length;
  const note = opts.errors.length ? errorSummary(opts) : `7天内${items.filter(it => it.diff <= 7).length}项`;
  const main = mkRow([
    mkCol([mkBigDays(hero, 42, true)], 0, { width: 78 }),
    mkCol([
      mkText(hero.name, 17, "semibold", C.main),
      mkText(datePrice(hero, true), 11.5, "regular", C.muted)
    ], 3, { flex: 1 })
  ], 10);
  const card = mkCol([main, mkSpacer(), ...mkProgress(hero)], 0, {
    height: 72, padding: 10, borderRadius: 16, backgroundGradient: cardGradient(hero)
  });
  const rows = rest.length ? rest.map(it => mkListRow(it, true)) : [mkText("没有其他订阅", 13, "regular", C.muted)];
  const count = `共${items.length}项${hidden ? ` · 另${hidden}项` : ""}`;
  return widget(opts, 16, [
    mkRow([mkTitle(13), noteText(note, opts.errors.length ? C.red : C.muted)], 8, { height: 18 }),
    mkSpacer(8), card, mkSpacer(5), mkSpacer(),
    mkText("接下来", 11.5, "medium", C.muted), mkSpacer(4),
    mkCol(rows.flatMap((row, i) => [...(i && rest.length < 5 ? [mkSpacer(3)] : []), row])),
    mkSpacer(), mkSpacer(8),
    mkRow([mkText(count, 11, "medium", C.muted), noteText(totalText(opts))], 8),
    ...(opts.omitted ? [mkSpacer(2), mkText(`${opts.omitted}项金额未计入月均`, 11, "regular", C.muted)] : [])
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
    mkText(it.name, size, weight, "#FFFFFF", { flex: 1 }), mkDaysCol(it, size, 34, "#FFFFFF")
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
    const opts = {
      showTotal: String(env.SHOW_TOTAL ?? "true").trim().toLowerCase() !== "false",
      totals: monthlyTotals(items), omitted: items.filter(it => !it.amount || it.amount.value == null).length,
      errors, refreshIso: t.refreshIso
    };
    const family = String(ctx.widgetFamily);
    if (family.startsWith("accessory")) return renderAccessory(family, items, opts);
    if (!items.length) return emptyWidget(opts);
    if (family === "systemSmall") return renderSmall(items, opts);
    if (family === "systemMedium") return renderMedium(items, opts);
    return renderLarge(items, opts);
  } catch (e) {
    console.log(`[SubReminder] failed: ${e}`);
    // 此兜底不读取环境、时区或当前日期，入口任意阶段失败仍可返回组件。
    return { type: "widget", padding: 8, children: [mkText("订阅提醒出错", 12, "medium", C.red)] };
  }
}
