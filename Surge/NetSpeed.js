/**
 * Surge 信息面板: NetSpeed 测速脚本
 * 参考 Egern/NetSpeed_Widget.js 同步核心测速、速度分级样式与缓存回退逻辑
 *
 * $argument 参数（key=value 以 & 连接，均可选；若参数值含逗号请在 [Script] 中用双引号包裹整个 argument="..."）：
 * - policy: 测速使用的策略或策略组名，默认 DIRECT；传空值（policy=）或 "-" 时不传 policy，跟随 Surge 规则分流
 * - TEST_PACKET（兼容 SPEED_TEST_PACKET / mb）: 下行测速数据量（MB，支持小数），默认 3（按平台自动限制安全上限：iOS 16MB / Mac 64MB）
 * - timeout: 单次测速请求超时秒数，默认 4（适配 Surge 默认 5s 脚本超时，上限 60；若在 [Script] 中配置 timeout=10，建议设为 8）
 * - title: 面板标题，默认 NetSpeed
 *
 * 平台与版本说明：
 * - Panel 需 Surge iOS 4.9.3+ / Mac 5.7.5+；binary-mode 需 iOS 5.4.1+ / Mac 5.0.1+；auto-cookie / auto-redirect 需 iOS 5.9.0+ / Mac 5.5.0+（旧版自动忽略）
 * - Surge $httpClient 不支持流式读取，必须在超时内完整下完测速包才能算速：默认 3MB/4s 下低于约 6 Mbps（配套模块 3MB/8s 下低于约 3 Mbps）会超时并回退缓存
 * - 速率换算沿用 Egern 原脚本口径：1 MB = 1048576 字节
 */

const MB = 1048576;
const DEFAULT_TITLE = 'NetSpeed';
const DEFAULT_POLICY = 'DIRECT';
const RULE_POLICY_LABEL = '规则分流';
const DEFAULT_PACKET_MB = 3;
const MAX_PACKET_MB_IOS = 16;
const MAX_PACKET_MB_MAC = 64;
const DEFAULT_TIMEOUT = 4;
const MAX_TIMEOUT = 60;
const HTTP_API_TIMEOUT_MS = 600;
const RECENT_TIME_TOLERANCE_MS = 2000;
const MAX_POLICY_DEPTH = 10;
const MIN_DURATION = 0.01;
const SIZE_TOLERANCE = 0.01;
const MAX_RAW_KEY_ENCODED_LEN = 120;
const FAILED_TEXT = '⚠️ 测速失败';

const DEFAULT_SPEED_DATA = {
  mbps: 0,
  mBs: 0,
  duration: 0,
  timestamp: 0
};

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function decodeValue(value) {
  try {
    return decodeURIComponent(value);
  } catch (_) {
    return value;
  }
}

const UNRESOLVED_PLACEHOLDER_RE = /^\{\{\{[A-Za-z0-9_]+\}\}\}$/;

function parseArguments(raw) {
  const result = {};
  if (typeof raw !== 'string' || !raw.trim()) {
    return result;
  }

  for (const pair of raw.split('&')) {
    if (!pair) continue;
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;

    const key = pair.slice(0, eqIndex).trim();
    const value = decodeValue(pair.slice(eqIndex + 1).trim());
    if (!key || UNRESOLVED_PLACEHOLDER_RE.test(value)) continue;

    result[key] = value;
  }

  return result;
}

function getNonEmptyString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolvePolicy(arg) {
  if (!hasOwn(arg, 'policy')) {
    return DEFAULT_POLICY;
  }

  const value = getNonEmptyString(arg.policy);
  if (!value || value === '-') {
    return null;
  }

  return value;
}

function getMaxPacketMB() {
  const system =
    typeof $environment !== 'undefined' &&
    $environment &&
    typeof $environment.system === 'string'
      ? $environment.system.toLowerCase()
      : '';

  return system === 'macos' ? MAX_PACKET_MB_MAC : MAX_PACKET_MB_IOS;
}

