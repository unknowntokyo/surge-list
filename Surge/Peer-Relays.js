/**
 * Surge Panel Script: Tailscale Exit Node & Relay Monitor
 * 通过 Surge 内置 $httpAPI 调用 POST /v1/mcp -> get_proxy_runtime_status
 * 前提：[General] 中需开启 http-api-mcp = true（Surge iOS 6.0.0+ / Mac 6.11.0+）
 *
 * 支持参数（通过 $argument 传入，形如 POLICY=Tailscale&TITLE=Tailscale 出口）：
 *   POLICY      Tailscale 代理策略名称，默认 Tailscale
 *   TITLE       面板标题，默认 Tailscale 出口
 *   ICON        SF Symbols 图标名，默认 point.3.connected.trianglepath.dotted
 *   SHORT_NAME  是否精简 .ts.net 域名为短节点名，默认 true
 *   AUTO_COLOR  是否按连接状态自动配色（直连绿/Peer Relay蓝/DERP橙/异常红），默认 true
 *   COLOR       AUTO_COLOR=false 时使用的图标颜色，默认 #007AFF
 */

const COLORS = {
  direct: "#34C759",
  peerRelay: "#007AFF",
  derp: "#FF9500",
  error: "#FF3B30",
  idle: "#8E8E93",
};

function parseArgs(raw) {
  const result = {
    POLICY: "Tailscale",
    TITLE: "Tailscale 出口",
    ICON: "point.3.connected.trianglepath.dotted",
    SHORT_NAME: "true",
    AUTO_COLOR: "true",
    COLOR: "#007AFF",
  };
  if (!raw || typeof raw !== "string") return result;

  for (const pair of raw.split("&")) {
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key && val !== "") {
      try {
        result[key] = decodeURIComponent(val);
      } catch (_) {
        result[key] = val;
      }
    }
  }
  return result;
}

function toBool(val, fallback) {
  if (val === undefined || val === null || val === "") return fallback;
  return /^(true|1|yes|on)$/i.test(String(val).trim());
}

function formatNodeName(name, shortName) {
  if (!name) return "未知";
  const cleaned = String(name).replace(/\.$/, "");
  if (!shortName) return cleaned;
  const dotIdx = cleaned.indexOf(".");
  return dotIdx > 0 ? cleaned.slice(0, dotIdx) : cleaned;
}

function extractHost(addr) {
  if (!addr || typeof addr !== "string") return "";
  const s = addr.trim();
  if (s.startsWith("[")) {
    const end = s.indexOf("]");
    return end > 1 ? s.slice(1, end) : s;
  }
  const lastColon = s.lastIndexOf(":");
  return lastColon > 0 ? s.slice(0, lastColon) : s;
}

function findPeerRelayNodeName(ts, relayAddress, shortName) {
  const relayHost = extractHost(relayAddress);
  const peers = Array.isArray(ts.peers) ? ts.peers : [];

  if (relayHost) {
    const matched = peers.find((p) => {
      if (!p || !p.relayServerCandidate) return false;
      return extractHost(p.directAddress) === relayHost;
    });
    if (matched && matched.name) {
      return formatNodeName(matched.name, shortName);
    }
  }

  const servers = ts.peerRelay && Array.isArray(ts.peerRelay.servers) ? ts.peerRelay.servers : [];
  if (servers.length === 1) {
    return formatNodeName(servers[0], shortName);
  }
  return "";
}

function findDerpDisplay(ts, peer) {
  const code = peer.derpRegionCode || "";
  const regionID = peer.derpRegionID;
  const conns = Array.isArray(ts.derpConnections) ? ts.derpConnections : [];
  const conn = conns.find((c) => c && (c.regionID === regionID || (code && c.regionCode === code)));
  if (conn && conn.hostname) {
    return code ? `${conn.hostname} (${code})` : conn.hostname;
  }
  if (code) return `DERP ${code}`;
  if (regionID !== undefined && regionID !== null) return `DERP #${regionID}`;
  return "官方 DERP";
}

function resolveLatency(ts, peer) {
  if (typeof peer.latencyMs === "number" && Number.isFinite(peer.latencyMs)) {
    return `${Math.round(peer.latencyMs)} ms`;
  }
  const regionMap = ts.netcheck && ts.netcheck.regionLatencyMs;
  if (regionMap && peer.derpRegionID !== undefined) {
    const fallback = regionMap[String(peer.derpRegionID)];
    if (typeof fallback === "number" && Number.isFinite(fallback)) {
      return `约 ${Math.round(fallback)} ms`;
    }
  }
  return "未测得";
}

function buildPanel(args, data) {
  const shortName = toBool(args.SHORT_NAME, true);
  const autoColor = toBool(args.AUTO_COLOR, true);
  const pickColor = (stateColor) => (autoColor ? stateColor : args.COLOR);

  const ts = data && data.tailscale;
  if (!ts) {
    return {
      title: args.TITLE,
      content: `策略「${args.POLICY}」不是 Tailscale 代理或无运行数据`,
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
  const exitPeer =
    peers.find((p) => p && p.selectedExitNode === 1) ||
    (exitNode.selected ? peers.find((p) => p && p.name === exitNode.selected) : null);

  if (!exitNode.enabled || !exitPeer) {
    const homeDerp = ts.homeDERPRegionCode || "未知";
    const onlineCount = peers.filter((p) => p && p.online).length;
    return {
      title: args.TITLE,
      content: `出口节点：未启用\n在线节点：${onlineCount} 个\nHome DERP：${homeDerp}`,
      icon: args.ICON,
      "icon-color": pickColor(COLORS.idle),
    };
  }

  const nodeLabel = formatNodeName(exitPeer.name || exitNode.selected, shortName);
  const connType = String(exitPeer.connectionType || exitPeer.status || "").toLowerCase();
  const latencyText = resolveLatency(ts, exitPeer);

  if (!exitPeer.online || connType === "offline") {
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
    "icon-color": COLORS.error,
  };
}

(function main() {
  const args = parseArgs(typeof $argument === "string" ? $argument : "");
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
    if (!resp) {
      $done(failPanel(args, "获取失败：未收到 Surge HTTP API 响应"));
      return;
    }

    if (resp.error) {
      const errMsg = typeof resp.error === "string" ? resp.error : resp.error.message || JSON.stringify(resp.error);
      $done(failPanel(args, `查询失败：${errMsg}\n请确认已开启 http-api-mcp = true`));
      return;
    }

    const result = resp.result;
    const text = result && result.content && result.content[0] && result.content[0].text;
    if (!text) {
      $done(failPanel(args, "查询失败：MCP 返回缺少状态正文\n请确认已开启 http-api-mcp = true"));
      return;
    }

    if (result.isError) {
      $done(failPanel(args, `策略查询报错：${text}`));
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      $done(failPanel(args, `状态解析失败：${e.message || e}`));
      return;
    }

    $done(buildPanel(args, parsed));
  });
})();
