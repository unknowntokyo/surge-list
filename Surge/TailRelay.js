/**
 * Surge Panel Script: Tailscale Exit Node & Relay Monitor
 * 通过 Surge 内置 $httpAPI 调用 POST /v1/mcp -> get_proxy_runtime_status
 * 前提：[General] 中需开启 http-api-mcp = true（Surge iOS 6.0.0+ 含特性订阅 / Mac 6.11.0+）
 *
 * 支持参数（通过 $argument 传入原始 UTF-8 文本，不做 URL 解码）：
 *   POLICY      Tailscale 代理策略名称，默认 Tailscale
 *   TITLE       面板标题，默认 TailRelay
 *   ICON        SF Symbols 图标名，默认 point.3.connected.trianglepath.dotted
 *   SHORT_NAME  是否隐藏 .ts.net 后缀，默认 true
 *   AUTO_COLOR  是否按连接状态自动配色（直连绿/Peer Relay蓝/DERP橙/异常红），默认 true
 *   COLOR       AUTO_COLOR=false 时使用的图标十六进制色值，默认 #00C0E8
 */

const COLORS = {
  direct: "#34C759",
  peerRelay: "#007AFF",
  derp: "#FF9500",
  error: "#FF3B30",
  idle: "#8E8E93",
};

const DEFAULTS = {
  POLICY: "Tailscale",
  TITLE: "TailRelay",
  ICON: "point.3.connected.trianglepath.dotted",
  SHORT_NAME: "true",
  AUTO_COLOR: "true",
  COLOR: "#00C0E8",
};

const ARG_KEYS = ["POLICY", "TITLE", "ICON", "SHORT_NAME", "AUTO_COLOR", "COLOR"];
const ALLOWED_KEYS = new Set(ARG_KEYS);
const UNREPLACED_PLACEHOLDER_RE = /^\{\{\{[^}]+\}\}\}$/;
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const V2_PREFIX = "v2|";
const V2_SEP = "|&|";
const MCP_PREREQ_HINT =
  "请确认 Surge 版本（iOS 6.0.0+ / Mac 6.11.0+）、iOS 特性订阅及 http-api-mcp = true";

function createDefaultArgs() {
  const result = Object.create(null);
  for (const key of ARG_KEYS) {
    result[key] = DEFAULTS[key];
  }
  return result;
}

function assignArg(result, key, rawVal) {
  if (!ALLOWED_KEYS.has(key)) return;
  const val = String(rawVal).trim();
  if (val === "" || UNREPLACED_PLACEHOLDER_RE.test(val)) return;
  result[key] = val;
}

function parseV2Args(raw) {
  const body = raw.slice(V2_PREFIX.length);
  const firstPrefix = `${ARG_KEYS[0]}=`;
  if (!body.startsWith(firstPrefix)) return null;

  const parsed = createDefaultArgs();
  let cursor = firstPrefix.length;
  for (let i = 0; i < ARG_KEYS.length; i++) {
    const key = ARG_KEYS[i];
    if (i === ARG_KEYS.length - 1) {
      assignArg(parsed, key, body.slice(cursor));
      return parsed;
    }
    const nextMarker = `${V2_SEP}${ARG_KEYS[i + 1]}=`;
    const nextIdx = body.indexOf(nextMarker, cursor);
    if (nextIdx === -1) return null;
    assignArg(parsed, key, body.slice(cursor, nextIdx));
    cursor = nextIdx + nextMarker.length;
  }
  return parsed;
}

function parseArgs(raw) {
  const result = createDefaultArgs();
  if (!raw || typeof raw !== "string") return result;

  if (raw.startsWith(V2_PREFIX)) {
    const v2Result = parseV2Args(raw);
    if (v2Result) return v2Result;
  }

  for (const pair of raw.split("&")) {
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1);
    assignArg(result, key, val);
  }
  return result;
}

