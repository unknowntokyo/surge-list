/**
 * 95598 网上国网 - Egern Widget
 * 原脚本：
 * https://raw.githubusercontent.com/Yuheng0101/X/main/Tasks/95598/95598.js
 *
 * Egern Widget Generic Script
 */

const SOURCE_URL =
  "https://raw.githubusercontent.com/Yuheng0101/X/main/Tasks/95598/95598.js";

/**
 * 如果不想用 env，可以直接在这里填账号密码
 * 已经在原脚本持久化配置过账号密码的话，也可以留空
 */
const CONFIG = {
  username: "",
  password: "",

  // 是否显示近日电量
  showRecentUsage: true,

  // 是否查询全部户号；false 时通常只取默认户号
  notifyAllAccounts: false,

  // Widget 缓存时间，避免频繁登录触发风控
  cacheTtlMs: 30 * 60 * 1000,

  // 原脚本执行超时时间
  timeoutMs: 60 * 1000,
};

export default async function (ctx) {
  const cfg = getConfig(ctx);

  try {
    const cache = readJSON("egern_95598_widget_cache");
    if (
      cache &&
      cache.time &&
      Date.now() - cache.time < cfg.cacheTtlMs &&
      cache.payload
    ) {
      return renderWidget(ctx, cache.payload, {
        cached: true,
        message: "缓存",
      });
    }

    const payload = await runOriginalScript(cfg);

    writeJSON("egern_95598_widget_cache", {
      time: Date.now(),
      payload,
    });

    return renderWidget(ctx, payload, {
      cached: false,
      message: "实时",
    });
  } catch (err) {
    const cache = readJSON("egern_95598_widget_cache");

    if (cache && cache.payload) {
      return renderWidget(ctx, cache.payload, {
        cached: true,
        message: "缓存 / 更新失败",
        error: String(err?.message || err),
      });
    }

    return renderErrorWidget(ctx, err);
  }
}

function getConfig(ctx) {
  const env = ctx?.env || {};

  return {
    username:
      env.SGCC_USERNAME ||
      env["95598_username"] ||
      env.username ||
      CONFIG.username ||
      "",
    password:
      env.SGCC_PASSWORD ||
      env["95598_password"] ||
      env.password ||
      CONFIG.password ||
      "",
    showRecentUsage: toBool(
      env.SGCC_SHOW_RECENT_USAGE ?? env.show_recent_usage,
      CONFIG.showRecentUsage
    ),
    notifyAllAccounts: toBool(
      env.SGCC_NOTIFY_ALL_ACCOUNTS ?? env.notify_all_accounts,
      CONFIG.notifyAllAccounts
    ),
    cacheTtlMs: Number(env.CACHE_TTL_MS || CONFIG.cacheTtlMs),
    timeoutMs: Number(env.TIMEOUT_MS || CONFIG.timeoutMs),
  };
}

function toBool(v, def = false) {
  if (v === undefined || v === null || v === "") return def;
  if (typeof v === "boolean") return v;
  return /^(1|true|yes|on)$/i.test(String(v));
}