function parsePositivePacketBytes(value, maxPacketMB) {
  const raw = getNonEmptyString(value);
  if (!raw) return 0;

  let mb = parseFloat(raw);
  if (!Number.isFinite(mb) || mb <= 0) {
    return 0;
  }

  if (mb > maxPacketMB) {
    console.log(`[NetSpeed] 测速包体 ${mb}MB 超过当前平台安全上限 ${maxPacketMB}MB，已自动限幅`);
    mb = maxPacketMB;
  }

  const bytes = Math.floor(mb * MB);
  return bytes > 0 ? bytes : 0;
}

function getPacketBytes(arg) {
  const maxPacketMB = getMaxPacketMB();
  const candidates = [arg.TEST_PACKET, arg.SPEED_TEST_PACKET, arg.mb];
  for (const candidate of candidates) {
    const bytes = parsePositivePacketBytes(candidate, maxPacketMB);
    if (bytes > 0) {
      return bytes;
    }
  }

  return DEFAULT_PACKET_MB * MB;
}

function getTimeoutSeconds(value) {
  const raw = getNonEmptyString(value);
  if (!raw) {
    return DEFAULT_TIMEOUT;
  }

  const seconds = parseFloat(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_TIMEOUT;
  }

  if (seconds > MAX_TIMEOUT) {
    console.log(
      `[NetSpeed] timeout=${seconds} 超过上限 ${MAX_TIMEOUT}s（单位为秒，非毫秒），已回退默认 ${DEFAULT_TIMEOUT}s`
    );
    return DEFAULT_TIMEOUT;
  }

  return seconds;
}

function hash64Hex(text) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= code ^ (i & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }

  return (
    h1.toString(16).padStart(8, '0') +
    h2.toString(16).padStart(8, '0')
  );
}

function getCacheKey(policy, resolvedNode) {
  const node = getNonEmptyString(resolvedNode);

  if (policy === null) {
    if (!node || node === RULE_POLICY_LABEL) {
      return 'netspeed_cache_rule';
    }

    const rawKey = `rule\0${node}`;
    const encoded = encodeURIComponent(rawKey);
    if (encoded.length <= MAX_RAW_KEY_ENCODED_LEN) {
      return `netspeed_cache_node_${encoded}`;
    }

    return `netspeed_cache_node_h_${hash64Hex(rawKey)}`;
  }

  if (node && node !== policy) {
    const rawKey = `${policy}\0${node}`;
    const encoded = encodeURIComponent(rawKey);
    if (encoded.length <= MAX_RAW_KEY_ENCODED_LEN) {
      return `netspeed_cache_node_${encoded}`;
    }

    return `netspeed_cache_node_h_${hash64Hex(rawKey)}`;
  }

  const encoded = encodeURIComponent(policy);
  if (encoded.length <= MAX_RAW_KEY_ENCODED_LEN) {
    return `netspeed_cache_policy_${encoded}`;
  }

  return `netspeed_cache_policy_h_${hash64Hex(policy)}`;
}

function normalizeSpeedData(data) {
  if (!data || typeof data !== 'object') {
    return { ...DEFAULT_SPEED_DATA };
  }

  const mbps = Number(data.mbps);
  const mBs = Number(data.mBs);
  const duration = Number(data.duration);
  const timestamp = Number(data.timestamp);

  return {
    mbps: Number.isFinite(mbps) && mbps >= 0 ? mbps : 0,
    mBs: Number.isFinite(mBs) && mBs >= 0 ? mBs : 0,
    duration: Number.isFinite(duration) && duration >= 0 ? duration : 0,
    timestamp: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0
  };
}