function toBool(val, fallback) {
  if (val === undefined || val === null) return fallback;
  const normalized = String(val).trim().toLowerCase();
  if (normalized === "") return fallback;
  if (/^(true|1|yes|on)$/.test(normalized)) return true;
  if (/^(false|0|no|off)$/.test(normalized)) return false;
  return fallback;
}

function sanitizeHexColor(color, fallback) {
  if (typeof color === "string") {
    const trimmed = color.trim();
    if (HEX_COLOR_RE.test(trimmed)) return trimmed;
  }
  return fallback;
}

function resolveIconColor(args, stateColor) {
  const autoColor = toBool(args.AUTO_COLOR, true);
  if (autoColor) return stateColor;
  return sanitizeHexColor(args.COLOR, DEFAULTS.COLOR);
}

function normalizeNodeKey(name) {
  if (name === undefined || name === null) return "";
  return String(name).trim().replace(/\.$/, "").toLowerCase();
}

function formatNodeName(name, shortName) {
  if (!name) return "未知";
  const cleaned = String(name).trim().replace(/\.$/, "");
  if (!cleaned) return "未知";
  if (!shortName) return cleaned;

  // 不截断 IPv4 与 IPv6 字面量
  if (IPV4_RE.test(cleaned) || cleaned.includes(":")) {
    return cleaned;
  }

  // 仅精简 Tailscale MagicDNS 的 .ts.net 后缀，保留多级主机名
  const fullTsMatch = cleaned.match(/^(.+)\.[^.]+\.ts\.net$/i);
  if (fullTsMatch) return fullTsMatch[1];

  const shortTsMatch = cleaned.match(/^(.+)\.ts\.net$/i);
  if (shortTsMatch) return shortTsMatch[1];

  return cleaned;
}

function extractHost(addr) {
  if (!addr || typeof addr !== "string") return "";
  const s = addr.trim();
  if (!s) return "";

  // [IPv6]:port 或 [IPv6]
  if (s.startsWith("[")) {
    const end = s.indexOf("]");
    return (end > 1 ? s.slice(1, end) : s).toLowerCase();
  }

  const firstColon = s.indexOf(":");
  if (firstColon === -1) {
    return s.toLowerCase();
  }

  const lastColon = s.lastIndexOf(":");
  // 多个冒号说明是裸 IPv6（无方括号、无端口），不可按最后一个冒号截断
  if (firstColon !== lastColon) {
    return s.toLowerCase();
  }

  // 单个冒号：host:port（如 IPv4:port 或 hostname:port）
  return (lastColon > 0 ? s.slice(0, lastColon) : s).toLowerCase();
}

function findPeerRelayNodeName(ts, relayAddress, shortName) {
  const relayHost = extractHost(relayAddress);
  const peers = Array.isArray(ts.peers) ? ts.peers : [];

  if (relayHost) {
    const matched = peers.find((p) => {
      if (!p || !p.relayServerCandidate) return false;
      return (
        extractHost(p.directAddress) === relayHost ||
        extractHost(p.relayAddress) === relayHost
      );
    });
    if (matched && matched.name) {
      return formatNodeName(matched.name, shortName);
    }
  }

  const servers = ts.peerRelay && Array.isArray(ts.peerRelay.servers) ? ts.peerRelay.servers : [];
  if (servers.length === 0) return "";

  // 多元素时优先尝试按 host 精确匹配，避免盲猜错误中继节点
  if (relayHost) {
    const hostMatched = servers.find((item) => {
      if (typeof item === "string") return extractHost(item) === relayHost;
      if (item && typeof item === "object") {
        const candidateAddr = item.address || item.directAddress || item.host || item.name;
        return extractHost(candidateAddr) === relayHost;
      }
      return false;
    });
    if (hostMatched) {
      const label =
        typeof hostMatched === "string"
          ? hostMatched
          : hostMatched.name || hostMatched.address || hostMatched.host;
      if (label) return formatNodeName(label, shortName);
    }
  }

  const uniqueLabels = [];
  const seen = new Set();
  for (const item of servers) {
    const rawLabel =
      typeof item === "string"
        ? item
        : item && typeof item === "object"
          ? item.name || item.address || item.host
          : "";
    const formatted = rawLabel ? formatNodeName(rawLabel, shortName) : "";
    const key = formatted.toLowerCase();
    if (formatted && formatted !== "未知" && !seen.has(key)) {
      seen.add(key);
      uniqueLabels.push(formatted);
    }
  }
  if (uniqueLabels.length === 1) {
    return uniqueLabels[0];
  }
  return "";
}

