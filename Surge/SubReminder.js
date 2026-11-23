/**
 * 订阅提醒（Surge 版）：支持 Surge 信息面板（Panel）与定时提醒（Cron）。
 * 参考 Egern SubReminder.js 移植，仅保留 Surge 原生支持的能力。
 *
 * 参数（通过模块 #!arguments 或 [Script] argument 传入，支持 KEY=VAL&... 或 JSON）：
 * - SUB_1～SUB_20：名称|日期|金额|周期，后两项可留空使用默认值。
 *   - 日期：D（1～31）仅用于每月第 D 天（周期为 1M）；YYYY/M/D（支持 / - . 分隔，1970～2100）为原始扣费锚点。
 *     月末/闰日保留原始日号，按锚点推算（如 1/31 → 2/28 → 3/31）；未来首期锚点直接倒计时至该日。
 *   - 金额：可选，条目与通知原样显示；月均支持非负数、.99、规范千分位和前/后缀币种。
 *   - 周期：默认 1M；支持 1M/3M/1Y/30D 及月/年/3个月/30天，上限 120M/10Y/3660D。
 * - REMIND_DAYS：提前提醒天数，默认 "1 0"（兼容逗号/顿号/空格分隔，单值 0～60）；非法值回退默认。
 *   同一订阅同一续费期的同一档位只推一次（按实例作用域+订阅名+周期去重）；漏跑补最近档位，跨过续费日不追溯上一期。
 * - NOTIFY：默认 true（仅接受 true/false）；仅由 Cron 定时任务触发系统通知，面板刷新不弹窗。
 * - TZ_OFFSET：固定时区偏移 -12～14 小时，默认 8，不自动处理夏令时。
 * - SHOW_TOTAL：默认 true（仅接受 true/false）；按币种统计月均，按天周期以 30 天折算，不换汇；
 *   人民币 ¥/￥/元/CNY/RMB 统一为 ¥ 并合计，其余含字母币种忽略大小写归并、顺序按 SUB_n，最多显示两种，超出以 +N 提示。
 * - MAX_DISPLAY：面板最多展示条数，默认 8；设为 0 显示全部。
 *
 * 提醒：Surge 模块参数通过双引号传入 argument="..."，请勿在订阅名称等值中使用英文双引号 " 或换行符。
 * 通知调用与 $persistentStore 写入非事务，写入失败后下轮可能重发。
 */

