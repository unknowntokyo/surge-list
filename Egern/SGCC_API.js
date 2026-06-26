export default async function(ctx) {
  const ORIGINAL_SCRIPT_URL =
    "https://raw.githubusercontent.com/Yuheng0101/X/main/Tasks/95598/95598.js";

  const env = ctx.env || {};

  const username =
    env.SGCC_USERNAME ||
    env.USERNAME ||
    env.username ||
    "";

  const password =
    env.SGCC_PASSWORD ||
    env.PASSWORD ||
    env.password ||
    "";

  const debug =
    env.SGCC_DEBUG ||
    env.DEBUG ||
    "false";

  const showRecentUsage =
    env.SGCC_SHOW_RECENT_USAGE ||
    env.SHOW_RECENT_USAGE ||
    "false";

  const notifyAllAccounts =
    env.SGCC_NOTIFY_ALL_ACCOUNTS ||
    env.NOTIFY_ALL_ACCOUNTS ||
    "true";

  const wrapperTimeoutMs = Number(env.SGCC_WRAPPER_TIMEOUT_MS || 55000);

  function respondJSON(obj, status = 200) {
    return ctx.respond({
      status,
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify(obj)
    });
  }

  function parseStatus(status) {
    if (typeof status === "number") return status;

    if (typeof status === "string") {
      const m = status.match(/\b(\d{3})\b/);
      if (m) return Number(m[1]);
    }

    return 200;
  }

  function headersToObject(headers) {
    const obj = {};

    if (!headers) return obj;

    try {
      if (typeof headers.forEach === "function") {
        headers.forEach((value, key) => {
          obj[key] = value;
        });
        return obj;
      }
    } catch (_) {}

    try {
      for (const key of Object.keys(headers)) {
        const value = headers[key];
        if (value !== undefined && typeof value !== "function") {
          obj[key] = value;
        }
      }
    } catch (_) {}

    return obj;
  }

  function normalizeBody(body) {
    if (body === undefined || body === null) return "";

    if (typeof body === "string") return body;

    if (
      body instanceof ArrayBuffer ||
      body instanceof Uint8Array
    ) {
      return body;
    }

    try {
      return JSON.stringify(body);
    } catch (_) {
      return String(body);
    }
  }

  function legacyResultToRespond(result) {
    if (!result) {
      return respondJSON({
        error: "原脚本没有返回数据"
      }, 500);
    }

    if (result.response) {
      const response = result.response;
      return ctx.respond({
        status: parseStatus(response.status || response.statusCode || 200),
        headers: response.headers || {
          "Content-Type": "application/json;charset=utf-8"
        },
        body: normalizeBody(response.body)
      });
    }

    const status = parseStatus(result.status || result.statusCode || 200);

    const headers =
      result.headers ||
      {
        "Content-Type": "application/json;charset=utf-8"
      };

    let body;

    if (result.body !== undefined) {
      body = normalizeBody(result.body);
    } else if (result.bodyBytes !== undefined) {
      body = result.bodyBytes;
    } else {
      body = JSON.stringify(result);
    }

    return ctx.respond({
      status,
      headers,
      body
    });
  }

  function makeArgument() {
    const p = new URLSearchParams();

    p.set("username", username);
    p.set("password", password);

    // 强制接口模式
    p.set("service", "true");

    p.set("debug", debug);
    p.set("show_recent_usage", showRecentUsage);
    p.set("notify_all_accounts", notifyAllAccounts);

    return p.toString();
  }

  function normalizeRequestOptions(input, method) {
    if (typeof input === "string") {
      return {
        url: input,
        options: {
          headers: {},
          timeout: 30000
        }
      };
    }

    const req = input || {};

    const url = req.url;

    const headers = req.headers || {};

    const options = {
      headers,
      timeout: req.timeout ? Number(req.timeout) : 30000,
      redirect: req["auto-redirect"] === false ? "manual" : "follow"
    };

    if (req.body !== undefined) {
      options.body = req.body;
    }

    if (req.policy) {
      options.policy = req.policy;
    }

    if (req.insecureTls !== undefined) {
      options.insecureTls = !!req.insecureTls;
    }

    return {
      url,
      options
    };
  }

  function makeHttpClient() {
    async function request(method, input) {
      const normalized = normalizeRequestOptions(input, method);
      const url = normalized.url;
      const options = normalized.options;

      if (!url) {
        throw new Error("Missing request url");
      }

      const lower = String(method || "GET").toLowerCase();
      const fn = ctx.http[lower] || ctx.http.get;

      const resp = await fn.call(ctx.http, url, options);

      let body = "";

      try {
        body = await resp.text();
      } catch (_) {
        try {
          const ab = await resp.arrayBuffer();
          body = ab;
        } catch (_) {
          body = "";
        }
      }

      const response = {
        status: resp.status,
        statusCode: resp.status,
        headers: headersToObject(resp.headers)
      };

      return {
        response,
        body
      };
    }

    function withCallback(method) {
      return function(input, callback) {
        const p = request(method, input);

        if (typeof callback === "function") {
          p.then(({ response, body }) => {
            callback(null, response, body);
          }).catch(err => {
            callback(err, null, null);
          });
        }

        return p.then(({ response, body }) => {
          return {
            status: response.status,
            statusCode: response.statusCode,
            headers: response.headers,
            body
          };
        });
      };
    }

    return {
      get: withCallback("GET"),
      post: withCallback("POST"),
      put: withCallback("PUT"),
      patch: withCallback("PATCH"),
      delete: withCallback("DELETE"),
      head: withCallback("HEAD"),
      options: withCallback("OPTIONS")
    };
  }

  function saveGlobals(names) {
    const saved = {};

    for (const name of names) {
      saved[name] = {
        exists: Object.prototype.hasOwnProperty.call(globalThis, name),
        value: globalThis[name]
      };
    }

    return function restore() {
      for (const name of names) {
        if (saved[name].exists) {
          globalThis[name] = saved[name].value;
        } else {
          try {
            delete globalThis[name];
          } catch (_) {
            globalThis[name] = undefined;
          }
        }
      }
    };
  }

  if (!username || !password) {
    return respondJSON({
      error: "请先配置 SGCC_USERNAME 和 SGCC_PASSWORD",
      hint: "在模块环境变量中填写网上国网账号和密码"
    }, 400);
  }

  let originalCode = "";

  try {
    const resp = await ctx.http.get(ORIGINAL_SCRIPT_URL, {
      timeout: 30000,
      redirect: "follow"
    });

    originalCode = await resp.text();

    if (!originalCode || originalCode.length < 1000) {
      return respondJSON({
        error: "原始 95598.js 加载异常",
        status: resp.status,
        body: originalCode.slice(0, 300)
      }, 502);
    }
  } catch (e) {
    return respondJSON({
      error: "原始 95598.js 加载失败",
      message: String(e && e.message ? e.message : e)
    }, 502);
  }

  return await new Promise(async resolve => {
    let finished = false;

    const restoreGlobals = saveGlobals([
      "Egern",
      "$argument",
      "$request",
      "$response",
      "$done",
      "$httpClient",
      "$persistentStore",
      "$prefs",
      "$notification",
      "$notify",
      "$script"
    ]);

    function finish(result) {
      if (finished) return;
      finished = true;

      clearTimeout(timer);

      try {
        restoreGlobals();
      } catch (_) {}

      try {
        resolve(legacyResultToRespond(result));
      } catch (e) {
        resolve(respondJSON({
          error: "转换原脚本返回值失败",
          message: String(e && e.message ? e.message : e)
        }, 500));
      }
    }

    const timer = setTimeout(() => {
      finish({
        status: 504,
        headers: {
          "Content-Type": "application/json;charset=utf-8"
        },
        body: JSON.stringify({
          error: "查询超时",
          message: `原脚本超过 ${wrapperTimeoutMs}ms 未返回`
        })
      });
    }, wrapperTimeoutMs);

    try {
      globalThis.Egern = globalThis.Egern || {};

      globalThis.$argument = makeArgument();

      globalThis.$request = {
        url: ctx.request && ctx.request.url
          ? ctx.request.url
          : "https://api.wsgw-rewrite.com/electricity/bill/all",
        method: ctx.request && ctx.request.method
          ? ctx.request.method
          : "GET",
        headers: ctx.request && ctx.request.headers
          ? headersToObject(ctx.request.headers)
          : {},
        body: ""
      };

      globalThis.$script = {
        name: "sgcc-api",
        startTime: Date.now() / 1000
      };

      globalThis.$done = function(result) {
        finish(result || {});
      };

      globalThis.$httpClient = makeHttpClient();

      globalThis.$persistentStore = {
        read(key) {
          try {
            return ctx.storage.get(key);
          } catch (_) {
            return null;
          }
        },
        write(value, key) {
          try {
            ctx.storage.set(key, String(value));
            return true;
          } catch (_) {
            return false;
          }
        }
      };

      globalThis.$prefs = {
        valueForKey(key) {
          try {
            return ctx.storage.get(key);
          } catch (_) {
            return null;
          }
        },
        setValueForKey(value, key) {
          try {
            ctx.storage.set(key, String(value));
            return true;
          } catch (_) {
            return false;
          }
        },
        removeValueForKey(key) {
          try {
            ctx.storage.delete(key);
            return true;
          } catch (_) {
            return false;
          }
        }
      };

      globalThis.$notification = {
        post(title, subtitle, body, options) {
          try {
            ctx.notify({
              title: String(title || ""),
              subtitle: String(subtitle || ""),
              body: String(body || "")
            });
          } catch (_) {}
        }
      };

      globalThis.$notify = function(title, subtitle, body) {
        try {
          ctx.notify({
            title: String(title || ""),
            subtitle: String(subtitle || ""),
            body: String(body || "")
          });
        } catch (_) {}
      };

      const code =
        originalCode +
        "\n//# sourceURL=sgcc-original-95598.js";

      // 执行原脚本
      (0, eval)(code);
    } catch (e) {
      finish({
        status: 500,
        headers: {
          "Content-Type": "application/json;charset=utf-8"
        },
        body: JSON.stringify({
          error: "原始脚本执行失败",
          message: String(e && e.message ? e.message : e)
        })
      });
    }
  });
}