function findDerpDisplay(ts, peer) {
  const code = peer.derpRegionCode || "";
  const regionID = peer.derpRegionID;
  const hasRegionID = regionID !== undefined && regionID !== null && regionID !== "";
  const conns = Array.isArray(ts.derpConnections) ? ts.derpConnections : [];

  const conn = conns.find((c) => {
    if (!c) return false;
    if (hasRegionID && c.regionID !== undefined && c.regionID !== null && c.regionID === regionID) {
      return true;
    }
    return Boolean(code && c.regionCode === code);
  });

  if (conn && conn.hostname) {
    return code ? `${conn.hostname} (${code})` : conn.hostname;
  }
  if (code) return `DERP ${code}`;
  if (hasRegionID) return `DERP #${regionID}`;
  return "官方 DERP";
}

function parseNonNegativeNumber(val) {
  if (typeof val === "number") {
    return Number.isFinite(val) && val >= 0 ? val : null;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed === "") return null;
    const num = Number(trimmed);
    return Number.isFinite(num) && num >= 0 ? num : null;
  }
  return null;
}

function resolveLatency(ts, peer, connType) {
  const ownLatency = parseNonNegativeNumber(peer.latencyMs);
  if (ownLatency !== null) {
    return `${Math.round(ownLatency)} ms`;
  }

  // 仅在官方 DERP 中继路径下允许回退使用 netcheck DERP 区域测速
  if (connType === "relay" || connType === "derp") {
    const regionMap = ts.netcheck && ts.netcheck.regionLatencyMs;
    if (regionMap && peer.derpRegionID !== undefined && peer.derpRegionID !== null) {
      const fallback = parseNonNegativeNumber(regionMap[String(peer.derpRegionID)]);
      if (fallback !== null) {
        return `约 ${Math.round(fallback)} ms`;
      }
    }
  }

  return "无数据";
}

function findExitPeer(peers, exitNode) {
  const byFlag = peers.find(
    (p) => p && (p.selectedExitNode === 1 || p.selectedExitNode === true)
  );
  if (byFlag) return byFlag;

  const selectedKey = normalizeNodeKey(exitNode.selected);
  if (!selectedKey) return null;

  const exactMatch = peers.find((p) => p && normalizeNodeKey(p.name) === selectedKey);
  if (exactMatch) return exactMatch;

  // 若 exitNode.selected 为短名（不含点号），尝试匹配唯一短名节点
  if (!selectedKey.includes(".")) {
    const shortMatches = peers.filter(
      (p) => p && p.name && normalizeNodeKey(formatNodeName(p.name, true)) === selectedKey
    );
    if (shortMatches.length === 1) return shortMatches[0];
  }

  return null;
}

