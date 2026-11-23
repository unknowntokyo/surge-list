"use strict";

/*
 * 配合 Sub-Info.sgmodule 使用。url 填完整 HTTP(S) 订阅链接，无需编码，兼容旧式 encodeURIComponent 编码。
 * 手动拼 $argument 时，优先把 url= 放在末尾。若查询参数恰与脚本参数同名且含义有歧义，可整体编码 URL 值。
 * reset_day：每月重置日（1–31），短月份按月末计。title：面板标题。icon：SF Symbol 名称。
 * color：HEX 图标色，如 #007aff。method：head 或 get，省略时按策略探测。policy：Surge 代理策略名。
 * expire：YYYY-MM-DD、YYYY/MM/DD 或秒/毫秒时间戳，0 表示永久有效，false 隐藏到期信息。
 * 手动填写数字 expire 且未接模块参数时，将它放在裸 url= 之前，或为 URL 加引号/整体编码。
 */

(async function () {
  const KNOWN_KEYS = new Set(["url", "reset_day", "title", "icon", "color", "expire", "method", "policy"]);
  const ENCODED_HTTP = /^https?%(?:25)*3a%(?:25)*2f%(?:25)*2f/i;
  const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
  const RESET_DAY_PATTERN = /^(?:0?[1-9]|[12]\d|3[01])$/;
  const SF_SYMBOL_PATTERN = /^(?=.*[a-z])[a-z0-9]+(?:\.[a-z0-9]+)*$/;
  const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
  const DATE_OVERRIDE = /^(\d{4})([-/])(\d{1,2})\2(\d{1,2})$/;
  const STRICT_NON_NEGATIVE_NUM = /^\+?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
  const TRAFFIC_KEYS = new Set(["upload", "download", "total"]);
  const USERINFO_ASSIGNMENT = /^[-\w]+\s*=/;
  const USERINFO_BARE_KEY = /^(?:upload|download|total|expire)$/i;
  const MODULE_KEYS = ["reset_day", "title", "icon", "color"];
  const MODULE_EXTRAS = new Set(["method", "policy", "expire"]);
  const STRONG_SECRET_QUERY_KEY = /^(?:token|secret|auth|pass(?:word)?|pwd|sign|sig|sid|session|cookie|ticket|api[_-]?key|access[_-]?token|auth[_-]?key|uuid)$/i;
  const WEAK_ID_QUERY_KEY = /^(?:key|id|uid|code|hash|sub(?:scribe)?)$/i;
  const TEXT_HTTP_URL = /^https?:\/\/.+/i;
  const URL_IN_TEXT = /https?:\/\/\S+/gi;
  const SENSITIVE_KEY_SUFFIX = /(?:token|secret|pass(?:word)?|pwd|auth)$/i;
  const SENSITIVE_API_KEY_SUFFIX = /(?:api|auth)[_-]?key$/i;
  const TRIVIAL_SECRET_VALUE = /^(?:true|false|null|none)$/i;
  const COMMON_QUERY_VALUE = /^(?:meta|clash|surge|quanx|shadowrocket|loon|stash|singbox|sing-box|v2ray|mihomo|true|false|null|none|auto|default|direct|proxy|reject|yaml|text|json|http|https)$/i;
  const COMMON_PATH_SEGMENT = /^(?:api|v[123]|client|sub|subscribe|subscription|link|links|clash|meta|surge|get|download|config|yaml|yml|txt|s|c|u|node|nodes|profile|profiles)$/i;
  const USERINFO_CHAR = /^[A-Za-z0-9._~:!$&'()*+,;=-]$/;
  const URL_REST_CHAR = /^[A-Za-z0-9._~:/?#@!$&'()*+,;=-]$/;
  const DEFAULT_TITLE = "机场订阅";
  const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];
  const SCRIPT_SOFT_TIMEOUT_MS = 7000;
  const MIN_REQUEST_TIMEOUT_MS = 1000;
  const MAX_PROTO_HOPS = 64;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const RETIRE_GRACE_MS = DAY_MS;
  const NETWORK_COOLDOWN_MS = 30 * 60 * 1000;
  const MAX_STALE_MS = 10 * DAY_MS;
  const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;
  const MAX_CACHE_SEQ = 9007199254740991;
  const SLOT_HEARTBEAT_MS = DAY_MS;
  const ORPHAN_SLOT_TTL_MS = 10 * DAY_MS;
  const MAX_TRACKED_SLOTS = 32;
  const MAX_PENDING_CLEANUPS = 64;
  const MAX_TIER1_SECRETS = 64;
  const MAX_EXACT_SECRETS = 32;
  const MAX_TIER2_SECRETS = 32;
  const MAX_DERIVED_SECRETS = 2 * (MAX_TIER1_SECRETS + MAX_EXACT_SECRETS + MAX_TIER2_SECRETS);
  const FORCE_REFRESH_TRIGGERS = ["button", "editor", "http-api", "intent"];
  const CACHE_PREFIX = "subinfo_c_";
  const STATE_KEY = "subinfo_state_v1";
  const FINGERPRINT = /^[a-z0-9]{1,7}(?:_[a-z0-9]{1,7}){3}$/;
  const HASH_SEEDS = [2166136261, 2246822507, 3266489909];
  const RED = "#FF3B30";
  const ORANGE = "#FF9500";
  const ERROR_ICON = "exclamationmark.triangle.fill";
  const MAX_FATAL_ERROR_TEXT_LENGTH = 120;
  const STAGE_LABELS = {
    init: "初始化",
    args: "参数解析",
    url: "链接校验",
    storage: "缓存处理",
    fetch: "订阅请求",
    render: "面板渲染",
  };
  const ERROR_NAMES = new Set([
    "Error", "TypeError", "ReferenceError", "RangeError", "SyntaxError", "URIError", "EvalError",
  ]);
  const ACCEPT = "application/x-yaml,text/plain,*/*";
  const STRATEGIES = [
    { id: "head_meta", method: "head", flag: "meta", ua: "mihomo/1.19.3", accept: ACCEPT },
    { id: "head_qx", method: "head", flag: null, ua: "Quantumult%20X" },
    { id: "get_meta", method: "get", flag: "meta", ua: "mihomo/1.19.3", accept: ACCEPT },
    { id: "get_clash", method: "get", flag: "clash", ua: "Clash/1.18.0", accept: ACCEPT },
    { id: "get_verge", method: "get", flag: null, ua: "clash-verge-rev/2.3.1", accept: ACCEPT },
  ];
  const STRATEGY_IDS = new Set(STRATEGIES.map((strategy) => strategy.id));
  const HEAD_SKIP_ERRORS = new Set(["HTTP 405", "HTTP 501", "Timeout"]);

  function stripPairedQuotes(value) {
    const quote = value[0];
    if (value.length >= 2 && (quote === '"' || quote === "'") && value.endsWith(quote)) {
      return value.slice(1, -1);
    }
    return value;
  }

  function trimLeft(value) {
    return value.replace(/^\s+/, "");
  }

  function trimRight(value) {
    let end = value.length;
    while (end > 0 && isWhitespaceAt(value, end - 1)) end--;
    return end === value.length ? value : value.slice(0, end);
  }

  function safeDecodeParam(value) {
    if (value.indexOf("%") === -1) return value;
    try {
      return decodeURIComponent(value);
    } catch (error) {
      if (error instanceof URIError) return value;
      throw error;
    }
  }

  function normalizeArgValue(key, rawValue) {
    const decoded = safeDecodeParam(rawValue).trim();
    return key === "title" ? decoded : stripPairedQuotes(decoded).trim();
  }

  function isValidTrailingArgValue(key, rawValue) {
    const value = normalizeArgValue(key, rawValue);
    if (!value) return true;

    switch (key) {
      case "reset_day": return value === "重置日期" || RESET_DAY_PATTERN.test(value);
      case "color": return HEX_COLOR_PATTERN.test(value);
      case "icon": return value.length <= 80 && SF_SYMBOL_PATTERN.test(value);
      case "method": return /^(?:head|get)$/i.test(value);
      case "expire": return /^(?:false|\d{4}[-/]\d{1,2}[-/]\d{1,2})$/i.test(value);
      case "policy":
        return value.length <= 128 && !/^https?:\/\//i.test(value) && !/^eyJ[A-Za-z0-9+/_-]{16,}/.test(value);
      case "title": return true;
      default: return false;
    }
  }

  function joinUrlSegments(segments, start, end) {
    return [segments[start].value].concat(segments.slice(start + 1, end).map((segment) => segment.text)).join("&");
  }

  function findQuotedUrlCandidates(segments, u) {
    const first = trimLeft(segments[u].value);
    const quote = first[0];
    if (quote !== '"' && quote !== "'") return [];
    const candidates = [];
    let quoteCount = 0;
    for (let i = u; i < segments.length; i++) {
      const text = i === u ? first : segments[i].text;
      for (let pos = text.indexOf(quote); pos !== -1; pos = text.indexOf(quote, pos + 1)) quoteCount++;
      const trimmed = trimRight(text);
      if (!trimmed.endsWith(quote) || (i === u && trimmed.length < 2)) continue;
      const next = segments[i + 1];
      if (next && (next.key === "url" || !KNOWN_KEYS.has(next.key))) continue;
      candidates.push({ end: i + 1, even: quoteCount % 2 === 0 });
    }
    return candidates;
  }

  function findLastKey(segments, start, end, key) {
    for (let i = start; i >= end; i--) {
      if (segments[i].key === key) return i;
    }
    return -1;
  }

  function findFirstKey(segments, start, end, key) {
    for (let i = start; i <= end; i++) {
      if (segments[i].key === key) return i;
    }
    return -1;
  }

  function isInUrlQuery(segments, u, limit) {
    const prefix = joinUrlSegments(segments, u, limit);
    return prefix.indexOf("#") === -1 && prefix.indexOf("?") !== -1;
  }

  function findBareAuthorityMinEnd(segments, u) {
    const first = segments[u].value;
    const scheme = /^\s*https?:\/\//i.exec(first);
    if (!scheme) return u + 1;
    for (let i = scheme[0].length; i < first.length; i++) {
      const ch = first[i];
      if (ch === "/" || ch === "?" || ch === "#" || ch === "@") return u + 1;
    }
    for (let i = u + 1; i < segments.length; i++) {
      const { text, key, value } = segments[i];
      if (key !== "url" && KNOWN_KEYS.has(key) && isValidTrailingArgValue(key, value)) return u + 1;
      for (let j = 0; j < text.length; j++) {
        const ch = text[j];
        if (ch === "/" || ch === "?" || ch === "#") return u + 1;
        if (ch === "@") return i + 1;
      }
    }
    return u + 1;
  }

  function isValidModuleExtraValue(key, rawValue) {
    if (key === "expire") {
      const value = normalizeArgValue(key, rawValue);
      return !value || /^(?:false|\d{4}[-/]\d{1,2}[-/]\d{1,2})$/i.test(value) || STRICT_NON_NEGATIVE_NUM.test(value);
    }
    return isValidTrailingArgValue(key, rawValue);
  }

  function isValidModuleExtrasRange(segments, start, beforeKeys) {
    const seen = new Set();
    let currentKey = "";
    let currentValue = "";
    for (let i = start; i < segments.length; i++) {
      const { text, key, value } = segments[i];
      if (!text) continue;
      if (key !== "url" && KNOWN_KEYS.has(key)) {
        if (currentKey && !isValidModuleExtraValue(currentKey, currentValue)) return false;
        if (!MODULE_EXTRAS.has(key) || beforeKeys.has(key) || seen.has(key)) return false;
        seen.add(key);
        currentKey = key;
        currentValue = value;
      } else {
        if (currentKey !== "policy") return false;
        currentValue += "&" + text;
      }
    }
    return !currentKey || isValidModuleExtraValue(currentKey, currentValue);
  }

  function findModuleTail(segments, beforeKeys, minStart) {
    if (MODULE_KEYS.some((key) => beforeKeys.has(key))) return null;
    let co = -1;
    let tailEnd = -1;
    // 优先严格匹配：允许 color 后存在数字 expire 及含 & 的 policy
    for (let i = segments.length - 1; i >= minStart + 3; i--) {
      if (segments[i].key !== "color") continue;
      if (isValidModuleExtrasRange(segments, i + 1, beforeKeys)) {
        co = i;
        tailEnd = i + 1;
        break;
      }
    }
    // 严格匹配未命中时回退至容错切分，避免尾随 &、未知参数或非法 extra 值导致整个模板失配
    if (co === -1) {
      tailEnd = segments.length;
      const extraSeen = new Set();
      while (tailEnd > minStart + 3) {
        const { key, value } = segments[tailEnd - 1];
        if (!MODULE_EXTRAS.has(key) || beforeKeys.has(key) || extraSeen.has(key) ||
            !isValidModuleExtraValue(key, value)) {
          break;
        }
        extraSeen.add(key);
        tailEnd--;
      }
      co = findLastKey(segments, tailEnd - 1, minStart + 3, "color");
      if (co === -1) return null;
    }
    const ic = findLastKey(segments, co - 1, minStart + 2, "icon");
    if (ic === -1) return null;
    const tLast = findLastKey(segments, ic - 1, minStart + 1, "title");
    if (tLast === -1) return null;
    return { tLast, ic, co, tailEnd };
  }

  function matchModuleTemplate(segments, u, beforeKeys, fixedStart, minStart) {
    const tail = findModuleTail(segments, beforeKeys, minStart);
    if (!tail) return null;
    let r = fixedStart;
    if (r !== -1) {
      if (r >= tail.tLast || segments[r].key !== "reset_day") return null;
    } else {
      const rFirst = findFirstKey(segments, minStart, tail.tLast - 1, "reset_day");
      if (rFirst === -1) return null;
      r = isInUrlQuery(segments, u, rFirst) ? findLastKey(segments, tail.tLast - 1, rFirst, "reset_day") : rFirst;
    }
    const t = findFirstKey(segments, r + 1, tail.tLast, "title");
    return { r, t, ic: tail.ic, co: tail.co, tailEnd: tail.tailEnd };
  }

  function findBareUrlEnd(segments, u, beforeKeys, minEnd) {
    const seen = new Set(beforeKeys);
    let end = segments.length;
    while (end > minEnd) {
      const { key, value } = segments[end - 1];
      if (key === "url" || !KNOWN_KEYS.has(key) || seen.has(key) || !isValidTrailingArgValue(key, value)) break;
      if (key === "title" && isSecretTrailingTitle(value, joinUrlSegments(segments, u, end - 1))) break;
      seen.add(key);
      end--;
    }
    return end;
  }

  function matchBareUrl(segments, u, beforeKeys, minEnd) {
    const template = matchModuleTemplate(segments, u, beforeKeys, -1, minEnd);
    return { template, end: template ? template.r : findBareUrlEnd(segments, u, beforeKeys, minEnd) };
  }

  function parseArgs(argumentStr) {
    if (typeof argumentStr !== "string") return {};
    const trimmed = argumentStr.trim();
    if (!trimmed) return {};

    const args = {};
    const segments = trimmed.split("&").map((text) => {
      const eq = text.indexOf("=");
      return { text, key: eq > 0 ? text.slice(0, eq).toLowerCase() : "", value: eq > 0 ? text.slice(eq + 1) : text };
    });
    const urlIndex = segments.findIndex((segment) => segment.key === "url");

    function readArgs(start, end) {
      let current = "";
      for (let i = start; i < end; i++) {
        const { text, key, value } = segments[i];
        if (!text) continue;
        if (key !== "url" && KNOWN_KEYS.has(key)) {
          current = key;
          args[key] = value;
        } else if (current) {
          args[current] += "&" + text;
        }
      }
    }

    function readModuleExtras(start, end, beforeKeys) {
      let current = "";
      for (let i = start; i < end; i++) {
        const { text, key, value } = segments[i];
        if (MODULE_EXTRAS.has(key) && !beforeKeys.has(key)) {
          current = key;
          args[key] = value;
        } else if (key !== "" && (key === "url" || KNOWN_KEYS.has(key))) {
          current = "";
        } else if (current === "policy" && text) {
          args[current] += "&" + text;
        }
      }
    }

    readArgs(0, urlIndex < 0 ? segments.length : urlIndex);
    if (urlIndex >= 0) {
      const beforeKeys = new Set(Object.keys(args));
      const quoted = findQuotedUrlCandidates(segments, urlIndex);
      let end = -1;
      let template = null;
      if (quoted.length) {
        const tail = findModuleTail(segments, beforeKeys, urlIndex + 1);
        let selectedR = -1;
        if (tail) {
          for (const candidate of quoted) {
            if (candidate.end >= tail.tLast) break;
            if (segments[candidate.end].key !== "reset_day") continue;
            if (candidate.even) {
              selectedR = candidate.end;
              break;
            }
            if (selectedR === -1) selectedR = candidate.end;
          }
          if (selectedR !== -1) {
            const t = findFirstKey(segments, selectedR + 1, tail.tLast, "title");
            template = { r: selectedR, t, ic: tail.ic, co: tail.co, tailEnd: tail.tailEnd };
          }
        }
        if (!template) {
          end = quoted[0].end;
          for (const candidate of quoted) {
            if (candidate.even) {
              end = candidate.end;
              break;
            }
          }
        }
      } else if (ENCODED_HTTP.test(segments[urlIndex].value.trim())) {
        end = urlIndex + 1;
        template = matchModuleTemplate(segments, urlIndex, beforeKeys, end, end);
      } else {
        const minEnd = findBareAuthorityMinEnd(segments, urlIndex);
        let plan = matchBareUrl(segments, urlIndex, beforeKeys, minEnd);
        if (minEnd > urlIndex + 1 && !normalizeSubscriptionUrl(joinUrlSegments(segments, urlIndex, plan.end)).ok) {
          plan = matchBareUrl(segments, urlIndex, beforeKeys, urlIndex + 1);
        }
        template = plan.template;
        end = plan.end;
      }
      if (template) {
        const { r, t, ic, co, tailEnd } = template;
        args.url = joinUrlSegments(segments, urlIndex, r);
        args.reset_day = joinUrlSegments(segments, r, t);
        args.title = joinUrlSegments(segments, t, ic);
        args.icon = joinUrlSegments(segments, ic, co);
        if (tailEnd === co + 1) {
          args.color = segments[co].value;
          readArgs(tailEnd, segments.length);
        } else if (isValidTrailingArgValue("color", segments[co].value)) {
          args.color = segments[co].value;
          readModuleExtras(co + 1, segments.length, beforeKeys);
        } else {
          args.color = joinUrlSegments(segments, co, tailEnd);
          readArgs(tailEnd, segments.length);
        }
      } else {
        args.url = joinUrlSegments(segments, urlIndex, end);
        readArgs(end, segments.length);
      }
    }

    for (const key of Object.keys(args)) {
      if (key === "url") continue;
      args[key] = normalizeArgValue(key, args[key]);
    }
    return args;
  }

  function isValidIPv4(address) {
    const octets = address.split(".");
    return octets.length === 4 && octets.every((octet) => /^(?:0|[1-9]\d{0,2})$/.test(octet) && Number(octet) <= 255);
  }

  function isValidIPv6(address) {
    const halves = address.split("::");
    if (halves.length > 2) return false;
    const compressed = halves.length === 2;
    let groups = 0;
    for (let i = 0; i < halves.length; i++) {
      if (compressed && halves[i] === "") continue;
      const parts = halves[i].split(":");
      for (let j = 0; j < parts.length; j++) {
        const part = parts[j];
        if (i === halves.length - 1 && j === parts.length - 1 && part.indexOf(".") !== -1) {
          if (!isValidIPv4(part)) return false;
          groups += 2;
        } else {
          if (!/^[0-9a-f]{1,4}$/i.test(part)) return false;
          groups++;
        }
      }
    }
    return compressed ? groups < 8 : groups === 8;
  }

  function isValidDnsHost(host) {
    const name = host.endsWith(".") ? host.slice(0, -1) : host;
    if (name.length < 1 || name.length > 253) return false;
    const labels = name.split(".");
    if (labels.length > 1 && /^\d+$/.test(labels[labels.length - 1])) return false;
    return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
  }

  function parseAndValidateAuthority(authority) {
    const at = authority.indexOf("@");
    if (at === 0 || at !== authority.lastIndexOf("@")) return null;
    const userinfo = at === -1 ? null : authority.slice(0, at);
    if (userinfo !== null && /[\[\]]/.test(userinfo)) return null;
    const hostPort = authority.slice(at + 1);
    if (!hostPort) return null;

    let port = null;
    if (hostPort[0] === "[") {
      const close = hostPort.indexOf("]");
      if (close <= 1 || !isValidIPv6(hostPort.slice(1, close))) return null;
      const after = hostPort.slice(close + 1);
      if (after) {
        if (after[0] !== ":") return null;
        port = after.slice(1);
      }
    } else {
      if (/[\[\]]/.test(hostPort)) return null;
      const colon = hostPort.indexOf(":");
      if (colon !== hostPort.lastIndexOf(":")) return null;
      const host = colon === -1 ? hostPort : hostPort.slice(0, colon);
      if (/^[0-9.]+$/.test(host) ? !isValidIPv4(host) : !isValidDnsHost(host)) return null;
      if (colon !== -1) port = hostPort.slice(colon + 1);
    }
    if (port !== null && (!/^[1-9]\d{0,4}$/.test(port) || Number(port) > 65535)) return null;
    return { userinfo, hostPort };
  }

  function sanitizeUrlPart(part, allowedPattern) {
    return part.replace(/%[0-9a-fA-F]{2}|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\s\S]/g, (token) => {
      if (token.length === 3 || allowedPattern.test(token)) return token;
      try {
        return encodeURIComponent(token);
      } catch (error) {
        if (error instanceof URIError) return "%EF%BF%BD";
        throw error;
      }
    });
  }

  function subscriptionUrlText(rawUrl) {
    return stripPairedQuotes(String(rawUrl || "").trim()).trim();
  }

  function buildDecodeBoundaryMap(source, full) {
    const starts = [];
    let i = 0;
    while (i < source.length) {
      starts.push(i);
      if (source.charCodeAt(i) !== 37) {
        i++;
        continue;
      }
      const lead = parseInt(source.slice(i + 1, i + 3), 16);
      const bytes = lead < 0x80 ? 1 : lead >= 0xF0 ? 4 : lead >= 0xE0 ? 3 : 2;
      if (bytes === 4) starts.push(-1);
      i += 3 * bytes;
    }
    starts.push(source.length);
    if (starts.length !== full.length + 1) return null;
    return starts;
  }

  function decodeUrlLayersWithMaps(initial) {
    const layers = [initial];
    const maps = [];
    let url = initial;
    for (let depth = 0; depth < 2 && ENCODED_HTTP.test(url); depth++) {
      const full = safeDecodeParam(url);
      const decoded = full.trim();
      if (decoded === url) break;
      maps.push(buildDecodeBoundaryMap(url, full));
      layers.push(decoded);
      url = decoded;
    }
    return { layers, maps };
  }

  function decodeUrlLayers(initial) {
    return decodeUrlLayersWithMaps(initial).layers;
  }

  // maps[m] 把第 m+1 层下标映射到第 m 层。
  function mapToLayer(maps, fromLayer, toLayer, index) {
    let j = index;
    for (let m = fromLayer - 1; m >= toLayer && j >= 0; m--) j = maps[m] && j < maps[m].length ? maps[m][j] : -1;
    return j;
  }

  function normalizeSubscriptionUrl(rawUrl) {
    const raw = subscriptionUrlText(rawUrl);
    if (!raw || raw === DEFAULT_TITLE) return { ok: false, code: "EMPTY" };
    const layers = decodeUrlLayers(raw);
    const url = layers[layers.length - 1];
    if (CONTROL_CHARS.test(url)) return { ok: false, code: "INVALID_URL" };
    const parts = /^(https?):\/\/([^/\s?#]+)([\s\S]*)$/i.exec(url);
    if (!parts || (parts[3] && "/?#".indexOf(parts[3][0]) === -1)) return { ok: false, code: "INVALID_URL" };
    const authority = parseAndValidateAuthority(parts[2]);
    if (!authority) return { ok: false, code: "INVALID_URL" };
    const credentials = authority.userinfo === null ? "" : sanitizeUrlPart(authority.userinfo, USERINFO_CHAR) + "@";
    const rest = sanitizeUrlPart(parts[3], URL_REST_CHAR);
    return { ok: true, url: `${parts[1].toLowerCase()}://${credentials}${authority.hostPort}${rest}` };
  }

  function stripUrlFragment(url) {
    const hashIndex = url.indexOf("#");
    return hashIndex < 0 ? url : url.slice(0, hashIndex);
  }

  function isNonFlagParam(param) {
    if (!param) return false;
    const eq = param.indexOf("=");
    const key = eq < 0 ? param : param.slice(0, eq);
    return safeDecodeParam(key.replace(/\+/g, " ")).toLowerCase() !== "flag";
  }

  function buildUrl(base, flag) {
    if (!flag) return base;
    const withoutHash = stripUrlFragment(base);
    const hash = base.slice(withoutHash.length);
    const queryIndex = withoutHash.indexOf("?");
    const path = queryIndex < 0 ? withoutHash : withoutHash.slice(0, queryIndex);
    const params = queryIndex < 0 ? [] : withoutHash.slice(queryIndex + 1).split("&").filter(isNonFlagParam);
    params.push(`flag=${encodeURIComponent(flag)}`);
    return `${path}?${params.join("&")}${hash}`;
  }

  function hashStringSeed(value, seed) {
    let hash = seed >>> 0;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 2246822507);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 3266489909);
    hash ^= hash >>> 16;
    return (hash >>> 0).toString(36);
  }

  function fingerprint(value) {
    return [value.length.toString(36)].concat(HASH_SEEDS.map((seed) => hashStringSeed(value, seed)));
  }

  function cacheDescriptor(url) {
    const parts = fingerprint(stripUrlFragment(url));
    return { key: CACHE_PREFIX + parts[1], id: parts.join("_") };
  }

  function isCacheId(id, key) {
    return typeof id === "string" && FINGERPRINT.test(id) && key === CACHE_PREFIX + id.split("_")[1];
  }

  function storageRead(key) {
    let raw;
    try {
      raw = $persistentStore.read(key);
    } catch (_) {
      return { status: "error" };
    }
    if (raw == null || raw === "") return { status: "missing" };
    if (typeof raw !== "string") return { status: "corrupt" };
    try {
      return { status: "ok", value: JSON.parse(raw) };
    } catch (_) {
      return { status: "corrupt" };
    }
  }

  function storageWrite(key, value) {
    if (value === null) {
      try {
        if ($persistentStore.write(null, key) === true) return true;
      } catch (_) {}
      try {
        return $persistentStore.write("", key) === true;
      } catch (_) {
        return false;
      }
    }
    try {
      return $persistentStore.write(JSON.stringify(value), key) === true;
    } catch (_) {
      return false;
    }
  }

  function validatedCacheData(data) {
    if (!data || !Number.isFinite(data.used) || data.used < 0 ||
        !Number.isFinite(data.totalBytes) || data.totalBytes <= 0 ||
        !Number.isFinite(data.percent) || data.percent < 0 ||
        (data.expire !== null && (!Number.isFinite(data.expire) || data.expire < 0))) return null;
    const { used, totalBytes, expire } = data;
    const percent = (used / totalBytes) * 100;
    if (!Number.isFinite(percent) || Math.abs(data.percent - percent) > Math.max(1e-6, percent * 1e-9)) return null;
    return { used, totalBytes, percent, expire };
  }

  function isValidSeq(seq) {
    return Number.isInteger(seq) && seq >= 1 && seq < MAX_CACHE_SEQ;
  }

  function readBucket(key, nowMs) {
    const { status, value: bucket } = storageRead(key);
    const entries = new Map();
    if (status === "error") return { ok: false, entries, dirty: false };
    if (status === "missing") return { ok: true, entries, dirty: false };
    if (!bucket || bucket.v !== 1 || !Array.isArray(bucket.entries)) return { ok: true, entries, dirty: true };

    let dirty = bucket.entries.length === 0;
    for (const entry of bucket.entries) {
      if (!entry || !isCacheId(entry.id, key) || !Number.isFinite(entry.time) ||
          entry.time - nowMs > CLOCK_SKEW_TOLERANCE_MS || nowMs - entry.time >= MAX_STALE_MS ||
          !isValidSeq(entry.seq) ||
          (entry.strategy !== null && !STRATEGY_IDS.has(entry.strategy))) {
        dirty = true;
        continue;
      }
      const data = validatedCacheData(entry.data);
      if (!data) {
        dirty = true;
        continue;
      }
      const { id, time, seq, strategy } = entry;
      const previous = entries.get(id);
      if (previous) dirty = true;
      if (!previous || time > previous.time || (time === previous.time && seq >= previous.seq)) {
        entries.set(id, { id, time, seq, strategy, data });
      }
    }
    return { ok: true, entries, dirty };
  }

  function writeBucket(key, entries) {
    return storageWrite(key, entries.size ? { v: 1, entries: Array.from(entries.values()) } : null);
  }

  function readCache(descriptor, nowMs) {
    const { ok, entries, dirty } = readBucket(descriptor.key, nowMs);
    if (!ok) return { ok: false, entry: null };
    if (dirty) writeBucket(descriptor.key, entries);
    return { ok: true, entry: entries.get(descriptor.id) || null };
  }

  function removeCache(key, id, nowMs) {
    const { ok, entries, dirty } = readBucket(key, nowMs);
    if (!ok) return false;
    return entries.delete(id) || dirty ? writeBucket(key, entries) : true;
  }

  function saveCache(descriptor, data, strategy, startedAt, baseSeq, finishedAt) {
    if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt) ||
        startedAt - finishedAt > CLOCK_SKEW_TOLERANCE_MS || finishedAt - startedAt >= MAX_STALE_MS) return false;
    const { key, id } = descriptor;
    const { ok, entries, dirty } = readBucket(key, finishedAt);
    if (!ok) return false;
    const existing = entries.get(id);
    const isSameMs = existing && startedAt === existing.time;
    if (!existing || startedAt > existing.time || (isSameMs && existing.seq <= baseSeq)) {
      const nextSeq = isSameMs ? existing.seq + 1 : 1;
      if (!isValidSeq(nextSeq)) return !dirty || writeBucket(key, entries);
      entries.set(id, { id, time: startedAt, seq: nextSeq, strategy, data });
      return writeBucket(key, entries);
    }
    return !dirty || writeBucket(key, entries);
  }

  function panelSlotId(panelName, title) {
    if (typeof panelName === "string" && panelName.trim()) return `p:${panelName}`;
    return typeof title === "string" && title.trim() ? `t:${title}` : "";
  }

  function emptyState(freezeUntil) {
    return { v: 1, slots: {}, pending: [], freezeUntil };
  }

  function collectActiveProtection(slots, nowMs) {
    const activeProtectedUntil = new Map();
    for (const hash of Object.keys(slots)) {
      const record = slots[hash];
      if (!isActiveSlot(record, nowMs)) continue;
      const until = record.t + ORPHAN_SLOT_TTL_MS;
      const previous = activeProtectedUntil.get(record.i);
      if (previous === undefined || until > previous) activeProtectedUntil.set(record.i, until);
    }
    return activeProtectedUntil;
  }

  function normalizePending(items, nowMs, activeProtectedUntil) {
    const maxAfter = nowMs + RETIRE_GRACE_MS;
    const order = [];
    const byId = new Map();
    let changed = false;
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (!item || !isCacheId(item.i, item.k)) {
        changed = true;
        continue;
      }
      let after = item.a;
      if (after === undefined) {
        after = nowMs;
        changed = true;
      } else if (!Number.isFinite(after) || after < 0) {
        changed = true;
        continue;
      } else if (after > maxAfter) {
        after = maxAfter;
        changed = true;
      }
      const previous = byId.get(item.i);
      if (previous) {
        previous.a = Math.max(previous.a, after);
        changed = true;
      } else {
        const normalized = { k: item.k, i: item.i, a: after };
        order.push(normalized);
        byId.set(item.i, normalized);
      }
    }
    if (order.length <= MAX_PENDING_CLEANUPS) return { items: order.reverse(), changed };

    const kept = new Set();
    for (let tier = 0; tier < 3 && kept.size < MAX_PENDING_CLEANUPS; tier++) {
      for (let i = 0; i < order.length && kept.size < MAX_PENDING_CLEANUPS; i++) {
        const item = order[i];
        const until = activeProtectedUntil.get(item.i);
        let itemTier = 2;
        if (nowMs < item.a) itemTier = until !== undefined && until < item.a ? 0 : 1;
        if (itemTier === tier) kept.add(item);
      }
    }
    return { items: order.filter((item) => kept.has(item)).reverse(), changed: true };
  }

  function readState(nowMs) {
    const { status, value: raw } = storageRead(STATE_KEY);
    if (status === "error") return { ok: false };
    if (status === "missing") return { ok: true, state: emptyState(0), dirty: false };
    const limit = nowMs + ORPHAN_SLOT_TTL_MS;
    if (!raw || raw.v !== 1 || !raw.slots || typeof raw.slots !== "object" || Array.isArray(raw.slots) ||
        !Array.isArray(raw.pending) || !Number.isFinite(raw.freezeUntil) || raw.freezeUntil < 0) {
      return { ok: true, state: emptyState(limit), dirty: true };
    }

    const state = emptyState(Math.min(raw.freezeUntil, limit));
    let dirty = state.freezeUntil !== raw.freezeUntil;
    for (const hash of Object.keys(raw.slots)) {
      const slot = raw.slots[hash];
      if (!FINGERPRINT.test(hash) || !slot || !isCacheId(slot.i, slot.k) ||
          !Number.isFinite(slot.t) || slot.t < 0) {
        state.freezeUntil = limit;
        dirty = true;
        continue;
      }
      const { k, i } = slot;
      const t = Math.min(slot.t, nowMs);
      if (slot.t - nowMs > CLOCK_SKEW_TOLERANCE_MS) dirty = true;
      state.slots[hash] = { k, i, t };
    }
    const activeProtectedUntil = collectActiveProtection(state.slots, nowMs);
    const pendingNorm = normalizePending(raw.pending, nowMs, activeProtectedUntil);
    state.pending = pendingNorm.items;
    dirty = dirty || pendingNorm.changed || Object.keys(state.slots).length > MAX_TRACKED_SLOTS;
    return { ok: true, state, dirty };
  }

  function isActiveSlot(record, nowMs) {
    return nowMs - record.t < ORPHAN_SLOT_TTL_MS;
  }

  function syncSlot(slot, descriptor, nowMs) {
    const { ok, state, dirty } = readState(nowMs);
    if (!ok) return { ok: false };
    const previous = state.slots[slot];
    const changed = previous && previous.i !== descriptor.id;
    const needsSlotWrite = !previous || changed || nowMs - previous.t >= SLOT_HEARTBEAT_MS;
    const frozen = state.freezeUntil > nowMs;
    const canUnfreeze = state.freezeUntil > 0 && !frozen;
    const hasDuePending = !frozen && state.pending.some((item) => nowMs >= item.a);
    if (!needsSlotWrite && !dirty && !canUnfreeze && !hasDuePending) return { ok: true };

    let needsWrite = dirty || needsSlotWrite || canUnfreeze;
    const deleteAfter = nowMs + RETIRE_GRACE_MS;
    if (needsSlotWrite) {
      state.slots[slot] = { k: descriptor.key, i: descriptor.id, t: nowMs };
      if (changed) state.pending.push({ k: previous.k, i: previous.i, a: deleteAfter });
    }

    function retire(hash, after) {
      const { k, i } = state.slots[hash];
      state.pending.push({ k, i, a: after });
      delete state.slots[hash];
      needsWrite = true;
    }

    if (!frozen) {
      state.freezeUntil = 0;
      for (const hash of Object.keys(state.slots)) {
        if (hash !== slot && !isActiveSlot(state.slots[hash], nowMs)) retire(hash, nowMs);
      }
    }
    const hashes = Object.keys(state.slots);
    const excess = hashes.length - MAX_TRACKED_SLOTS;
    if (excess > 0) {
      const oldest = hashes.filter((hash) => hash !== slot).sort((a, b) => state.slots[a].t - state.slots[b].t);
      for (const hash of oldest.slice(0, excess)) retire(hash, deleteAfter);
    }

    const activeProtectedUntil = collectActiveProtection(state.slots, nowMs);
    const filteredPending = state.pending.filter((item) => {
      const until = activeProtectedUntil.get(item.i);
      return until === undefined || until < item.a;
    });
    const normalizedPending = normalizePending(filteredPending, nowMs, activeProtectedUntil);
    if (filteredPending.length !== state.pending.length || normalizedPending.changed) needsWrite = true;
    state.pending = normalizedPending.items;
    // 先提交引用和待删队列，再操作数据桶。
    if (needsWrite && !storageWrite(STATE_KEY, state)) return { ok: false };

    if (!frozen && state.pending.length) {
      const remaining = state.pending.filter((item) =>
        activeProtectedUntil.has(item.i) || nowMs < item.a || !removeCache(item.k, item.i, nowMs));
      if (remaining.length !== state.pending.length) {
        state.pending = remaining;
        storageWrite(STATE_KEY, state);
      }
    }
    return { ok: true };
  }

  function shouldSaveCache(slot, descriptor, nowMs) {
    if (!slot) return true;
    const { ok, state } = readState(nowMs);
    if (!ok) return false;
    const current = state.slots[slot];
    if (!current) {
      return syncSlot(slot, descriptor, nowMs).ok;
    }
    if (current.i === descriptor.id && isActiveSlot(current, nowMs)) return true;
    return Object.keys(state.slots).some((hash) => {
      const record = state.slots[hash];
      return record.i === descriptor.id && isActiveSlot(record, nowMs);
    });
  }

  function getRequestTimeoutSec(deadlineTime, method) {
    const remainingMs = deadlineTime - Date.now();
    if (remainingMs < MIN_REQUEST_TIMEOUT_MS) return 0;
    const capSec = method === "get" ? 4 : 3;
    return Math.min(capSec, Math.floor(remainingMs / 1000));
  }

  function hasUnsafePrototypeRelation(error, raw) {
    function walkFrom(start, target) {
      const seen = new Set();
      seen.add(start);
      let cur = start;
      for (let hops = 0; hops < MAX_PROTO_HOPS; hops++) {
        const proto = Object.getPrototypeOf(cur);
        if (proto === null) return false;
        if (proto === target || seen.has(proto)) return true;
        seen.add(proto);
        cur = proto;
      }
      return true;
    }
    return walkFrom(raw, error) || walkFrom(error, raw);
  }

  function normalizeRequestError(error) {
    let message;
    try {
      if (error == null) return "Network";
      if ((typeof error === "object" || typeof error === "function") && "message" in error) {
        const raw = error.message;
        if (raw == null || raw === error) return "Network";
        if ((typeof raw === "object" || typeof raw === "function") &&
            hasUnsafePrototypeRelation(error, raw)) {
          return "Network";
        }
        message = String(raw);
      } else {
        message = String(error);
      }
    } catch (_) {
      return "Network";
    }
    if (/timeout|timed out|超时|逾時/i.test(message)) return "Timeout";
    if (/dns|hostname could not be found|cannot find host|host not found|enotfound|nxdomain|(?:找不|未能找)到.*主机|无法解析.*(?:域名|主机|服务器)|無法解析.*(?:網域|主機|伺服器)|域名解析|網域解析/i.test(message)) return "DNS Error";
    return "Network";
  }

  function getUserInfoHeader(headers) {
    if (!headers || typeof headers !== "object") return null;
    const parts = [];
    for (const name of Object.keys(headers)) {
      if (name.toLowerCase() !== "subscription-userinfo") continue;
      const header = headers[name];
      const values = Array.isArray(header) ? header : [header];
      for (const value of values) {
        if (value != null) parts.push(value);
      }
    }
    return parts.length ? parts.join(";") : null;
  }

  function startsUserInfoEntry(trimmedToken) {
    return !trimmedToken || USERINFO_ASSIGNMENT.test(trimmedToken) || USERINFO_BARE_KEY.test(trimmedToken);
  }

  function parseUserInfo(header) {
    if (header == null) return null;
    const info = {};
    for (const clause of String(header).split(";")) {
      const tokens = clause.split(",");
      for (let i = 0; i < tokens.length; i++) {
        const first = tokens[i].trim();
        if (!first) continue;
        const eq = first.indexOf("=");
        if (eq < 0) {
          if (TRAFFIC_KEYS.has(first.toLowerCase())) return null;
          continue;
        }
        let rawValue = first.slice(eq + 1);
        while (i + 1 < tokens.length && !startsUserInfoEntry(tokens[i + 1].trim())) {
          rawValue += "," + tokens[++i];
        }
        const key = first.slice(0, eq).trim().toLowerCase();
        if (key !== "expire" && !TRAFFIC_KEYS.has(key)) continue;
        rawValue = rawValue.trim();
        if (key === "expire" && (!rawValue || /^(?:null|none)$/i.test(rawValue))) continue;
        const value = STRICT_NON_NEGATIVE_NUM.test(rawValue) ? Number(rawValue) : NaN;
        if (!Number.isFinite(value) || value < 0) {
          if (key === "expire") continue;
          return null;
        }
        info[key] = value;
      }
    }
    return Object.keys(info).length ? info : null;
  }

  async function requestStrategy(url, strategy, timeout, policy) {
    const headers = { "User-Agent": strategy.ua };
    if (strategy.accept) headers.Accept = strategy.accept;
    const options = { url: stripUrlFragment(buildUrl(url, strategy.flag)), headers, timeout };
    if (policy) options.policy = policy;

    let response;
    try {
      const resultBox = await new Promise((resolve, reject) => {
        let settled = false;
        const timer = typeof setTimeout === "function"
          ? setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error("Timeout"));
          }, Math.max(1000, timeout * 1000 + 250))
          : null;
        const cancelTimer = () => {
          if (timer !== null && typeof clearTimeout === "function") clearTimeout(timer);
        };
        try {
          $httpClient[strategy.method](options, (error, result) => {
            if (settled) return;
            settled = true;
            cancelTimer();
            if (error !== null && error !== undefined && error !== "" && error !== false) {
              reject(error);
            } else {
              // Promise 只检查包装对象的 then，宿主响应留到 await 后读取。
              const box = Object.create(null);
              box.response = result;
              resolve(box);
            }
          });
        } catch (error) {
          if (!settled) {
            settled = true;
            cancelTimer();
            reject(error);
          }
        }
      });
      response = resultBox.response;
    } catch (error) {
      return { error: normalizeRequestError(error) };
    }

    let info;
    try {
      let rawStatus;
      if (response != null) {
        rawStatus = response.status;
        if (rawStatus === undefined) rawStatus = response.statusCode;
      }
      const status = Number(rawStatus);
      if (!Number.isInteger(status) || status < 100 || status >= 600) return { error: "Network" };
      if (status < 200 || status >= 300) return { error: `HTTP ${status}` };
      info = parseUserInfo(getUserInfoHeader(response.headers));
    } catch (_) {
      return { error: "Network" };
    }
    if (!info || !(info.total > 0)) return { error: "No Data" };
    const used = (info.upload || 0) + (info.download || 0);
    const percent = (used / info.total) * 100;
    if (!Number.isFinite(used) || !Number.isFinite(percent)) return { error: "No Data" };
    const expire = typeof info.expire === "number" ? info.expire : null;
    return { data: { used, totalBytes: info.total, percent, expire } };
  }

  async function fetchSubscription(url, args, preferred, deadlineTime) {
    const method = typeof args.method === "string" ? args.method.toLowerCase() : "";
    const strategies = STRATEGIES.filter(
      (strategy) => (method !== "head" && method !== "get") || strategy.method === method
    );
    const preferredIndex = strategies.findIndex((strategy) => strategy.id === preferred);
    if (preferredIndex > 0) strategies.unshift(strategies.splice(preferredIndex, 1)[0]);

    let lastError = "";
    let skipRemainingHead = false;
    const hasGetFallback = strategies.some((strategy) => strategy.method === "get");
    for (const strategy of strategies) {
      if (skipRemainingHead && strategy.method === "head") continue;
      const timeout = getRequestTimeoutSec(deadlineTime, strategy.method);
      if (!timeout) break;
      const result = await requestStrategy(url, strategy, timeout, args.policy);
      if (result.data) return { data: result.data, strategy: strategy.id };
      lastError = result.error;
      if (lastError === "DNS Error") break;
      if (strategy.method === "head" && (
        hasGetFallback
          ? HEAD_SKIP_ERRORS.has(lastError)
          : (lastError === "HTTP 405" || lastError === "HTTP 501")
      )) {
        skipRemainingHead = true;
      }
    }
    return { error: lastError || "Timeout" };
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0B";
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < UNITS.length - 1) {
      value /= 1024;
      unit++;
    }
    const useDecimal = unit > 0 && (value < 10 || (unit >= 3 && value < 100));
    let rounded = useDecimal ? Number(value.toFixed(1)) : Math.round(value);
    if (rounded >= 1024 && unit < UNITS.length - 1) {
      rounded = 1;
      unit++;
    }
    return `${rounded}${UNITS[unit]}`;
  }

  function formatDataAge(ageMs) {
    if (!Number.isFinite(ageMs) || ageMs < -CLOCK_SKEW_TOLERANCE_MS) return "缓存数据";
    const clamped = Math.max(0, ageMs);
    if (clamped < 60000) return "1分内缓存数据";
    if (clamped < 60 * 60000) return `${Math.floor(clamped / 60000)}分前缓存数据`;
    if (clamped < DAY_MS) return `${Math.floor(clamped / 3600000)}小时前缓存数据`;
    return `${Math.floor(clamped / DAY_MS)}天前缓存数据`;
  }

  function parseResetDay(value) {
    return RESET_DAY_PATTERN.test(value) ? Number(value) : null;
  }

  function padZero(value, length) {
    let text = String(value);
    while (text.length < length) text = "0" + text;
    return text;
  }

  function getRemainingDays(resetDay, now) {
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();
    // Date.UTC 会把 0–99 年解释为 1900–1999。四百年平移保持相同闰年周期。
    const calendarYear = year >= 0 && year < 100 ? year + 400 : year;
    const monthDays = (offset) => new Date(Date.UTC(calendarYear, month + offset + 1, 0)).getUTCDate();
    const thisMonth = Math.min(resetDay, monthDays(0));
    const offset = today > thisMonth ? 1 : 0;
    const target = offset ? Math.min(resetDay, monthDays(1)) : thisMonth;
    return (Date.UTC(calendarYear, month + offset, target) - Date.UTC(calendarYear, month, today)) / DAY_MS;
  }

  function isGregorianLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  function daysInGregorianMonth(year, month) {
    if (month === 2) return isGregorianLeapYear(year) ? 29 : 28;
    if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
    return 31;
  }

  function parseCalendarDateOverride(value) {
    if (typeof value !== "string") return null;
    const ymd = DATE_OVERRIDE.exec(value);
    if (!ymd) return null;
    const year = Number(ymd[1]);
    const month = Number(ymd[3]);
    const day = Number(ymd[4]);
    if (month < 1 || month > 12 || day < 1 || day > daysInGregorianMonth(year, month)) {
      return { valid: false };
    }
    return { valid: true, year, month, day };
  }

  function parseExpirationMs(value) {
    if (value == null || value === "") return NaN;
    if (typeof value === "string" && !STRICT_NON_NEGATIVE_NUM.test(value)) return NaN;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return NaN;
    return number < 1e12 ? number * 1000 : number;
  }

  function getExpireState(override, remoteExpire, nowMs) {
    if (override && override.toLowerCase() === "false") return { text: "", expired: false };
    const hasOverride = override !== undefined && override !== "";
    if (!hasOverride && (remoteExpire == null || remoteExpire === "")) {
      return { text: "永久有效", expired: false };
    }
    const raw = hasOverride ? override : remoteExpire;
    const cal = parseCalendarDateOverride(raw);
    if (cal) {
      if (!cal.valid) return { text: "有效期未知", expired: false };
      const dateText = `${padZero(cal.year, 4)}-${padZero(cal.month, 2)}-${padZero(cal.day, 2)}`;
      const now = new Date(nowMs);
      if (!Number.isFinite(now.getTime())) return { text: dateText, expired: false };
      const nowYear = now.getFullYear();
      const nowMonth = now.getMonth() + 1;
      const nowDay = now.getDate();
      const expired = nowYear > cal.year ||
        (nowYear === cal.year && (nowMonth > cal.month || (nowMonth === cal.month && nowDay > cal.day)));
      return { text: expired ? `已过期 (${dateText})` : dateText, expired };
    }
    const time = parseExpirationMs(raw);
    if (time === 0) return { text: "永久有效", expired: false };
    const date = new Date(time);
    if (!Number.isFinite(date.getTime())) return { text: "有效期未知", expired: false };
    const year = padZero(date.getFullYear(), 4);
    const month = padZero(date.getMonth() + 1, 2);
    const day = padZero(date.getDate(), 2);
    const dateText = `${year}-${month}-${day}`;
    if (!Number.isFinite(new Date(nowMs).getTime())) return { text: dateText, expired: false };
    const expired = date.getTime() < nowMs;
    return { text: expired ? `已过期 (${dateText})` : dateText, expired };
  }

  function getUsageColor(percent) {
    if (percent >= 95) return RED;
    if (percent >= 80) return ORANGE;
    if (percent >= 50) return "#D14FE2";
    return "#34C759";
  }

  function panel(title, content, icon, color) {
    return { title, content, icon, "icon-color": color };
  }

  function errorLabel(error) {
    switch (error) {
      case "Timeout": return "请求超时";
      case "DNS Error": return "DNS 解析失败";
      case "No Data": return "响应头不含有效流量信息";
      case "Network": return "网络连接失败";
      default: return error;
    }
  }

  function getUrlSecretParts(url) {
    const endpoint = stripUrlFragment(String(url || "").trim());
    const question = endpoint.indexOf("?");
    const query = question === -1 ? "" : endpoint.slice(question + 1);
    const head = (question === -1 ? endpoint : endpoint.slice(0, question))
      .replace(/^["']?([a-z][a-z\d+.-]*:)?\/\//i, "");
    const slash = head.indexOf("/");
    const authority = slash === -1 ? head : head.slice(0, slash);
    const at = authority.lastIndexOf("@");
    return {
      userinfo: at === -1 ? "" : authority.slice(0, at),
      path: slash === -1 ? "" : head.slice(slash + 1),
      query,
    };
  }

  function queryValueForms(value) {
    return [value, safeDecodeParam(value), safeDecodeParam(value.replace(/\+/g, " "))];
  }

  function userinfoFields(userinfo) {
    const colon = userinfo.indexOf(":");
    return {
      username: colon === -1 ? userinfo : userinfo.slice(0, colon),
      password: colon === -1 ? "" : userinfo.slice(colon + 1),
    };
  }

  function isAsciiWordCode(code) {
    return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) || code === 95;
  }

  function isWhitespaceAt(text, index) {
    const code = text.charCodeAt(index);
    if (code === 32 || (code >= 9 && code <= 13)) return true;
    return code >= 160 && /\s/.test(text.charAt(index));
  }

  function findAssignmentKeyBounds(text, eqIndex, minPos) {
    let end = eqIndex;
    while (end > minPos && isWhitespaceAt(text, end - 1)) end--;
    let scan = end;
    let firstWord = -1;
    while (scan > minPos) {
      const code = text.charCodeAt(scan - 1);
      if (code === 45) {
        scan--;
      } else if (isAsciiWordCode(code)) {
        scan--;
        firstWord = scan;
      } else {
        break;
      }
    }
    return firstWord === -1 ? null : { start: firstWord, end };
  }

  function findSensitiveKeyStart(text, bounds) {
    // 两种后缀都不超过八个码元。API 键分支可保留连字符前缀。
    const keyLen = bounds.end - bounds.start;
    const tail = keyLen > 8 ? text.slice(bounds.end - 8, bounds.end) : text.slice(bounds.start, bounds.end);
    if (SENSITIVE_KEY_SUFFIX.test(tail)) return bounds.start;
    const match = SENSITIVE_API_KEY_SUFFIX.exec(tail);
    if (!match) return -1;
    const start = bounds.end - match[0].length;
    return (start === bounds.start || text.charCodeAt(start - 1) === 45) ? start : -1;
  }

  function collectSensitiveAssignmentSpans(text, spans) {
    const len = text.length;
    for (let pos = 0; pos < len; ) {
      const eq = text.indexOf("=", pos);
      if (eq === -1) break;
      const bounds = findAssignmentKeyBounds(text, eq, pos);
      const matchStart = bounds ? findSensitiveKeyStart(text, bounds) : -1;
      if (matchStart === -1) {
        pos = eq + 1;
        continue;
      }
      let valueStart = eq + 1;
      while (valueStart < len && isWhitespaceAt(text, valueStart)) valueStart++;
      let valueEnd = valueStart;
      while (valueEnd < len) {
        const code = text.charCodeAt(valueEnd);
        if (code === 38 || code === 35 || code === 59 || isWhitespaceAt(text, valueEnd)) break;
        valueEnd++;
      }
      if (valueEnd === valueStart) {
        pos = valueStart < len ? valueStart + 1 : len;
        continue;
      }
      if (spans) spans.push({ start: matchStart, end: valueEnd, kind: "param" });
      else return true;
      pos = valueEnd;
    }
    return false;
  }

  function hasSecretAssignmentKey(text) {
    const len = text.length;
    for (let pos = 0; pos < len; ) {
      const eq = text.indexOf("=", pos);
      if (eq === -1) break;
      const bounds = findAssignmentKeyBounds(text, eq, pos);
      if (bounds) {
        const key = text.slice(bounds.start, bounds.end);
        if (STRONG_SECRET_QUERY_KEY.test(key) || WEAK_ID_QUERY_KEY.test(key)) return true;
      }
      pos = eq + 1;
    }
    return false;
  }

  function isSecretTrailingTitle(value, leftUrl) {
    const candidate = normalizeArgValue("title", value);
    if (!candidate) return false;
    if (/https?:\/\//i.test(candidate) || ENCODED_HTTP.test(candidate) ||
        collectSensitiveAssignmentSpans(candidate, null) || hasSecretAssignmentKey(candidate)) return true;

    const { userinfo, path, query } = getUrlSecretParts(leftUrl);
    const { username, password } = userinfoFields(userinfo);
    const matchesPart = (part) => part.trim() === candidate || safeDecodeParam(part).trim() === candidate;
    if ([userinfo, username, password].some(matchesPart)) return true;
    if (path.split("/").some((part) => !COMMON_PATH_SEGMENT.test(candidate) && matchesPart(part))) return true;
    return query.split("&").some((param) => {
      const eq = param.indexOf("=");
      return eq !== -1 && queryValueForms(param.slice(eq + 1)).some((form) => form.trim() === candidate);
    });
  }

  function foldUnit(unit) {
    return unit.toLowerCase().toUpperCase().toLowerCase().replace(/\u03C2/g, "\u03C3");
  }

  function buildCaseFolded(text) {
    let folded = "";
    const startMap = [];
    const endMap = [];
    for (let i = 0; i < text.length; ) {
      const code = text.charCodeAt(i);
      let step = 1;
      if (code >= 0xD800 && code <= 0xDBFF && i + 1 < text.length) {
        const next = text.charCodeAt(i + 1);
        if (next >= 0xDC00 && next <= 0xDFFF) step = 2;
      }
      const unit = text.slice(i, i + step);
      const out = code < 128
        ? (code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : unit)
        : foldUnit(unit);
      folded += out;
      // 一个折叠码元也映射回完整的原文字元区间。
      for (let k = 0; k < out.length; k++) {
        startMap.push(i);
        endMap.push(i + step);
      }
      i += step;
    }
    return { folded, startMap, endMap };
  }

  function compareSecretDesc(a, b) {
    return (b.length - a.length) || (a < b ? -1 : (a > b ? 1 : 0));
  }

  function pushUnique(list, value) {
    if (list.indexOf(value) === -1) list.push(value);
  }

  function addPlainUrlVariants(base, knownSet) {
    const hashIndex = base.indexOf("#");
    const hasHash = hashIndex !== -1;
    const noHash = hasHash ? base.slice(0, hashIndex) : base;
    const rawHash = hasHash ? base.slice(hashIndex) : "";
    const queryIndex = noHash.indexOf("?");
    const hasQuery = queryIndex !== -1;
    const rawHead = hasQuery ? noHash.slice(0, queryIndex + 1) : noHash;
    const rawQuery = hasQuery ? noHash.slice(queryIndex + 1) : "";

    const headForms = [rawHead];
    if (/%20/i.test(rawHead)) pushUnique(headForms, rawHead.replace(/%20/gi, " "));
    pushUnique(headForms, safeDecodeParam(rawHead));

    const queryForms = [rawQuery];
    if (hasQuery) {
      if (/%20/i.test(rawQuery)) pushUnique(queryForms, rawQuery.replace(/%20/gi, " "));
      pushUnique(queryForms, safeDecodeParam(rawQuery));
      if (rawQuery.indexOf("+") !== -1) {
        pushUnique(queryForms, rawQuery.replace(/\+|%20/gi, " "));
        pushUnique(queryForms, safeDecodeParam(rawQuery.replace(/\+/g, " ")));
      }
    }

    const hashForms = [""];
    if (hasHash) {
      pushUnique(hashForms, rawHash);
      if (/%20/i.test(rawHash)) pushUnique(hashForms, rawHash.replace(/%20/gi, " "));
      pushUnique(hashForms, safeDecodeParam(rawHash));
    }

    for (let h = 0; h < headForms.length; h++) {
      for (let q = 0; q < queryForms.length; q++) {
        const endpoint = headForms[h] + queryForms[q];
        for (let f = 0; f < hashForms.length; f++) {
          const text = (endpoint + hashForms[f]).trim();
          if (TEXT_HTTP_URL.test(text)) knownSet.add(text);
        }
      }
    }
  }

  function addKnownUrlVariants(url, knownSet) {
    if (typeof url !== "string") return;
    const base = url.trim();
    if (TEXT_HTTP_URL.test(base)) {
      addPlainUrlVariants(base, knownSet);
      return;
    }
    if (!ENCODED_HTTP.test(base)) return;
    knownSet.add(base);
    if (/%20/i.test(base)) {
      const spaced = base.replace(/%20/gi, " ").trim();
      if (ENCODED_HTTP.test(spaced)) knownSet.add(spaced);
    }
    const decoded = safeDecodeParam(base).trim();
    if (decoded === base) return;
    if (TEXT_HTTP_URL.test(decoded)) addPlainUrlVariants(decoded, knownSet);
    else if (ENCODED_HTTP.test(decoded)) knownSet.add(decoded);
  }

  function getUrlSecretSpans(url) {
    const spans = [];
    function add(start, end, forms) {
      if (end > start) spans.push({ start, end, forms });
    }
    const hash = url.indexOf("#");
    const endpointEnd = hash === -1 ? url.length : hash;
    const question = url.slice(0, endpointEnd).indexOf("?");
    const headEnd = question === -1 ? endpointEnd : question;
    const scheme = /^["']?([a-z][a-z\d+.-]*:)?\/\//i.exec(url.slice(0, headEnd));
    const authStart = scheme ? scheme[0].length : 0;
    let slash = url.indexOf("/", authStart);
    if (slash >= headEnd) slash = -1;
    const authEnd = slash === -1 ? headEnd : slash;
    const at = authEnd > authStart ? url.lastIndexOf("@", authEnd - 1) : -1;
    if (at >= authStart) {
      const colon = url.slice(authStart, at).indexOf(":");
      const nameEnd = colon === -1 ? at : authStart + colon;
      [[authStart, at], [authStart, nameEnd], [nameEnd + 1, at]].forEach((range, index) => {
        if (index === 2 && colon === -1) return;
        const text = url.slice(range[0], range[1]);
        add(range[0], range[1], [text, safeDecodeParam(text)]);
      });
    }
    if (slash !== -1) {
      let start = slash + 1;
      for (let i = start; i <= headEnd; i++) {
        if (i < headEnd && url.charCodeAt(i) !== 47) continue;
        const part = url.slice(start, i);
        add(start, i, [part, safeDecodeParam(part)]);
        start = i + 1;
      }
    }
    if (question !== -1) {
      let start = question + 1;
      let eq = -1;
      for (let i = start; i <= endpointEnd; i++) {
        const code = i < endpointEnd ? url.charCodeAt(i) : 38;
        if (code === 61 && eq === -1) eq = i;
        if (code !== 38) continue;
        if (eq !== -1) {
          let valueStart = eq + 1;
          let valueEnd = i;
          while (valueStart < valueEnd && isWhitespaceAt(url, valueStart)) valueStart++;
          while (valueEnd > valueStart && isWhitespaceAt(url, valueEnd - 1)) valueEnd--;
          add(valueStart, valueEnd, queryValueForms(url.slice(eq + 1, i)).map((form) => form.trim()));
        }
        start = i + 1;
        eq = -1;
      }
    }
    return spans;
  }

  function collectOuterSpellings(layerInfo, admitted) {
    const derived = new Set();
    if (!layerInfo || !Array.isArray(layerInfo.layers) || !Array.isArray(layerInfo.maps) ||
        layerInfo.layers.length < 2) {
      return { derived, overflow: false };
    }
    const { layers, maps } = layerInfo;
    const last = layers.length - 1;
    for (const span of getUrlSecretSpans(layers[last])) {
      if (!span.forms.some((form) => admitted.has(form))) continue;
      for (let k = 0; k < last; k++) {
        const start = mapToLayer(maps, last, k, span.start);
        const end = mapToLayer(maps, last, k, span.end);
        if (start >= 0 && end > start) {
          const outerText = layers[k].slice(start, end);
          if (admitted.has(outerText) || derived.has(outerText)) continue;
          if (derived.size >= MAX_DERIVED_SECRETS) return { derived, overflow: true };
          derived.add(outerText);
        }
      }
    }
    return { derived, overflow: false };
  }

  function addOuterEndpoints(layerInfo, knownSet) {
    if (!layerInfo || !Array.isArray(layerInfo.layers) || !Array.isArray(layerInfo.maps) ||
        layerInfo.layers.length < 2) {
      return;
    }
    const { layers, maps } = layerInfo;
    const last = layers.length - 1;
    const hash = layers[last].indexOf("#");
    if (hash === -1) return;
    for (let k = 0; k < last; k++) {
      const start = mapToLayer(maps, last, k, 0);
      const end = mapToLayer(maps, last, k, hash);
      if (end > 0) addKnownUrlVariants(layers[k].slice(0, end), knownSet);
      if (start > 0 && end > start) addKnownUrlVariants(layers[k].slice(start, end), knownSet);
    }
  }

  function extractUrlSecrets(urls, extraKnownUrls, layerInfo) {
    const tier1 = new Set();
    const exactOnly = new Set();
    const tier2Candidates = new Set();
    let overflow = false;

    function addProtected(value) {
      if (!value) return;
      const short = value.length < 3;
      const group = short ? exactOnly : tier1;
      const limit = short ? MAX_EXACT_SECRETS : MAX_TIER1_SECRETS;
      if (group.has(value)) return;
      if (group.size < limit) group.add(value);
      else overflow = true;
    }

    for (const url of urls) {
      const { userinfo, path, query } = getUrlSecretParts(url);
      const { username, password } = userinfoFields(userinfo);
      [userinfo, safeDecodeParam(userinfo), password, safeDecodeParam(password)].forEach(addProtected);
      for (const name of [username, safeDecodeParam(username)]) {
        if (name.length >= 4 && !COMMON_QUERY_VALUE.test(name)) addProtected(name);
      }

      for (const param of query.split("&")) {
        const eq = param.indexOf("=");
        if (eq === -1) continue;
        const key = safeDecodeParam(param.slice(0, eq)).trim();
        const strong = STRONG_SECRET_QUERY_KEY.test(key);
        const weak = WEAK_ID_QUERY_KEY.test(key);
        for (const form of queryValueForms(param.slice(eq + 1))) {
          const value = form.trim();
          if (strong) {
            if (!TRIVIAL_SECRET_VALUE.test(value)) addProtected(value);
          } else if (!COMMON_QUERY_VALUE.test(value)) {
            if (weak) {
              if (value.length >= 6) addProtected(value);
            } else if (value.length >= 16 || (value.length >= 6 &&
                ((/[a-z]/i.test(value) && /\d/.test(value)) || /[_-]/.test(value) || /^[\da-f]+$/i.test(value)))) {
              tier2Candidates.add(value);
            }
          }
        }
      }

      for (const part of path.split("/")) {
        const decoded = safeDecodeParam(part);
        if (COMMON_PATH_SEGMENT.test(decoded)) continue;
        for (const text of [part, decoded]) {
          if (text.length >= 8 || (text.length >= 6 && /[\d_-]/.test(text))) tier2Candidates.add(text);
        }
      }
    }
    const tier2 = [];
    for (const value of tier2Candidates) {
      if (!tier1.has(value)) tier2.push(value);
    }
    tier2.sort(compareSecretDesc);
    const selectedTier2 = tier2.slice(0, MAX_TIER2_SECRETS);
    const exactList = Array.from(exactOnly);
    const items = Array.from(tier1).concat(selectedTier2);
    const admitted = new Set(items.concat(exactList));
    const derivedResult = collectOuterSpellings(layerInfo, admitted);
    if (derivedResult.overflow) overflow = true;
    for (const value of derivedResult.derived) {
      if (value.length < 3) exactList.push(value);
      else items.push(value);
    }
    items.sort(compareSecretDesc);

    const foldedByItem = new Map();
    let needsRecheck = false;
    for (const secret of items) {
      if (secret.indexOf("<") !== -1 || secret.indexOf(">") !== -1 ||
          "<URL>".indexOf(secret) !== -1 || "<参数>".indexOf(secret) !== -1) {
        needsRecheck = true;
      }
      if (secret.length < 8) continue;
      const { folded: f, startMap, endMap } = buildCaseFolded(secret);
      if (!f || startMap.length !== f.length || endMap.length !== f.length) continue;
      foldedByItem.set(secret, f);
      if (f.indexOf("<") !== -1 || f.indexOf(">") !== -1 ||
          "<url>".indexOf(f) !== -1 || "<参数>".indexOf(f) !== -1) {
        needsRecheck = true;
      }
    }
    const knownSet = new Set();
    for (const url of urls.concat(extraKnownUrls || [])) addKnownUrlVariants(url, knownSet);
    addOuterEndpoints(layerInfo, knownSet);
    const knownUrls = [];
    for (const raw of knownSet) {
      const { folded, startMap, endMap } = buildCaseFolded(raw);
      const valid = folded && startMap.length === folded.length && endMap.length === folded.length;
      knownUrls.push({ raw, folded: valid ? folded : "" });
    }
    return { items, exactOnly: exactList, overflow, foldedByItem, needsRecheck, knownUrls };
  }

  function collectRegexSpans(text, regex, kind, spans) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match[0].length === 0) {
        regex.lastIndex++;
        continue;
      }
      spans.push({ start: match.index, end: match.index + match[0].length, kind });
    }
    regex.lastIndex = 0;
  }

  function collectKnownUrlSpans(text, foldedTitle, secrets, spans) {
    const { folded, startMap, endMap } = foldedTitle;
    for (const entry of secrets.knownUrls) {
      for (let pos = text.indexOf(entry.raw); pos !== -1; pos = text.indexOf(entry.raw, pos + 1)) {
        spans.push({ start: pos, end: pos + entry.raw.length, kind: "url" });
      }
      if (!entry.folded) return false;
      for (let pos = folded.indexOf(entry.folded); pos !== -1; pos = folded.indexOf(entry.folded, pos + 1)) {
        spans.push({ start: startMap[pos], end: endMap[pos + entry.folded.length - 1], kind: "url" });
      }
    }
    return true;
  }

  function collectSecretSpans(text, foldedTitle, secrets, spans) {
    const { folded, startMap, endMap } = foldedTitle;
    for (const secret of secrets.items) {
      for (let pos = text.indexOf(secret); pos !== -1; pos = text.indexOf(secret, pos + 1)) {
        spans.push({ start: pos, end: pos + secret.length, kind: "param" });
      }
      if (secret.length < 8) continue;
      const foldedSecret = secrets.foldedByItem.get(secret);
      if (!foldedSecret) return false;
      for (let pos = folded.indexOf(foldedSecret); pos !== -1; pos = folded.indexOf(foldedSecret, pos + 1)) {
        spans.push({ start: startMap[pos], end: endMap[pos + foldedSecret.length - 1], kind: "param" });
      }
    }
    return true;
  }

  function sanitizeDisplayTitle(rawTitle, secrets, safeFallback) {
    if (typeof rawTitle !== "string" || secrets.overflow) return safeFallback;
    const title = rawTitle.trim();
    if (!title || secrets.exactOnly.indexOf(title) !== -1 || secrets.items.indexOf(title) !== -1) return safeFallback;

    const foldedTitle = buildCaseFolded(title);
    if (!foldedTitle.folded || foldedTitle.startMap.length !== foldedTitle.folded.length ||
        foldedTitle.endMap.length !== foldedTitle.folded.length) return safeFallback;
    for (const secret of secrets.items) {
      if (secret.length < 8) continue;
      const foldedSecret = secrets.foldedByItem.get(secret);
      if (!foldedSecret || foldedTitle.folded === foldedSecret) return safeFallback;
    }

    // 所有匹配均读取原始标题，避免替换破坏后续扫描的边界。
    const spans = [];
    collectRegexSpans(title, URL_IN_TEXT, "url", spans);
    collectSensitiveAssignmentSpans(title, spans);
    if (!collectKnownUrlSpans(title, foldedTitle, secrets, spans)) return safeFallback;
    if (!collectSecretSpans(title, foldedTitle, secrets, spans)) return safeFallback;
    if (!spans.length) return title;

    spans.sort((a, b) => (a.start - b.start) || (b.end - a.end));
    const merged = [spans[0]];
    for (let i = 1; i < spans.length; i++) {
      const prev = merged[merged.length - 1];
      const cur = spans[i];
      if (cur.start <= prev.end) {
        prev.end = Math.max(prev.end, cur.end);
        if (cur.kind === "url") prev.kind = "url";
      } else {
        merged.push(cur);
      }
    }

    let result = "";
    let cursor = 0;
    for (const span of merged) {
      result += title.slice(cursor, span.start) + (span.kind === "url" ? "<URL>" : "<参数>");
      cursor = span.end;
    }
    result = (result + title.slice(cursor)).trim();
    if (!result || secrets.exactOnly.indexOf(result) !== -1) return safeFallback;
    if (secrets.needsRecheck) {
      const reFolded = buildCaseFolded(result);
      const reSpans = [];
      if (!reFolded.folded || reFolded.startMap.length !== reFolded.folded.length ||
          reFolded.endMap.length !== reFolded.folded.length ||
          !collectSecretSpans(result, reFolded, secrets, reSpans) || reSpans.length > 0) return safeFallback;
    }
    return result;
  }

  function sanitizeDisplayIcon(icon, secrets) {
    if (typeof icon !== "string" || icon.length > 80 || !SF_SYMBOL_PATTERN.test(icon) || secrets.overflow ||
        secrets.exactOnly.indexOf(icon) !== -1) return "airplane.circle";
    for (const secret of secrets.items) {
      if (icon.indexOf(secret) !== -1) return "airplane.circle";
      if (secret.length < 8) continue;
      const foldedSecret = secrets.foldedByItem.get(secret);
      if (!foldedSecret || icon.indexOf(foldedSecret) !== -1) return "airplane.circle";
    }
    return icon;
  }

  function truncateText(text, maxUnits) {
    if (maxUnits <= 0) return "";
    if (text.length <= maxUnits) return text;
    if (maxUnits === 1) return "…";
    let cut = maxUnits - 1;
    const last = text.charCodeAt(cut - 1);
    if (last >= 0xD800 && last <= 0xDBFF) cut--;
    return text.slice(0, cut) + "…";
  }

  function safeErrorName(error) {
    try {
      const name = error && error.name;
      if (ERROR_NAMES.has(name)) return name;
    } catch (_) {}
    return "Error";
  }

  function hasSuffixSecretMatch(prefix, suffix, secrets) {
    if (!suffix || !secrets || !secrets.items.length) return false;
    const text = prefix + suffix;
    const prefixLen = prefix.length;
    const { folded, startMap, endMap } = buildCaseFolded(text);
    if (!folded || startMap.length !== folded.length || endMap.length !== folded.length) return true;
    for (const secret of secrets.items) {
      for (let pos = text.indexOf(secret); pos !== -1; pos = text.indexOf(secret, pos + 1)) {
        if (pos + secret.length > prefixLen) return true;
      }
      if (secret.length < 8) continue;
      const foldedSecret = secrets.foldedByItem.get(secret);
      if (!foldedSecret) return true;
      for (let pos = folded.indexOf(foldedSecret); pos !== -1; pos = folded.indexOf(foldedSecret, pos + 1)) {
        if (endMap[pos + foldedSecret.length - 1] > prefixLen) return true;
      }
    }
    return false;
  }

  function finalizeTitle(baseTitle, suffix, secrets, safePanelName) {
    if (!suffix) return baseTitle;
    const prefixes = [baseTitle];
    if (safePanelName && safePanelName !== baseTitle) prefixes.push(safePanelName);
    if (baseTitle !== DEFAULT_TITLE && safePanelName !== DEFAULT_TITLE) prefixes.push(DEFAULT_TITLE);
    for (const prefix of prefixes) {
      if (!hasSuffixSecretMatch(prefix, suffix, secrets)) return prefix + suffix;
    }
    return DEFAULT_TITLE;
  }

  function renderData(title, args, secrets, data, nowMs, safePanelName, fallback) {
    const expire = getExpireState(args.expire, data.expire, nowMs);
    const remaining = Math.max(0, data.totalBytes - data.used);
    const lines = [`用量：${formatBytes(data.used)} / ${formatBytes(data.totalBytes)} · 剩 ${formatBytes(remaining)}`];
    const resetDay = parseResetDay(args.reset_day);
    if (!expire.expired && resetDay !== null) {
      const days = getRemainingDays(resetDay, new Date(nowMs));
      if (Number.isInteger(days) && days >= 0) lines.push(days === 0 ? "重置：今天重置" : `重置：${days}天后重置`);
    }
    if (expire.text) lines.push(`到期：${expire.text}`);
    const suffix = ` | ${Math.round(data.percent)}%`;
    if (fallback) {
      lines.push(`状态：${formatDataAge(nowMs - fallback.time)}`);
    }
    const resultTitle = finalizeTitle(title, suffix, secrets, safePanelName);
    let color = HEX_COLOR_PATTERN.test(args.color) ? args.color : getUsageColor(data.percent);
    if (fallback) color = ORANGE;
    if (expire.expired) color = RED;
    return panel(resultTitle, lines.join("\n"), sanitizeDisplayIcon(args.icon, secrets), color);
  }

  let finished = false;
  function finishOnce(result) {
    if (finished) return;
    finished = true;
    try {
      $done(result);
    } catch (_) {}
  }

  let secrets = null;
  let safePanelName = DEFAULT_TITLE;
  let baseTitle = DEFAULT_TITLE;
  let stage = "init";
  try {
    const startTime = Date.now();
    stage = "args";
    const args = parseArgs(typeof $argument === "undefined" ? undefined : $argument);
    const panelName = typeof $input !== "undefined" && $input ? $input.panelName : "";

    stage = "url";
    const rawUrl = subscriptionUrlText(args.url);
    const layerInfo = rawUrl && rawUrl !== DEFAULT_TITLE ? decodeUrlLayersWithMaps(rawUrl) : { layers: [], maps: [] };
    const rawLayers = layerInfo.layers;
    const normalized = normalizeSubscriptionUrl(args.url);
    const rawPlainUrl = rawLayers.length ? rawLayers[rawLayers.length - 1] : "";
    const secretUrls = normalized.ok
      ? (rawPlainUrl && rawPlainUrl !== normalized.url ? [normalized.url, rawPlainUrl] : [normalized.url])
      : rawLayers;
    const extraKnownUrls = normalized.ok ? rawLayers.slice(0, -1) : [];
    secrets = extractUrlSecrets(secretUrls, extraKnownUrls, layerInfo);
    safePanelName = sanitizeDisplayTitle(panelName, secrets, DEFAULT_TITLE);
    baseTitle = sanitizeDisplayTitle(args.title, secrets, safePanelName);
    if (!normalized.ok) {
      stage = "render";
      if (normalized.code === "EMPTY") {
        const title = finalizeTitle(baseTitle, "", secrets, safePanelName);
        return finishOnce(panel(title, "请在模块参数中填入有效的订阅链接", "wifi.slash", "#8E8E93"));
      }
      const title = finalizeTitle(baseTitle, " | 配置错误", secrets, safePanelName);
      return finishOnce(panel(title, "订阅链接格式无效，需以 http:// 或 https:// 开头", ERROR_ICON, RED));
    }

    stage = "storage";
    const { url } = normalized;
    const descriptor = cacheDescriptor(url);
    const slotId = panelSlotId(panelName, args.title);
    const slotHash = slotId ? fingerprint(slotId).join("_") : "";
    const startedAt = Date.now();
    if (slotHash) syncSlot(slotHash, descriptor, startedAt);
    const firstRead = readCache(descriptor, startedAt);
    const cached = firstRead.entry;
    const baseSeq = cached && cached.time === startedAt ? cached.seq : 0;
    const force = typeof $trigger !== "undefined" && FORCE_REFRESH_TRIGGERS.indexOf($trigger) !== -1;
    if (!force && cached && startedAt - cached.time < NETWORK_COOLDOWN_MS) {
      stage = "render";
      return finishOnce(renderData(baseTitle, args, secrets, cached.data, startedAt, safePanelName));
    }

    stage = "fetch";
    const result = await fetchSubscription(url, args, cached && cached.strategy, startTime + SCRIPT_SOFT_TIMEOUT_MS);
    stage = "storage";
    const finishedAt = Date.now();
    if (result.data) {
      if (shouldSaveCache(slotHash, descriptor, finishedAt)) {
        saveCache(descriptor, result.data, result.strategy, startedAt, baseSeq, finishedAt);
      }
      stage = "render";
      return finishOnce(renderData(baseTitle, args, secrets, result.data, finishedAt, safePanelName));
    }

    const secondRead = readCache(descriptor, finishedAt);
    let fallback = null;
    if (secondRead.ok) {
      fallback = secondRead.entry;
    } else if (cached && Number.isFinite(finishedAt) &&
        cached.time - finishedAt <= CLOCK_SKEW_TOLERANCE_MS && finishedAt - cached.time < MAX_STALE_MS) {
      fallback = cached;
    }
    stage = "render";
    if (fallback) {
      const details = { time: fallback.time };
      return finishOnce(renderData(baseTitle, args, secrets, fallback.data, finishedAt, safePanelName, details));
    }
    const title = finalizeTitle(baseTitle, " | 获取失败", secrets, safePanelName);
    return finishOnce(panel(title, `错误：${errorLabel(result.error)}\n请检查订阅链接、网络或代理策略`, ERROR_ICON, RED));
  } catch (error) {
    const name = safeErrorName(error);
    const content = truncateText(`执行异常（${STAGE_LABELS[stage]}：${name}）`, MAX_FATAL_ERROR_TEXT_LENGTH);
    try {
      if (typeof console !== "undefined") console.log(`[Sub-Info] fatal stage=${stage} type=${name}`);
    } catch (_) {}
    let title;
    try {
      title = finalizeTitle(baseTitle, " | 脚本异常", secrets, safePanelName);
    } catch (_) {
      title = DEFAULT_TITLE;
    }
    finishOnce(panel(title, content, ERROR_ICON, RED));
  }
})();