async function runOriginalScript(cfg) {
  installCompatLayer();

  const scriptText = await fetch(SOURCE_URL).then((r) => {
    if (!r.ok) throw new Error(`原脚本下载失败：HTTP ${r.status}`);
    return r.text();
  });

  return await new Promise((resolve, reject) => {
    const oldArgument = globalThis.$argument;
    const oldDone = globalThis.$done;
    const oldNotification = globalThis.$notification;

    const timer = setTimeout(() => {
      restore();
      reject(new Error("原脚本执行超时"));
    }, cfg.timeoutMs);

    function restore() {
      clearTimeout(timer);
      globalThis.$argument = oldArgument;
      globalThis.$done = oldDone;
      globalThis.$notification = oldNotification;
    }

    const arg = new URLSearchParams();

    // 强制原脚本走 service 模式，返回 JSON
    arg.set("service", "1");
    arg.set("service_mode", "1");
    arg.set("silent", "1");
    arg.set("LogLevel", "off");

    arg.set("show_recent_usage", cfg.showRecentUsage ? "1" : "0");
    arg.set("notify_all_accounts", cfg.notifyAllAccounts ? "1" : "0");

    if (cfg.username) arg.set("username", cfg.username);
    if (cfg.password) arg.set("password", cfg.password);

    globalThis.$argument = arg.toString();

    globalThis.$notification = {
      post() {},
    };

    globalThis.$done = (result = {}) => {
      try {
        restore();
        resolve(parseDoneResult(result));
      } catch (e) {
        restore();
        reject(e);
      }
    };

    try {
      // 让原脚本识别为 Egern 环境
      if (!("Egern" in globalThis)) {
        globalThis.Egern = {};
      }

      // 在全局环境执行原脚本
      (0, eval)(scriptText);
    } catch (e) {
      restore();
      reject(e);
    }
  });
}

function parseDoneResult(result) {
  const response = result?.response || result;
  const body =
    response?.body ??
    response?.data ??
    result?.body ??
    result?.data ??
    result;

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  return body;
}

/**
 * 兼容层：
 * Widget 环境下如果没有 $httpClient / $persistentStore，则补一个简易实现
 */
function installCompatLayer() {
  if (!globalThis.$script) {
    globalThis.$script = {
      startTime: Date.now() / 1000,
    };
  }

  if (!globalThis.$persistentStore) {
    const memory = {};
    globalThis.$persistentStore = {
      read(key) {
        return memory[key] ?? null;
      },
      write(value, key) {
        if (value === null || value === undefined) {
          delete memory[key];
        } else {
          memory[key] = String(value);
        }
        return true;
      },
    };
  }

  if (!globalThis.$httpClient && typeof fetch === "function") {
    const request = (method, opts, cb) => {
      const config = typeof opts === "string" ? { url: opts } : opts || {};
      const url = config.url;
      const headers = config.headers || {};
      const body =
        config.bodyBytes ??
        config.body ??
        config.data ??
        undefined;

      const controller = new AbortController();
      const timeout = Number(config.timeout || 30);
      const timer = setTimeout(
        () => controller.abort(),
        timeout > 500 ? timeout : timeout * 1000
      );

      fetch(url, {
        method: config.method || method,
        headers,
        body: ["GET", "HEAD"].includes(method) ? undefined : body,
        redirect:
          config["auto-redirect"] === false || config.redirection === false
            ? "manual"
            : "follow",
        signal: controller.signal,
      })
        .then(async (res) => {
          clearTimeout(timer);
          const text = await res.text();
          const resp = {
            status: res.status,
            statusCode: res.status,
            headers: Object.fromEntries(res.headers.entries()),
          };
          cb(null, resp, text);
        })
        .catch((err) => {
          clearTimeout(timer);
          cb(err);
        });
    };

    globalThis.$httpClient = {
      get: (opts, cb) => request("GET", opts, cb),
      post: (opts, cb) => request("POST", opts, cb),
      put: (opts, cb) => request("PUT", opts, cb),
      patch: (opts, cb) => request("PATCH", opts, cb),
      delete: (opts, cb) => request("DELETE", opts, cb),
    };
  }
}

