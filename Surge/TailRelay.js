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
 *   AUTO_COLOR  是否按连接状态自动配色（直连绿/Peer Relay蓝/DERP橙/未启用或待连接紫/异常红），默认 true
 *   COLOR       AUTO_COLOR=false 时使用的图标十六进制色值，默认 #FFCC00
 */

const COLORS = {
  direct: "#34C759",
  peerRelay: "#00C0E8",
  derp: "#FF9500",
  error: "#FF383C",
  idle: "#CB30E0",
};

const DEFAULTS = {
  POLICY: "Tailscale",
  TITLE: "TailRelay",
  ICON: "point.3.connected.trianglepath.dotted",
  SHORT_NAME: "true",
  AUTO_COLOR: "true",
  COLOR: "#FFCC00",
};

const ARG_KEYS = ["POLICY", "TITLE", "ICON", "SHORT_NAME", "AUTO_COLOR", "COLOR"];
const ALLOWED_KEYS = new Set(ARG_KEYS);
const UNREPLACED_PLACEHOLDER_RE = /^\{\{\{[^}]+\}\}\}$/;
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const VNI_SUFFIX_RE = /:vni:\d+$/i;
const V2_PREFIX = "v2|";
const V2_SEP = "|&|";
const MAX_ERROR_LEN = 240;
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
  const parsed = createDefaultArgs();
  const body = raw.slice(V2_PREFIX.length);
  for (const segment of body.split(V2_SEP)) {
    const idx = segment.indexOf("=");
    if (idx <= 0) continue;
    const key = segment.slice(0, idx).trim();
    const val = segment.slice(idx + 1);
    assignArg(parsed, key, val);
  }
  return parsed;
}