(function () {
  "use strict";

  // 苹果 iOS 官方系统色（systemRed / systemOrange / systemGreen）
  const PANEL_COLOR = {
    red: "#FF383C",
    orange: "#FF8D28",
    green: "#34C759"
  };

  const DAY_MS = 86400000;
  const MAX_SUBS = 20;
  const DEFAULT_MAX_DISPLAY = 8;
  const NOTIFY_STORE_NAME = "sub_reminder_notified_v1";

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

  function getTodayMs(tzOffsetHours, nowMs) {
    const local = new Date(nowMs + tzOffsetHours * 3600000);
    return toMs(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate());
  }

  function isPlainObject(val) {
    if (!val || typeof val !== "object" || Array.isArray(val)) return false;
    const proto = Object.getPrototypeOf(val);
    return proto === Object.prototype || proto === null;
  }

  // ---------- 参数解析 ----------

  // 解析 Surge $argument：支持 JSON 对象字符串，或按已知键名边界切分的 KEY=VALUE&... 串
  // 按键名边界切分可保护订阅名称中的 "&"（例如 "AT&T|15|$50"）不被误拆。
  function parseArgument(raw) {
    if (isPlainObject(raw)) return cleanPlaceholders(raw);
    const text = String(raw ?? "").trim();
    if (!text) return {};

    if (text.startsWith("{")) {
      try {
        const parsed = JSON.parse(text);
        if (isPlainObject(parsed)) return cleanPlaceholders(parsed);
      } catch (_) {
        // 非合法 JSON 时回退到键值串解析
      }
    }

    const env = {};
    const keyRe = /(?:^|&)(SUB_\d+|TZ_OFFSET|REMIND_DAYS|NOTIFY|SHOW_TOTAL|MAX_DISPLAY)=/g;
    const matches = [];
    let m;
    while ((m = keyRe.exec(text)) !== null) {
      matches.push({
        key: m[1],
        tokenStart: m.index,
        valueStart: m.index + m[0].length
      });
    }

    for (let i = 0; i < matches.length; i++) {
      const cur = matches[i];
      const valueEnd = i + 1 < matches.length ? matches[i + 1].tokenStart : text.length;
      if (!Object.prototype.hasOwnProperty.call(env, cur.key)) {
        env[cur.key] = stripUnreplacedPlaceholder(text.slice(cur.valueStart, valueEnd));
      }
    }
    return env;
  }

  function stripUnreplacedPlaceholder(val) {
    const s = String(val ?? "");
    return /^\{\{\{[A-Za-z0-9_]+\}\}\}$/.test(s.trim()) ? "" : s;
  }

  function cleanPlaceholders(obj) {
    const out = {};
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      out[key] = typeof v === "string" ? stripUnreplacedPlaceholder(v) : v;
    }
    return out;
  }

  // ---------- 解析订阅与选项 ----------

  function parseCycle(raw) {
    const s = String(raw || "")
      .trim()
      .toUpperCase()
      .replace("个月", "M")
      .replace("月", "M")
      .replace("年", "Y")
      .replace("天", "D");
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
    // 同时填写前后缀币种时，只接受相同币种（忽略大小写），避免把 "$20 USD" 擅自合并为某币种。
    if (!m || !Number.isFinite(value) || (m[1] && m[3] && m[1].toUpperCase() !== m[3].toUpperCase())) {
      return { text: s, value: null, cur: "" };
    }
    return { text: s, value, cur: m[1] || m[3] };
  }

  function parseSubs(env, errors) {
    const subs = [];
    for (let i = 1; i <= MAX_SUBS; i++) {
      const raw = env[`SUB_${i}`];
      const trimmed = raw == null ? "" : String(raw).trim();
      if (!trimmed || trimmed === "-") continue;
      const fields = trimmed.split("|").map(s => s.trim());
      const [name, dateRaw, amountRaw, cycleRaw] = fields;
      // 防止漏写金额分隔符（如 "域名|2025/9/10|1Y"）把周期静默错判为金额与每月扣费
      const amountLooksLikeCycle = !cycleRaw && Boolean(amountRaw) && /^\d+\s*(?:[MYD]|个月|月|年|天)$/i.test(amountRaw);
      const cycle = parseCycle(cycleRaw);
      let anchor = null;

      const full = (dateRaw || "").match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
      const dayOnly = (dateRaw || "").match(/^(\d{1,2})$/);
      if (full) {
        const [y, m, d] = full.slice(1).map(Number);
        if (y >= 1970 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m)) {
          anchor = { y, m, d };
        }
      } else if (dayOnly && cycle && cycle.unit === "M" && cycle.n === 1) {
        const d = Number(dayOnly[1]);
        if (d >= 1 && d <= 31) anchor = { y: 2000, m: 1, d };
      }

      if (!name || !anchor || !cycle || fields.length > 4 || amountLooksLikeCycle) {
        errors.push(`SUB_${i} 格式有误`);
        continue;
      }
      subs.push({ id: `SUB_${i}`, slot: i, name, anchor, cycle, amount: parseAmount(amountRaw) });
    }
    return subs;
  }

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

  function parseMaxDisplay(raw, errors) {
    const s = String(raw ?? "").trim();
    if (!s) return DEFAULT_MAX_DISPLAY;
    if (!/^\d+$/.test(s)) {
      errors.push(`MAX_DISPLAY 有误，已使用 ${DEFAULT_MAX_DISPLAY}`);
      return DEFAULT_MAX_DISPLAY;
    }
    const n = Number(s);
    if (!Number.isSafeInteger(n)) {
      errors.push(`MAX_DISPLAY 有误，已使用 ${DEFAULT_MAX_DISPLAY}`);
      return DEFAULT_MAX_DISPLAY;
    }
    return n;
  }

  function parseBool(raw, name, errors) {
    const s = String(raw ?? "").trim().toLowerCase();
    if (!s || s === "true") return true;
    if (s === "false") return false;
    errors.push(`${name} 有误，已使用 true`);
    return true;
  }

  // ---------- 计算续费日与汇总 ----------

  function nthRenewal(sub, k) {
    const { y, m, d } = sub.anchor;
    return sub.cycle.unit === "D"
      ? toMs(y, m, d) + k * sub.cycle.n * DAY_MS
      : addMonths(y, m, d, k * sub.cycle.n);
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
    const diff = Math.round((nextMs - todayMs) / DAY_MS);
    const nd = new Date(nextMs);
    const cyc = cycleText(sub.cycle);
    return {
      ...sub,
      nextIso: isoOf(nextMs),
      month: nd.getUTCMonth() + 1,
      day: nd.getUTCDate(),
      diff,
      price: sub.amount
        ? (sub.amount.value == null ? sub.amount.text : `${sub.amount.text}/${cyc}`)
        : `每${cyc}`
    };
  }

  function monthlyTotals(items) {
    const totals = new Map();
    for (const it of [...items].sort((a, b) => a.slot - b.slot)) {
      const a = it.amount;
      if (!a || a.value == null) continue;
      const perMonth = it.cycle.unit === "D" ? (a.value * 30) / it.cycle.n : a.value / it.cycle.n;
      // 仅汇总展示统一人民币别名及字母币种大小写；各条目原价与通知文案仍保留用户输入。
      const cur = /^(?:¥|￥|元|CNY|RMB)$/i.test(a.cur)
        ? "¥"
        : (/[A-Za-z]/.test(a.cur) ? a.cur.toUpperCase() : a.cur);
      totals.set(cur, (totals.get(cur) || 0) + perMonth);
    }
    return [...totals].map(([cur, v]) => {
      const num = Math.abs(v - Math.round(v)) < 0.005 ? String(Math.round(v)) : v.toFixed(2);
      // 人民币统一为¥，其他符号原样在前；其他货币代码保留一个分隔空格。
      return /^[A-Za-z]+$/.test(cur) ? `${num} ${cur}` : `${cur}${num}`;
    });
  }

  function monthlyRateText(showTotal, totals) {
    if (!showTotal || !totals.length) return "";
    const values = totals.map(v => v.trim());
    const visible = values.slice(0, 2).join(" + ");
    const more = values.length > 2 ? ` +${values.length - 2}` : "";
    return `${visible}/月${more}`;
  }

  const dayShort = diff => (diff === 0 ? "今天" : diff === 1 ? "明天" : `${diff}天`);
  const whenText = diff => (diff <= 1 ? `${dayShort(diff)}续费` : `${diff}天后续费`);

  // ---------- 通知与持久化去重 ----------

  // 在当前尚未过去的续费期窗口内补最接近的一个档位；跨过续费日后不追溯上一期。
  const remindStage = (diff, remindDays) => remindDays.find(n => n >= diff);

  function getNotifyScope() {
    const raw = typeof $script !== "undefined" && $script && $script.name
      ? String($script.name).trim()
      : "";
    return raw.replace(/(?:Panel|Cron)$/i, "") || "default";
  }

  function notifyIfNeeded(items, remindDays, todayMs, storeKey) {
    if (typeof $notification === "undefined" || typeof $notification.post !== "function") return;
    if (
      typeof $persistentStore === "undefined" ||
      typeof $persistentStore.read !== "function" ||
      typeof $persistentStore.write !== "function"
    ) return;

    let rawState;
    try {
      rawState = $persistentStore.read(storeKey);
    } catch (e) {
      console.log(`[SubReminder] read notify state failed; skipped: ${e}`);
      return; // 无法读取去重状态时跳过本轮，避免把未知状态当成未提醒。
    }

    let state = {};
    let dirty = false;
    if (rawState != null && rawState !== "") {
      try {
        const parsed = JSON.parse(rawState);
        if (isPlainObject(parsed)) {
          state = parsed;
        } else {
          console.log("[SubReminder] invalid notify state shape; reset");
          dirty = true;
        }
      } catch (e) {
        console.log(`[SubReminder] corrupt notify state JSON; reset: ${e}`);
        dirty = true;
      }
    }

    const todayIso = isoOf(todayMs);
    // 只按日期和合法性清理过期记录，不按当前订阅列表删除，避免多实例互删去重记录。
    for (const key of Object.keys(state)) {
      const m = key.match(/^(\d{4}-\d{2}-\d{2})\|(\d+)\|[\s\S]+$/) || key.match(/^SUB_\d+@(\d{4}-\d{2}-\d{2})@(\d+)$/);
      if (!m || m[1] < todayIso || Number(m[2]) > 60 || !Number.isFinite(state[key]) || state[key] < 0) {
        delete state[key];
        dirty = true;
      }
    }

    const scope = getNotifyScope();
    const due = [];
    for (const it of items) {
      const stage = remindStage(it.diff, remindDays);
      if (stage === undefined) continue;
      const key = `${it.nextIso}|${stage}|${scope}|${it.name.trim().toLowerCase()}|${it.cycle.n}${it.cycle.unit}`;
      if (Object.prototype.hasOwnProperty.call(state, key)) continue;
      due.push({ it, key });
    }

    if (due.length) {
      const lines = due.map(({ it }) => {
        const when = it.diff <= 1 ? whenText(it.diff) : `${whenText(it.diff)}（${it.month}/${it.day}）`;
        return `${it.name}${it.amount ? ` ${it.amount.text}` : ""}：${when}`;
      });
      $notification.post("🕹️ 订阅提醒", "", lines.join("\n"), { sound: true });
      const ts = Date.now();
      for (const { key } of due) state[key] = ts;
      dirty = true;
    }

    if (dirty) {
      const ok = $persistentStore.write(JSON.stringify(state), storeKey);
      if (!ok) console.log("[SubReminder] failed to persist notify state");
    }
  }

  // ---------- Surge Panel 渲染 ----------

  function renderPanel(items, opts) {
    const { showTotal, totals, omitted, errors, maxDisplay } = opts;
    const rate = errors.length ? "" : monthlyRateText(showTotal, totals);

    let title = "订阅提醒";
    if (errors.length) {
      title = `订阅提醒 · ${errors.length}项配置有误`;
    } else if (rate) {
      title = `订阅提醒 · ${rate}`;
    } else if (items.length) {
      title = `订阅提醒 · 共${items.length}项`;
    }

    let icon = "bell.badge";
    let iconColor = PANEL_COLOR.green;
    if (!items.length) {
      if (errors.length) {
        icon = "exclamationmark.triangle.fill";
        iconColor = PANEL_COLOR.red;
      }
    } else if (items[0].diff <= 2) {
      iconColor = PANEL_COLOR.red;
    } else if (items[0].diff <= 4) {
      iconColor = PANEL_COLOR.orange;
    } else {
      iconColor = PANEL_COLOR.green;
    }

    const lines = [];
    if (!items.length) {
      if (errors.length) {
        lines.push("暂无有效订阅");
        lines.push(`⚠️ ${errors.join("；")}`);
      } else {
        lines.push("暂无订阅");
        lines.push("请在模块参数中配置 SUB_1～SUB_20");
      }
    } else {
      const visible = maxDisplay > 0 ? items.slice(0, maxDisplay) : items;
      for (const it of visible) {
        lines.push(`${it.name}：${dayShort(it.diff)} · ${it.price}`);
      }
      if (visible.length < items.length) {
        lines.push(`… 另有 ${items.length - visible.length} 项未显示`);
      }
      if (omitted > 0) {
        lines.push(`注：${omitted}项金额未计入月均`);
      }
      if (errors.length) {
        lines.push(`⚠️ ${errors.join("；")}`);
      }
    }

    return {
      title,
      content: lines.join("\n"),
      icon,
      "icon-color": iconColor
    };
  }

  // ---------- 主入口 ----------

  function isCronExecution() {
    if (typeof $input !== "undefined" && $input && $input.purpose === "panel") return false;
    return typeof $script !== "undefined" && $script && $script.type === "cron";
  }

  function isPanelOutputNeeded() {
    if (typeof $input !== "undefined" && $input && $input.purpose === "panel") return true;
    const scriptType = typeof $script !== "undefined" && $script ? $script.type : "";
    return scriptType !== "cron";
  }

  function main() {
    try {
      const rawArg = typeof $argument !== "undefined" ? $argument : "";
      const env = parseArgument(rawArg);
      const errors = [];

      const tz = parseTimezone(env.TZ_OFFSET, errors);
      const remindDays = parseRemindDays(env.REMIND_DAYS, errors);
      const maxDisplay = parseMaxDisplay(env.MAX_DISPLAY, errors);
      const notify = parseBool(env.NOTIFY, "NOTIFY", errors);
      const showTotal = parseBool(env.SHOW_TOTAL, "SHOW_TOTAL", errors);

      const todayMs = getTodayMs(tz, Date.now());
      const items = parseSubs(env, errors)
        .map(sub => computeRenewal(sub, todayMs))
        .sort((a, b) => a.diff - b.diff || a.slot - b.slot);

      if (errors.length) {
        console.log(`[SubReminder] ${errors.join("；")}`);
      }

      // 仅在 Cron 定时任务运行时检查并发送系统通知，避免面板刷新提前打扰或消费档位。
      if (notify && isCronExecution()) {
        try {
          notifyIfNeeded(items, remindDays, todayMs, NOTIFY_STORE_NAME);
        } catch (e) {
          console.log(`[SubReminder] notification phase failed: ${e}`);
        }
      }

      if (!isPanelOutputNeeded()) {
        $done();
        return;
      }

      const totals = monthlyTotals(items);
      const omitted = !errors.length && showTotal && totals.length
        ? items.filter(it => !it.amount || it.amount.value == null).length
        : 0;

      $done(renderPanel(items, { showTotal, totals, omitted, errors, maxDisplay }));
    } catch (e) {
      console.log(`[SubReminder] failed: ${e}`);
      if (isPanelOutputNeeded()) {
        $done({
          title: "订阅提醒出错",
          content: String(e && e.message ? e.message : e),
          icon: "exclamationmark.triangle.fill",
          "icon-color": PANEL_COLOR.red
        });
      } else {
        $done();
      }
    }
  }

  main();
})();