function getSpeedStyle(mbps, failed) {
  if (failed) {
    return {
      icon: 'exclamationmark.triangle.fill',
      color: '#FF3B30'
    };
  }

  if (mbps >= 50) {
    return {
      icon: 'bolt.fill',
      color: '#34C759'
    };
  }

  if (mbps >= 10) {
    return {
      icon: 'hare.fill',
      color: '#007AFF'
    };
  }

  return {
    icon: 'tortoise',
    color: '#FF9500'
  };
}

function loadCachedSpeedData(cacheKey) {
  try {
    if (typeof $persistentStore === 'undefined') {
      return { ...DEFAULT_SPEED_DATA };
    }

    const raw = $persistentStore.read(cacheKey);
    if (!raw) {
      return { ...DEFAULT_SPEED_DATA };
    }

    return normalizeSpeedData(JSON.parse(raw));
  } catch (_) {
    return { ...DEFAULT_SPEED_DATA };
  }
}

function saveCachedSpeedData(cacheKey, data) {
  try {
    if (typeof $persistentStore !== 'undefined') {
      const ok = $persistentStore.write(JSON.stringify(data), cacheKey);
      if (ok === false) {
        console.log(`[NetSpeed] 写入缓存失败: key=${cacheKey}`);
      }
    }
  } catch (e) {
    console.log(`[NetSpeed] 写入缓存异常: ${e && e.message ? e.message : e}`);
  }
}

function httpGet(options) {
  return new Promise((resolve, reject) => {
    $httpClient.get(options, (error, response, data) => {
      if (error) {
        reject(error);
        return;
      }

      resolve({ response, data });
    });
  });
}

function getByteLength(data) {
  if (!data) return 0;
  if (typeof data.byteLength === 'number') return data.byteLength;
  if (typeof data === 'string') return data.length;
  return 0;
}

function isExpectedSize(actualBytes, expectedBytes) {
  if (actualBytes <= 0 || expectedBytes <= 0) {
    return false;
  }

  const minBytes = expectedBytes * (1 - SIZE_TOLERANCE);
  const maxBytes = expectedBytes * (1 + SIZE_TOLERANCE);
  return actualBytes >= minBytes && actualBytes <= maxBytes;
}

async function measureSpeed(url, policy, policyLabel, timeout, expectedBytes) {
  const startTime = Date.now();
  const options = {
    url,
    headers: {
      'Cache-Control': 'no-cache',
      'Accept-Encoding': 'identity'
    },
    timeout,
    'auto-cookie': false,
    'auto-redirect': false,
    'binary-mode': true
  };

  if (policy !== null) {
    options.policy = policy;
  }

  try {
    const { response, data } = await httpGet(options);

    const status = Number(response && response.status);
    if (!Number.isFinite(status) || status < 200 || status >= 300) {
      console.log(`[NetSpeed] 测速失败 (${policyLabel}): HTTP ${response ? response.status : 'unknown'}`);
      return null;
    }

    const downloadedBytes = getByteLength(data);
    const duration = (Date.now() - startTime) / 1000;

    if (!isExpectedSize(downloadedBytes, expectedBytes)) {
      console.log(
        `[NetSpeed] 响应体大小异常 (${policyLabel}): expected=${expectedBytes}, actual=${downloadedBytes}`
      );
      return null;
    }

    if (duration < MIN_DURATION) {
      console.log(`[NetSpeed] 测速耗时过短 (${policyLabel}): duration=${duration}s`);
      return null;
    }

    const speedMBs = downloadedBytes / MB / duration;

    return {
      mbps: Number((speedMBs * 8).toFixed(1)),
      mBs: Number(speedMBs.toFixed(2)),
      duration: Number(duration.toFixed(2)),
      timestamp: Date.now()
    };
  } catch (e) {
    console.log(`[NetSpeed] 测速失败 (${policyLabel}): ${e && e.message ? e.message : e}`);
    return null;
  }
}