function buildPanel(args, data) {
  const shortName = toBool(args.SHORT_NAME, true);
  const pickColor = (stateColor) => resolveIconColor(args, stateColor);

  const ts = data && data.tailscale;
  if (!ts) {
    const serverMsg =
      data && typeof data.result === "string" && data.result.trim() ? data.result.trim() : "";
    return {
      title: args.TITLE,
      content: serverMsg
        ? `策略「${args.POLICY}」查询异常：${serverMsg}`
        : `策略「${args.POLICY}」不是 Tailscale 代理或无运行数据`,
      icon: args.ICON,
      "icon-color": pickColor(COLORS.error),
    };
  }

  if (ts.state && ts.state !== "ready") {
    return {
      title: args.TITLE,
      content: `状态：${ts.state}\nHome DERP：${ts.homeDERPRegionCode || "未知"}`,
      icon: args.ICON,
      "icon-color": pickColor(COLORS.idle),
    };
  }

  const exitNode = ts.exitNode || {};
  const peers = Array.isArray(ts.peers) ? ts.peers : [];
  const homeDerp = ts.homeDERPRegionCode || "未知";
  const onlineCount = peers.filter((p) => p && p.online === true).length;

  if (!exitNode.enabled) {
    return {
      title: args.TITLE,
      content: `出口节点：未启用\n在线节点：${onlineCount} 个\nHome DERP：${homeDerp}`,
      icon: args.ICON,
      "icon-color": pickColor(COLORS.idle),
    };
  }

  const exitPeer = findExitPeer(peers, exitNode);
  if (!exitPeer) {
    const selectedLabel = exitNode.selected ? formatNodeName(exitNode.selected, shortName) : "";
    const content = selectedLabel
      ? `出口节点：${selectedLabel}\n状态：已启用，未在节点列表中匹配到\n在线节点：${onlineCount} 个`
      : `出口节点：已启用（未匹配到节点）\n在线节点：${onlineCount} 个\nHome DERP：${homeDerp}`;
    return {
      title: args.TITLE,
      content,
      icon: args.ICON,
      "icon-color": pickColor(COLORS.idle),
    };
  }

  const nodeLabel = formatNodeName(exitPeer.name || exitNode.selected, shortName);
  const connType = String(exitPeer.connectionType || exitPeer.status || "").toLowerCase();
  const latencyText = resolveLatency(ts, exitPeer, connType);

  // 仅明确返回 online: false 或 offline 状态时判定离线，避免缺字段误报
  if (exitPeer.online === false || connType === "offline") {
    return {
      title: args.TITLE,
      content: `出口节点：${nodeLabel}\n连接方式：离线\n中继地址：-\n当前延迟：-`,
      icon: args.ICON,
      "icon-color": pickColor(COLORS.error),
    };
  }

  let connLabel = connType || "未知";
  let addrTitle = "中继地址";
  let addrValue = "未知";
  let stateColor = COLORS.idle;

  if (connType === "peer-relay") {
    const relayNode = findPeerRelayNodeName(ts, exitPeer.relayAddress, shortName);
    connLabel = relayNode ? `Peer Relay (${relayNode})` : "Peer Relay";
    addrTitle = "中继地址";
    addrValue = exitPeer.relayAddress || "未知";
    stateColor = COLORS.peerRelay;
  } else if (connType === "direct") {
    connLabel = "直连 (Direct)";
    addrTitle = "直连地址";
    addrValue = exitPeer.directAddress || "未知";
    stateColor = COLORS.direct;
  } else if (connType === "relay" || connType === "derp") {
    connLabel = exitPeer.derpRegionCode ? `官方 DERP (${exitPeer.derpRegionCode})` : "官方 DERP";
    addrTitle = "中继节点";
    addrValue = findDerpDisplay(ts, exitPeer);
    stateColor = COLORS.derp;
  } else {
    addrValue = exitPeer.relayAddress || exitPeer.directAddress || findDerpDisplay(ts, exitPeer);
  }

  const lines = [
    `出口节点：${nodeLabel}`,
    `连接方式：${connLabel}`,
    `${addrTitle}：${addrValue}`,
    `当前延迟：${latencyText}`,
  ];

  return {
    title: args.TITLE,
    content: lines.join("\n"),
    icon: args.ICON,
    "icon-color": pickColor(stateColor),
  };
}