function readJSON(key) {
  try {
    const raw = globalThis.$persistentStore?.read(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJSON(key, value) {
  try {
    globalThis.$persistentStore?.write(JSON.stringify(value), key);
  } catch {}
}

/**
 * 数据归一化
 */
function normalizeAccounts(payload) {
  let data = payload;

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    if (Array.isArray(payload.data)) data = payload.data;
    else if (payload.data) data = [payload.data];
    else data = [payload];
  }

  if (!Array.isArray(data)) data = [data];

  return data
    .filter(Boolean)
    .map((item) => {
      const user = item.userInfo || item;
      const bill = item.eleBill || item;
      const day = item.dayElecQuantity || item;

      const rawBalance =
        pick(item.rawBalance, bill.sumMoney, item.balance) ?? "";
      const balanceNumber = Number(rawBalance);
      const isOwe =
        Boolean(item.isOwe) ||
        Boolean(item.arrearsOfFees) ||
        Number(bill.historyOwe || 0) > 0 ||
        balanceNumber < 0;

      const balance = Number.isFinite(balanceNumber)
        ? Math.abs(balanceNumber).toFixed(2)
        : String(item.balance ?? rawBalance ?? "--");

      const recentList =
        item.recentUsageList ||
        (Array.isArray(day.sevenEleList)
          ? day.sevenEleList.map((x) => ({
              day: x.day,
              value: Number(x.dayElePq || 0),
            }))
          : []);

      return {
        consNo:
          pick(
            item.consNo,
            user.consNo_dst,
            user.consNo,
            user.consNoSrc
          ) || "--",
        consName:
          pick(
            item.consName,
            user.consName_dst,
            user.consName,
            user.realName
          ) || "",
        address:
          pick(
            item.address,
            user.elecAddr_dst,
            user.elecAddr,
            user.address
          ) || "",
        orgName: pick(item.orgName, user.orgName) || "",
        balance,
        isOwe,
        billDate: pick(item.billDate, bill.date) || "--",
        currentUsage:
          pick(item.currentUsage, bill.totalPq, day.totalPq) || "--",
        estimatedDays: pick(item.estimatedDays, bill.dayNum) || "",
        annualUsage:
          pick(
            item.annualUsage,
            item.monthElecQuantity?.dataInfo?.totalEleNum
          ) || "",
        annualCost:
          pick(
            item.annualCost,
            item.monthElecQuantity?.dataInfo?.totalEleCost
          ) || "",
        recentTotalUsage:
          pick(item.recentTotalUsage, day.totalPq) || "",
        recentList,
      };
    });
}

function pick(...args) {
  return args.find((x) => x !== undefined && x !== null && x !== "");
}

/**
 * Widget 渲染
 */
function renderWidget(ctx, payload, meta = {}) {
  const family = ctx?.widgetFamily || "systemMedium";
  const accounts = normalizeAccounts(payload);
  const account = accounts[0];

  if (!account) {
    return renderErrorWidget(ctx, new Error("未获取到用电户号数据"));
  }

  if (family.startsWith("accessory")) {
    return {
      type: "widget",
      children: [
        {
          type: "text",
          text: account.isOwe
            ? `欠费 ${account.balance}元`
            : `余额 ${account.balance}元`,
          font: { size: "caption1", weight: "semibold" },
        },
      ],
    };
  }

  const isSmall = family === "systemSmall";
  const isLarge =
    family === "systemLarge" || family === "systemExtraLarge";

  const children = [
    titleRow(meta),
    { type: "spacer", length: 8 },
    {
      type: "text",
      text: account.isOwe ? "当前欠费" : "账户余额",
      textColor: "#D1D5DB",
      font: { size: "caption1" },
    },
    {
      type: "text",
      text: `${account.isOwe ? "-" : ""}${account.balance} 元`,
      textColor: account.isOwe ? "#FF6B6B" : "#7CFFB2",
      font: { size: isSmall ? "title2" : "largeTitle", weight: "bold" },
    },
    { type: "spacer", length: 6 },
    row("本期电量", `${account.currentUsage} 度`),
    row("截至日期", account.billDate),
  ];

  if (!isSmall) {
    children.push(row("户号", mask(account.consNo)));
    if (account.estimatedDays) {
      children.push(row("预计可用", `${account.estimatedDays} 天`));
    }
    if (account.recentTotalUsage) {
      children.push(row("近日电量", `${account.recentTotalUsage} 度`));
    }
  }

  if (isLarge) {
    if (account.annualUsage || account.annualCost) {
      children.push(
        row(
          "年度用电",
          `${account.annualUsage || "--"} 度 / ${
            account.annualCost || "--"
          } 元`
        )
      );
    }

    if (account.address) {
      children.push(row("地址", account.address));
    }

    if (account.recentList.length) {
      children.push({ type: "spacer", length: 8 });
      children.push({
        type: "text",
        text: "近日电量",
        textColor: "#D1D5DB",
        font: { size: "caption1", weight: "semibold" },
      });

      account.recentList.slice(-5).forEach((x) => {
        children.push(
          row(
            x.day || "--",
            `${Number(x.value || x.dayElePq || 0).toFixed(2)} 度`
          )
        );
      });
    }
  }

  children.push({ type: "spacer" });
  children.push({
    type: "text",
    text:
      `${meta.message || ""} · ${formatTime(new Date())}` +
      (accounts.length > 1 ? ` · 共 ${accounts.length} 户` : ""),
    textColor: "#9CA3AF",
    font: { size: "caption2" },
  });

  if (meta.error && isLarge) {
    children.push({
      type: "text",
      text: `更新失败：${meta.error}`,
      textColor: "#FCA5A5",
      font: { size: "caption2" },
    });
  }

  return {
    type: "widget",
    padding: 16,
    backgroundGradient: {
      type: "linear",
      colors: account.isOwe
        ? ["#3A1111", "#111827"]
        : ["#0F2027", "#203A43", "#2C5364"],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 },
    },
    url: "https://www.95598.cn/",
    children,
  };
}

function titleRow(meta) {
  return {
    type: "stack",
    direction: "row",
    alignItems: "center",
    gap: 6,
    children: [
      {
        type: "image",
        src: "sf-symbol:bolt.fill",
        color: "#FFD166",
        width: 18,
        height: 18,
      },
      {
        type: "text",
        text: "网上国网",
        textColor: "#FFFFFF",
        font: { size: "headline", weight: "semibold" },
      },
      { type: "spacer" },
      {
        type: "text",
        text: meta.cached ? "CACHE" : "LIVE",
        textColor: meta.cached ? "#FCD34D" : "#86EFAC",
        font: { size: "caption2", weight: "semibold" },
      },
    ],
  };
}

function row(left, right) {
  return {
    type: "stack",
    direction: "row",
    alignItems: "center",
    gap: 6,
    children: [
      {
        type: "text",
        text: left,
        textColor: "#D1D5DB",
        font: { size: "caption1" },
      },
      { type: "spacer" },
      {
        type: "text",
        text: String(right || "--"),
        textColor: "#FFFFFF",
        font: { size: "caption1", weight: "medium" },
      },
    ],
  };
}

function renderErrorWidget(ctx, err) {
  return {
    type: "widget",
    padding: 16,
    backgroundGradient: {
      type: "linear",
      colors: ["#450A0A", "#111827"],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 },
    },
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 8,
        children: [
          {
            type: "image",
            src: "sf-symbol:exclamationmark.triangle.fill",
            color: "#FCA5A5",
            width: 20,
            height: 20,
          },
          {
            type: "text",
            text: "网上国网",
            textColor: "#FFFFFF",
            font: { size: "headline", weight: "semibold" },
          },
        ],
      },
      { type: "spacer", length: 10 },
      {
        type: "text",
        text: "数据获取失败",
        textColor: "#FFFFFF",
        font: { size: "title3", weight: "bold" },
      },
      {
        type: "text",
        text: String(err?.message || err || "Unknown Error"),
        textColor: "#FCA5A5",
        font: { size: "caption1" },
      },
    ],
  };
}

function mask(s) {
  s = String(s || "");
  if (s.length <= 6) return s;
  return `${s.slice(0, 3)}****${s.slice(-3)}`;
}

function formatTime(d) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}