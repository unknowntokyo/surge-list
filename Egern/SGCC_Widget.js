const ORIGINAL_SCRIPT =
  "https://raw.githubusercontent.com/Yuheng0101/X/main/Tasks/95598/95598.js";

const env = ctx.env || {};
const family = ctx.widgetFamily || "systemMedium";

const USERNAME = env.USERNAME || env.username || "";
const PASSWORD = env.PASSWORD || env.password || "";
const DEBUG = env.DEBUG || env.debug || "false";
const SHOW_RECENT_USAGE =
  env.SHOW_RECENT_USAGE || env.show_recent_usage || "false";
const NOTIFY_ALL_ACCOUNTS =
  env.NOTIFY_ALL_ACCOUNTS || env.notify_all_accounts || "false";

function boolValue(v) {
  return String(v).toLowerCase() === "true" || String(v) === "1";
}

function makeArgs() {
  const p = new URLSearchParams();
  p.set("username", USERNAME);
  p.set("password", PASSWORD);
  p.set("debug", DEBUG);
  p.set("show_recent_usage", SHOW_RECENT_USAGE);
  p.set("notify_all_accounts", NOTIFY_ALL_ACCOUNTS);
  p.set("silent", "false");
  return p.toString();
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    if (typeof $httpClient !== "undefined") {
      $httpClient.get({ url, timeout: 15 }, (err, resp, body) => {
        if (err) reject(err);
        else resolve(body);
      });
    } else if (typeof fetch !== "undefined") {
      fetch(url).then(r => r.text()).then(resolve).catch(reject);
    } else {
      reject(new Error("当前环境不支持网络请求"));
    }
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function textNode(text, size = "caption1", weight = "regular", color, lineLimit) {
  const node = {
    type: "text",
    text: String(text ?? ""),
    font: { size, weight },
    textColor: color || {
      light: "#111827",
      dark: "#F9FAFB"
    }
  };
  if (lineLimit) node.lineLimit = lineLimit;
  return node;
}

function spacer(length) {
  const node = { type: "spacer" };
  if (length) node.length = length;
  return node;
}

function cleanLines(str) {
  return String(str || "")
    .split(/\r?\n/)
    .map(i => i.trim())
    .filter(Boolean);
}

function flattenNoticeList(list) {
  if (!list.length) {
    return {
      title: "网上国网",
      subtitle: "暂无数据",
      body: "请检查账号密码或稍后刷新小组件"
    };
  }

  const first = list[0];
  return {
    title: first.title || "网上国网",
    subtitle: first.subtitle || first.subt || "",
    body: list
      .map(item => {
        return [item.subtitle || item.subt || "", item.body || ""]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n")
  };
}

function buildAccessoryWidget(info) {
  const body = info.body || info.subtitle || "暂无数据";
  const lines = cleanLines(body);
  const main =
    lines.find(i => i.includes("余额")) ||
    lines.find(i => i.includes("本期电量")) ||
    lines[0] ||
    "网上国网";

  if (family === "accessoryInline") {
    return {
      type: "widget",
      children: [
        textNode(`⚡ ${main}`, "caption1", "medium", "#FFFFFF", 1)
      ]
    };
  }

  if (family === "accessoryCircular") {
    return {
      type: "widget",
      children: [
        textNode("⚡", "title3", "bold", "#FFFFFF", 1),
        textNode(main.replace(/^账户余额[:：]\s*/, ""), "caption2", "medium", "#FFFFFF", 2)
      ]
    };
  }

  return {
    type: "widget",
    children: [
      textNode("网上国网", "caption2", "medium", "#FFFFFF", 1),
      textNode(main, "caption1", "semibold", "#FFFFFF", 2)
    ]
  };
}

function buildWidget(info) {
  if (family.startsWith("accessory")) {
    return buildAccessoryWidget(info);
  }

  const isError =
    /❌|错误|失败|请先配置|账号|密码/.test(info.subtitle || "") ||
    /❌|错误|失败|请先配置|账号|密码/.test(info.body || "");

  const lines = cleanLines(info.body || info.subtitle || "暂无数据");

  const maxLines =
    family === "systemSmall"
      ? 5
      : family === "systemMedium"
        ? 8
        : 16;

  const displayLines = lines.slice(0, maxLines);

  const titleColor = isError
    ? { light: "#DC2626", dark: "#F87171" }
    : { light: "#047857", dark: "#34D399" };

  const bodyColor = {
    light: "#374151",
    dark: "#D1D5DB"
  };

  const children = [
    {
      type: "stack",
      direction: "row",
      alignment: "center",
      gap: 6,
      children: [
        {
          type: "image",
          src: "sf-symbol:bolt.fill",
          width: 18,
          height: 18,
          tintColor: titleColor
        },
        textNode(info.title || "网上国网", "headline", "bold", titleColor, 1),
        spacer(),
        {
          type: "date",
          date: new Date().toISOString(),
          format: "time",
          font: { size: "caption2", weight: "regular" },
          textColor: {
            light: "#6B7280",
            dark: "#9CA3AF"
          }
        }
      ]
    }
  ];

  if (info.subtitle) {
    children.push(
      textNode(
        info.subtitle,
        "caption1",
        "semibold",
        isError
          ? { light: "#DC2626", dark: "#F87171" }
          : { light: "#111827", dark: "#F9FAFB" },
        2
      )
    );
  }

  children.push(
    {
      type: "stack",
      direction: "column",
      gap: 3,
      children: displayLines.map(line => {
        const highlight =
          line.includes("余额") ||
          line.includes("本期电量") ||
          line.includes("预计可用") ||
          line.includes("五日用电");

        const color = highlight
          ? { light: "#111827", dark: "#FFFFFF" }
          : bodyColor;

        return textNode(
          line,
          family === "systemSmall" ? "caption2" : "caption1",
          highlight ? "medium" : "regular",
          color,
          1
        );
      })
    }
  );

  return {
    type: "widget",
    backgroundColor: {
      light: "#F0FDF4",
      dark: "#052E16"
    },
    padding: 12,
    gap: 8,
    children
  };
}

async function runOriginalScript() {
  const notices = [];

  if (!USERNAME || !PASSWORD) {
    return buildWidget({
      title: "网上国网",
      subtitle: "请先配置账号密码",
      body: "在 Egern 模块 env 中填写 USERNAME 和 PASSWORD"
    });
  }

  let doneResolve;
  const donePromise = new Promise(resolve => {
    doneResolve = resolve;
  });

  globalThis.$argument = makeArgs();

  globalThis.$done = payload => {
    doneResolve(payload || {});
  };

  globalThis.$notification = {
    post(title, subtitle, body, options) {
      notices.push({
        title,
        subtitle,
        body,
        options
      });
    }
  };

  try {
    const code = await httpGet(ORIGINAL_SCRIPT);

    try {
      (0, eval)(code);
    } catch (e) {
      notices.push({
        title: "网上国网",
        subtitle: "❌ 脚本加载失败",
        body: String(e && e.message ? e.message : e)
      });
      doneResolve({});
    }

    await Promise.race([
      donePromise,
      sleep(55000).then(() => {
        throw new Error("查询超时，请稍后刷新 Widget");
      })
    ]);

    return buildWidget(flattenNoticeList(notices));
  } catch (e) {
    return buildWidget({
      title: "网上国网",
      subtitle: "❌ Widget 执行失败",
      body: String(e && e.message ? e.message : e)
    });
  }
}

return await runOriginalScript();