function createRunId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${ts}${rand}`;
}

function toEpochMs(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return num > 1e12 ? num : num * 1000;
}

function getRemainingMs(deadline) {
  return Math.max(0, deadline - Date.now());
}

function httpApiGet(path, params, timeoutMs) {
  if (typeof $httpAPI !== 'function' || timeoutMs <= 0) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    if (typeof setTimeout === 'function') {
      setTimeout(() => finish(null), timeoutMs);
    }

    try {
      $httpAPI('GET', path, params || null, (result) => {
        finish(result && typeof result === 'object' ? result : null);
      });
    } catch (_) {
      finish(null);
    }
  });
}

function getSelectGroupDetails() {
  try {
    if (
      typeof $surge !== 'undefined' &&
      $surge &&
      typeof $surge.selectGroupDetails === 'function'
    ) {
      const details = $surge.selectGroupDetails();
      if (details && typeof details === 'object') {
        return {
          groups: details.groups && typeof details.groups === 'object' ? details.groups : {},
          decisions: details.decisions && typeof details.decisions === 'object' ? details.decisions : {}
        };
      }
    }
  } catch (_) {}

  return null;
}

async function followSelectChain(startName, selectDetails, apiDeadline) {
  let current = getNonEmptyString(startName);
  if (!current) return '';

  const visited = new Set([current]);

  if (selectDetails) {
    for (let i = 0; i < MAX_POLICY_DEPTH; i++) {
      const next = getNonEmptyString(selectDetails.decisions[current]);
      if (!next || visited.has(next)) break;
      visited.add(next);
      current = next;
    }
    return current;
  }

  for (let i = 0; i < MAX_POLICY_DEPTH; i++) {
    const remaining = getRemainingMs(apiDeadline);
    if (remaining <= 0) break;
    const res = await httpApiGet('/v1/policy_groups/select', { group_name: current }, remaining);
    const next = getNonEmptyString(res && res.policy);
    if (!next || visited.has(next)) break;
    visited.add(next);
    current = next;
  }

  return current;
}

function pickNewerRequest(current, candidate) {
  if (!current) return candidate;

  const curId = Number(current.id);
  const candId = Number(candidate.id);
  if (Number.isFinite(curId) && Number.isFinite(candId) && candId !== curId) {
    return candId > curId ? candidate : current;
  }

  const curTime = toEpochMs(current.startDate);
  const candTime = toEpochMs(candidate.startDate);
  if (candTime > curTime) {
    return candidate;
  }

  return current;
}

function findRecentSpeedRequest(recentData, runId, startedAt, finishedAt, policy) {
  const list =
    recentData && Array.isArray(recentData.requests) ? recentData.requests : [];
  if (list.length === 0) return null;

  const token = `_=${runId}`;
  let exactMatch = null;
  let downWindowMatch = null;
  let hostWindowMatch = null;

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const url = getNonEmptyString(item.URL || item.url);
    if (!url) continue;

    const urlLower = url.toLowerCase();
    if (!urlLower.includes('speed.cloudflare.com')) continue;

    if (url.includes(token)) {
      exactMatch = pickNewerRequest(exactMatch, item);
      continue;
    }

    const startMs = toEpochMs(item.startDate);
    if (
      startMs <= 0 ||
      startMs < startedAt - RECENT_TIME_TOLERANCE_MS ||
      startMs > finishedAt + RECENT_TIME_TOLERANCE_MS
    ) {
      continue;
    }

    if (policy !== null) {
      const origPolicy = getNonEmptyString(item.originalPolicyName);
      if (origPolicy && origPolicy !== policy) {
        continue;
      }
    }

    if (urlLower.includes('/__down')) {
      downWindowMatch = pickNewerRequest(downWindowMatch, item);
    } else {
      hostWindowMatch = pickNewerRequest(hostWindowMatch, item);
    }
  }

  return exactMatch || downWindowMatch || hostWindowMatch;
}

async function resolveSpeedNode(policy, runId, startedAt, finishedAt) {
  if (policy === DEFAULT_POLICY) {
    return {
      node: DEFAULT_POLICY,
      display: DEFAULT_POLICY
    };
  }

  const apiDeadline = Date.now() + HTTP_API_TIMEOUT_MS;
  const selectDetails = getSelectGroupDetails();
  const selectGroups = selectDetails ? selectDetails.groups : null;
  const recentData = await httpApiGet('/v1/requests/recent', null, getRemainingMs(apiDeadline));
  const recentReq = findRecentSpeedRequest(recentData, runId, startedAt, finishedAt, policy);
  const recentPolicy = getNonEmptyString(recentReq && recentReq.policyName);
  const recentResolved = recentPolicy
    ? await followSelectChain(recentPolicy, selectDetails, apiDeadline)
    : '';

  if (policy !== null) {
    const selectLeaf = await followSelectChain(policy, selectDetails, apiDeadline);
    let finalNode = selectLeaf;

    if (recentResolved) {
      if (selectLeaf === policy) {
        if (recentResolved !== policy) {
          finalNode = recentResolved;
        }
      } else if (
        recentResolved !== policy &&
        recentResolved !== selectLeaf &&
        !(selectGroups && hasOwn(selectGroups, recentResolved))
      ) {
        finalNode = recentResolved;
      }
    }

    const resolved = finalNode || policy;
    return {
      node: resolved,
      display: resolved
    };
  }

  if (recentResolved) {
    return {
      node: recentResolved,
      display: recentResolved
    };
  }

  return {
    node: '',
    display: RULE_POLICY_LABEL
  };
}

(async () => {
  const arg = parseArguments(typeof $argument !== 'undefined' ? $argument : '');
  const panelTitle = getNonEmptyString(arg.title) || DEFAULT_TITLE;
  const policy = resolvePolicy(arg);
  const policyLabel = policy === null ? RULE_POLICY_LABEL : policy;
  const packetBytes = getPacketBytes(arg);
  const timeout = getTimeoutSeconds(arg.timeout);
  const runId = createRunId();
  const speedTestUrl = `https://speed.cloudflare.com/__down?bytes=${packetBytes}&_=${runId}`;
  let nodeDisplay = policyLabel;

  try {
    const startedAt = Date.now();
    const measuredData = await measureSpeed(
      speedTestUrl,
      policy,
      policyLabel,
      timeout,
      packetBytes
    );
    const finishedAt = Date.now();

    const nodeInfo = await resolveSpeedNode(policy, runId, startedAt, finishedAt);
    nodeDisplay = nodeInfo.display;
    const cacheKey = getCacheKey(policy, nodeInfo.node);

    let speedData;
    let fromCache = false;

    if (measuredData) {
      speedData = measuredData;
      saveCachedSpeedData(cacheKey, speedData);
    } else {
      speedData = loadCachedSpeedData(cacheKey);
      fromCache = true;
    }

    const failed = speedData.timestamp <= 0 || speedData.duration <= 0;
    const style = getSpeedStyle(speedData.mbps, failed);

    const content = failed
      ? `${FAILED_TEXT}\n测速节点: ${nodeDisplay}`
      : [
          `下行速率: ${speedData.mbps} Mbps [${speedData.mBs} MB/s]`,
          `测试耗时: ${speedData.duration}s${fromCache ? ' (缓存)' : ''}`,
          `测速节点: ${nodeDisplay}`
        ].join('\n');

    $done({
      title: panelTitle,
      content,
      icon: style.icon,
      'icon-color': style.color
    });
  } catch (e) {
    console.log(`[NetSpeed] 执行异常: ${e && e.message ? e.message : e}`);
    const style = getSpeedStyle(0, true);
    $done({
      title: panelTitle,
      content: `${FAILED_TEXT}\n测速节点: ${nodeDisplay}`,
      icon: style.icon,
      'icon-color': style.color
    });
  }
})();