function failPanel(args, msg) {
  return {
    title: args.TITLE,
    content: msg,
    icon: args.ICON,
    "icon-color": resolveIconColor(args, COLORS.error),
  };
}

function safeFormatError(err) {
  if (typeof err === "string") return err;
  if (err && typeof err.message === "string" && err.message) return err.message;
  try {
    return JSON.stringify(err);
  } catch (_) {
    return String(err);
  }
}

function isLikelyMcpEndpointError(err, errMsg) {
  const code = err && typeof err === "object" ? err.code : undefined;
  if (code === -32601 || code === 403 || code === 404) return true;
  return /(403|404|forbidden|not found|unknown path|disabled|mcp|subscription|unauthorized)/i.test(
    String(errMsg || "")
  );
}

function extractTextBlocks(result) {
  if (!result || !Array.isArray(result.content)) return [];
  const texts = [];
  for (const item of result.content) {
    if (item && typeof item.text === "string" && (!item.type || item.type === "text")) {
      if (item.text.trim() !== "") {
        texts.push(item.text);
      }
    }
  }
  return texts;
}

function parseStatusJson(texts) {
  let firstError = null;
  for (const text of texts) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object") {
        return { ok: true, value: parsed };
      }
      if (!firstError) {
        firstError = new Error("状态正文不是有效 JSON 对象");
      }
    } catch (e) {
      if (!firstError) firstError = e;
    }
  }
  return { ok: false, error: firstError || new Error("状态正文为空") };
}

(function main() {
  let settled = false;
  function finishOnce(panel) {
    if (settled) return;
    settled = true;
    $done(panel);
  }

  let args = createDefaultArgs();
  try {
    args = parseArgs(typeof $argument === "string" ? $argument : "");
    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "get_proxy_runtime_status",
        arguments: {
          policy: args.POLICY,
        },
      },
    };

    $httpAPI("POST", "/v1/mcp", payload, (resp) => {
      try {
        if (!resp) {
          finishOnce(failPanel(args, `获取失败：未收到 Surge HTTP API 响应\n${MCP_PREREQ_HINT}`));
          return;
        }

        if (typeof resp === "string") {
          finishOnce(failPanel(args, `查询失败：${resp}\n${MCP_PREREQ_HINT}`));
          return;
        }

        if (resp.error) {
          const errMsg = safeFormatError(resp.error);
          const msg = isLikelyMcpEndpointError(resp.error, errMsg)
            ? `查询失败：${errMsg}\n${MCP_PREREQ_HINT}`
            : `查询失败：${errMsg}`;
          finishOnce(failPanel(args, msg));
          return;
        }

        if (typeof resp !== "object" || !("result" in resp)) {
          const hintText = resp && typeof resp.message === "string" && resp.message
            ? `查询失败：${resp.message}\n${MCP_PREREQ_HINT}`
            : `查询失败：HTTP API 返回非标准 MCP 响应\n${MCP_PREREQ_HINT}`;
          finishOnce(failPanel(args, hintText));
          return;
        }

        const result = resp.result;
        const texts = extractTextBlocks(result);

        if (result && result.isError) {
          const detail = texts.length > 0 ? texts.join("\n") : "MCP 未返回错误详情";
          finishOnce(failPanel(args, `策略查询报错：${detail}`));
          return;
        }

        if (texts.length === 0) {
          finishOnce(failPanel(args, "查询失败：MCP 返回缺少状态正文"));
          return;
        }

        const parsed = parseStatusJson(texts);
        if (!parsed.ok) {
          finishOnce(failPanel(args, `状态解析失败：${safeFormatError(parsed.error)}`));
          return;
        }

        finishOnce(buildPanel(args, parsed.value));
      } catch (e) {
        finishOnce(failPanel(args, `处理响应异常：${safeFormatError(e)}`));
      }
    });
  } catch (e) {
    finishOnce(failPanel(args, `脚本执行异常：${safeFormatError(e)}`));
  }
})();