function parseArgs(raw) {
  const result = createDefaultArgs();
  if (!raw || typeof raw !== "string") return result;

  if (raw.startsWith(V2_PREFIX)) {
    return parseV2Args(raw);
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
  if (typeof name !== "string") return "";
  return name.trim().replace(/\.$/, "").toLowerCase();
}

function isIpLiteral(host) {
  return Boolean(host) && (IPV4_RE.test(host) || host.includes(":"));
}

function formatNodeName(name, shortName) {
  if (typeof name !== "string") return "未知";
  const cleaned = name.trim().replace(/\.$/, "");
  if (!cleaned) return "未知";
  if (!shortName) return cleaned;

  // 不截断 IPv4 与 IPv6 字面量
  if (isIpLiteral(cleaned)) {
    return cleaned;
  }

  // 仅精简 Tailscale MagicDNS 的 .ts.net 后缀，保留多级主机名
  const fullTsMatch = cleaned.match(/^(.+)\.[^.]+\.ts\.net$/i);
  if (fullTsMatch) return fullTsMatch[1];

  const shortTsMatch = cleaned.match(/^(.+)\.ts\.net$/i);
  if (shortTsMatch) return shortTsMatch[1];

  return cleaned;
}

function stripIpv6Zone(host) {
  const pct = host.indexOf("%");
  return pct > 0 ? host.slice(0, pct) : host;
}

function extractHost(addr) {
  if (!addr || typeof addr !== "string") return "";
  let s = addr.trim();
  if (!s) return "";

  if (SCHEME_RE.test(s)) {
    s = s.replace(SCHEME_RE, "");
    const slashIdx = s.indexOf("/");
    if (slashIdx !== -1) s = s.slice(0, slashIdx);
  }

  // 兼容 Tailscale Peer Relay 可能携带的 :vni:<id> 后缀
  s = s.replace(VNI_SUFFIX_RE, "").trim();
  if (!s) return "";

  // [IPv6]:port 或 [IPv6]
  if (s.startsWith("[")) {
    const end = s.indexOf("]");
    if (end <= 1) return "";
    return stripIpv6Zone(s.slice(1, end).trim()).toLowerCase();
  }

  const firstColon = s.indexOf(":");
  if (firstColon === -1) {
    return s.replace(/\.$/, "").toLowerCase();
  }

  const lastColon = s.lastIndexOf(":");
  // 多个冒号说明是裸 IPv6（无方括号、无端口），不可按最后一个冒号截断
  if (firstColon !== lastColon) {
    return stripIpv6Zone(s).toLowerCase();
  }

  // 单个冒号：host:port（如 IPv4:port 或 hostname:port）；拒绝无主机畸形串如 ":41641"
  if (firstColon === 0) return "";
  return s.slice(0, firstColon).replace(/\.$/, "").toLowerCase();
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
    if (matched && typeof matched.name === "string" && matched.name.trim()) {
      return formatNodeName(matched.name, shortName);
    }
  }

  const servers = ts.peerRelay && Array.isArray(ts.peerRelay.servers) ? ts.peerRelay.servers : [];
  if (servers.length === 0) return "";

  // 多元素时优先按 host 逐字段精确匹配，避免单值短路与盲猜错误中继节点
  if (relayHost) {
    const hostMatched = servers.find((item) => {
      if (typeof item === "string") return extractHost(item) === relayHost;
      if (item && typeof item === "object") {
        const candidates = [item.address, item.directAddress, item.host, item.name];
        return candidates.some((cand) => extractHost(cand) === relayHost);
      }
      return false;
    });
    if (hostMatched) {
      const label =
        typeof hostMatched === "string"
          ? hostMatched
          : hostMatched.name || hostMatched.address || hostMatched.directAddress || hostMatched.host;
      if (label) return formatNodeName(label, shortName);
    }
  }

  // 仅在元素未携带与 relayHost 冲突的显式地址时允许单元素名称兜底
  const uniqueLabels = [];
  const seen = new Set();
  for (const item of servers) {
    if (relayHost) {
      if (typeof item === "string") {
        if (isIpLiteral(extractHost(item))) continue;
      } else if (item && typeof item === "object") {
        const hasExplicitAddr = Boolean(
          extractHost(item.address) || extractHost(item.directAddress) || extractHost(item.host)
        );
        if (hasExplicitAddr) continue;
      }
    }

    const rawLabel =
      typeof item === "string"
        ? item
        : item && typeof item === "object"
          ? item.name || item.address || item.directAddress || item.host
          : "";
    const formatted = typeof rawLabel === "string" ? formatNodeName(rawLabel, shortName) : "";
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

function findDerpDisplay(ts, peer, allowGenericFallback) {
  const allowFallback = allowGenericFallback !== false;
  const code = typeof peer.derpRegionCode === "string" ? peer.derpRegionCode.trim() : "";
  const regionID = peer.derpRegionID;
  const regionIDStr =
    regionID !== undefined && regionID !== null && String(regionID).trim() !== ""
      ? String(regionID).trim()
      : "";
  const codeLower = code.toLowerCase();
  const conns = Array.isArray(ts.derpConnections) ? ts.derpConnections : [];

  const conn = conns.find((c) => {
    if (!c || typeof c !== "object") return false;
    if (
      regionIDStr &&
      c.regionID !== undefined &&
      c.regionID !== null &&
      String(c.regionID).trim() === regionIDStr
    ) {
      return true;
    }
    return Boolean(
      codeLower && typeof c.regionCode === "string" && c.regionCode.trim().toLowerCase() === codeLower
    );
  });

  const connCode = conn && typeof conn.regionCode === "string" ? conn.regionCode.trim() : "";
  const displayCode = code || connCode;
  const connHost = conn && typeof conn.hostname === "string" ? conn.hostname.trim() : "";

  if (connHost) {
    return displayCode ? `${connHost} (${displayCode})` : connHost;
  }
  if (displayCode) return `DERP ${displayCode}`;
  if (regionIDStr) return `DERP #${regionIDStr}`;
  return allowFallback ? "官方 DERP" : "";
}

function findHomeDerpDisplay(ts) {
  if (typeof ts.homeDERPRegionCode === "string" && ts.homeDERPRegionCode.trim()) {
    return ts.homeDERPRegionCode.trim();
  }
  if (
    ts.homeDERPRegionID !== undefined &&
    ts.homeDERPRegionID !== null &&
    String(ts.homeDERPRegionID).trim() !== ""
  ) {
    const resolved = findDerpDisplay(ts, { derpRegionID: ts.homeDERPRegionID }, false);
    if (resolved) return resolved;
  }
  return "未知";
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

  // 仅在官方 DERP 中继路径下允许回退使用 netcheck 本机到 DERP 区域的单段测速
  if (connType === "relay" || connType === "derp") {
    const regionMap = ts.netcheck && ts.netcheck.regionLatencyMs;
    if (
      regionMap &&
      typeof regionMap === "object" &&
      !Array.isArray(regionMap) &&
      peer.derpRegionID !== undefined &&
      peer.derpRegionID !== null
    ) {
      const key = String(peer.derpRegionID);
      if (Object.prototype.hasOwnProperty.call(regionMap, key)) {
        const fallback = parseNonNegativeNumber(regionMap[key]);
        if (fallback !== null) {
          return `约 ${Math.round(fallback)} ms`;
        }
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

  const exactMatch = peers.find((p) => {
    if (!p || typeof p !== "object") return false;
    if (normalizeNodeKey(p.name) === selectedKey) return true;
    if (normalizeNodeKey(p.stableID) === selectedKey) return true;
    if (Array.isArray(p.addresses)) {
      return p.addresses.some((addr) => extractHost(addr) === selectedKey);
    }
    return false;
  });
  if (exactMatch) return exactMatch;

  // 若 exitNode.selected 为短名（不含点号），尝试匹配唯一短名节点
  if (!selectedKey.includes(".")) {
    const shortMatches = peers.filter(
      (p) => p && typeof p.name === "string" && normalizeNodeKey(formatNodeName(p.name, true)) === selectedKey
    );
    if (shortMatches.length === 1) return shortMatches[0];
  }

  return null;
}

function buildPanel(args, data) {
  const shortName = toBool(args.SHORT_NAME, true);
  const pickColor = (stateColor) => resolveIconColor(args, stateColor);

  const ts =
    data && typeof data.tailscale === "object" && !Array.isArray(data.tailscale)
      ? data.tailscale
      : null;
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

  const homeDerp = findHomeDerpDisplay(ts);
  const rawState = typeof ts.state === "string" ? ts.state.trim() : "";
  if (rawState && rawState.toLowerCase() !== "ready") {
    return {
      title: args.TITLE,
      content: `状态：${rawState}\nHome DERP：${homeDerp}`,
      icon: args.ICON,
      "icon-color": pickColor(COLORS.idle),
    };
  }

  const exitNode =
    ts.exitNode && typeof ts.exitNode === "object" && !Array.isArray(ts.exitNode)
      ? ts.exitNode
      : {};
  const peers = Array.isArray(ts.peers) ? ts.peers : [];
  const onlineCount = peers.filter((p) => p && p.online === true).length;

  if (!toBool(exitNode.enabled, false)) {
    return {
      title: args.TITLE,
      content: `出口节点：未启用\n在线节点：${onlineCount} 个\nHome DERP：${homeDerp}`,
      icon: args.ICON,
      "icon-color": pickColor(COLORS.idle),
    };
  }

  const exitPeer = findExitPeer(peers, exitNode);
  if (!exitPeer) {
    const selectedLabel =
      typeof exitNode.selected === "string" && exitNode.selected.trim()
        ? formatNodeName(exitNode.selected, shortName)
        : "";
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

  const rawPeerName =
    typeof exitPeer.name === "string" && exitPeer.name.trim()
      ? exitPeer.name
      : typeof exitNode.selected === "string"
        ? exitNode.selected
        : "";
  const nodeLabel = formatNodeName(rawPeerName, shortName);
  const connType =
    typeof exitPeer.connectionType === "string" ? exitPeer.connectionType.trim().toLowerCase() : "";
  const peerStatus =
    typeof exitPeer.status === "string" ? exitPeer.status.trim().toLowerCase() : "";
  const effectiveType = connType || peerStatus;

  // 仅明确返回 online: false 或 offline 状态时判定离线，避免缺字段误报
  if (exitPeer.online === false || effectiveType === "offline" || peerStatus === "offline") {
    return {
      title: args.TITLE,
      content: `出口节点：${nodeLabel}\n连接方式：离线\n中继地址：-\n当前延迟：-`,
      icon: args.ICON,
      "icon-color": pickColor(COLORS.error),
    };
  }

  const hasRelayAddr =
    typeof exitPeer.relayAddress === "string" && exitPeer.relayAddress.trim() !== "";
  const hasDirectAddr =
    typeof exitPeer.directAddress === "string" && exitPeer.directAddress.trim() !== "";

  // 在线且无有效直连/中继地址、尚未完成握手时，避免将其误判为正在走官方 DERP 中继
  if (
    peerStatus === "not-used" &&
    exitPeer.handshakeCompleted === false &&
    effectiveType !== "peer-relay" &&
    effectiveType !== "direct" &&
    !hasRelayAddr &&
    !hasDirectAddr
  ) {
    const defaultDerp = findDerpDisplay(ts, exitPeer, false);
    const addrTitle = defaultDerp ? "默认中继" : "连接地址";
    const addrValue = defaultDerp || "-";
    return {
      title: args.TITLE,
      content: `出口节点：${nodeLabel}\n连接方式：待连接\n${addrTitle}：${addrValue}\n当前延迟：无数据`,
      icon: args.ICON,
      "icon-color": pickColor(COLORS.idle),
    };
  }

  const latencyText = resolveLatency(ts, exitPeer, effectiveType);

  let connLabel = effectiveType || "未知";
  let addrTitle = "连接地址";
  let addrValue = "未知";
  let stateColor = COLORS.idle;

  if (effectiveType === "peer-relay") {
    const relayNode = findPeerRelayNodeName(ts, exitPeer.relayAddress, shortName);
    connLabel = relayNode ? `Peer Relay (${relayNode})` : "Peer Relay";
    addrTitle = "中继地址";
    addrValue = hasRelayAddr ? exitPeer.relayAddress.trim() : "未知";
    stateColor = COLORS.peerRelay;
  } else if (effectiveType === "direct") {
    connLabel = "直连";
    addrTitle = "直连地址";
    addrValue = hasDirectAddr ? exitPeer.directAddress.trim() : "未知";
    stateColor = COLORS.direct;
  } else if (effectiveType === "relay" || effectiveType === "derp") {
    const derpCode =
      typeof exitPeer.derpRegionCode === "string" ? exitPeer.derpRegionCode.trim() : "";
    connLabel = derpCode ? `官方 DERP (${derpCode})` : "官方 DERP";
    addrTitle = "中继节点";
    addrValue = findDerpDisplay(ts, exitPeer, true);
    stateColor = COLORS.derp;
  } else if (hasRelayAddr) {
    addrTitle = "中继地址";
    addrValue = exitPeer.relayAddress.trim();
  } else if (hasDirectAddr) {
    addrTitle = "直连地址";
    addrValue = exitPeer.directAddress.trim();
  } else {
    const derpInfo = findDerpDisplay(ts, exitPeer, false);
    if (derpInfo) {
      addrTitle = "中继节点";
      addrValue = derpInfo;
    }
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

function truncateText(text, maxLen) {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 3)}...`;
}

function safeFormatError(err) {
  if (err === undefined || err === null) return "未知错误";
  if (typeof err === "string") {
    const trimmed = err.trim();
    return trimmed ? truncateText(trimmed, MAX_ERROR_LEN) : "未知错误";
  }
  if (typeof err === "object") {
    if (typeof err.message === "string" && err.message.trim()) {
      return truncateText(err.message.trim(), MAX_ERROR_LEN);
    }
    if (err instanceof Error) {
      return truncateText(err.name || "Error", MAX_ERROR_LEN);
    }
  }
  try {
    const serialized = JSON.stringify(err);
    if (serialized && serialized !== "{}") {
      return truncateText(serialized, MAX_ERROR_LEN);
    }
  } catch (_) {
    // ignore circular structure and fall back to String(err)
  }
  return truncateText(String(err), MAX_ERROR_LEN);
}

function isLikelyMcpEndpointError(err, errMsg) {
  const msg = String(errMsg || "");
  if (/\bpolicy\b.*\bnot found\b/i.test(msg)) return false;

  const code = err && typeof err === "object" ? err.code : undefined;
  if (code === -32601 || code === 403 || code === 404) return true;
  return /\b(?:403|404)\b|\b(?:forbidden|unknown path|unauthorized|subscription)\b|http-api-mcp|\bmcp\b.*(?:disabled|not enabled|off)/i.test(
    msg
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
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
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

    $httpAPI("POST", "/v1/mcp", payload, (rawResp) => {
      try {
        if (!rawResp) {
          finishOnce(failPanel(args, `获取失败：未收到 Surge HTTP API 响应\n${MCP_PREREQ_HINT}`));
          return;
        }

        let resp = rawResp;
        if (typeof resp === "string") {
          try {
            const parsedResp = JSON.parse(resp);
            if (parsedResp && typeof parsedResp === "object" && !Array.isArray(parsedResp)) {
              resp = parsedResp;
            } else {
              finishOnce(failPanel(args, `查询失败：${safeFormatError(resp)}\n${MCP_PREREQ_HINT}`));
              return;
            }
          } catch (_) {
            finishOnce(failPanel(args, `查询失败：${safeFormatError(resp)}\n${MCP_PREREQ_HINT}`));
            return;
          }
        }

        if (resp.error) {
          const errMsg = safeFormatError(resp.error);
          const msg = isLikelyMcpEndpointError(resp.error, errMsg)
            ? `查询失败：${errMsg}\n${MCP_PREREQ_HINT}`
            : `查询失败：${errMsg}`;
          finishOnce(failPanel(args, msg));
          return;
        }

        if (typeof resp !== "object" || Array.isArray(resp) || !("result" in resp)) {
          const hintText =
            resp && typeof resp.message === "string" && resp.message.trim()
              ? `查询失败：${safeFormatError(resp.message)}\n${MCP_PREREQ_HINT}`
              : `查询失败：HTTP API 返回非标准 MCP 响应\n${MCP_PREREQ_HINT}`;
          finishOnce(failPanel(args, hintText));
          return;
        }

        const result = resp.result;
        const texts = extractTextBlocks(result);

        if (result && result.isError) {
          const detail = texts.length > 0 ? safeFormatError(texts.join("\n")) : "MCP 未返回错误详情";
          finishOnce(failPanel(args, `策略查询报错：${detail}`));
          return;
        }

        if (texts.length === 0) {
          if (
            result &&
            result.structuredContent &&
            typeof result.structuredContent === "object" &&
            !Array.isArray(result.structuredContent)
          ) {
            finishOnce(buildPanel(args, result.structuredContent));
            return;
          }
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
