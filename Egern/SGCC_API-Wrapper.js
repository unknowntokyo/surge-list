export default async function(ctx) {
  const ORIGINAL_SCRIPT =
    "https://raw.githubusercontent.com/Yuheng0101/X/main/Tasks/95598/95598.js";

  const env = ctx.env || {};

  const username = env.USERNAME || env.username || "";
  const password = env.PASSWORD || env.password || "";
  const debug = env.DEBUG || "false";
  const showRecentUsage = env.SHOW_RECENT_USAGE || "false";
  const notifyAllAccounts = env.NOTIFY_ALL_ACCOUNTS || "true";

  function makeArgument() {
    const p = new URLSearchParams();
    p.set("username", username);
    p.set("password", password);
    p.set("debug", debug);
    p.set("show_recent_usage", showRecentUsage);
    p.set("notify_all_accounts", notifyAllAccounts);

    // 强制进入接口模式，保险
    p.set("service", "true");

    return p.toString();
  }

  function jsonResponse(obj, status = 200) {
    return {
      response: {
        status,
        headers: {
          "content-type": "application/json;charset=utf-8"
        },
        body: JSON.stringify(obj)
      }
    };
  }

  if (!username || !password) {
    return jsonResponse({
      error: "请先配置 USERNAME 和 PASSWORD"
    }, 400);
  }

  let code = "";

  try {
    const resp = await ctx.http.get(ORIGINAL_SCRIPT);
    code = await resp.text();
  } catch (e) {
    return jsonResponse({
      error: "原始脚本加载失败",
      message: String(e && e.message ? e.message : e)
    }, 500);
  }

  return await new Promise(resolve => {
    const oldArgument = globalThis.$argument;
    const oldDone = globalThis.$done;

    globalThis.$argument = makeArgument();

    // 兼容某些环境下没有 $request 的情况
    if (!globalThis.$request) {
      globalThis.$request = {
        url: "https://api.wsgw-rewrite.com/electricity/bill/all",
        method: "GET",
        headers: {},
        body: ""
      };
    }

    globalThis.$done = result => {
      globalThis.$argument = oldArgument;
      globalThis.$done = oldDone;
      resolve(result || {});
    };

    try {
      (0, eval)(code);
    } catch (e) {
      globalThis.$argument = oldArgument;
      globalThis.$done = oldDone;

      resolve(jsonResponse({
        error: "原始脚本执行失败",
        message: String(e && e.message ? e.message : e)
      }, 500));
    }
  });
}