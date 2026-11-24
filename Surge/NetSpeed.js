/**
 * Surge 信息面板：NetSpeed 下行测速脚本
 *
 * $argument 参数（key=value 以 & 连接，均可选；支持 URL 编码，字面 % 请写 %25；
 * 参数值含逗号时请用双引号包裹整个 argument="..."）：
 * - policy：测速策略或策略组名，默认 DIRECT；传空值（policy=）或 "-" 时跟随 Surge 规则分流
 * - TEST_PACKET（兼容 SPEED_TEST_PACKET / mb）：下行测速数据量（MB，支持小数），
 *   默认 3（iOS 上限 16 且建议不超过 8，大包体可能增加内存占用 / Mac 上限 64）
 * - timeout：单次测速请求超时秒数，默认 4（脚本上限 60，仅在手动调大 [Script] timeout 时生效；模块 timeout=10 下建议不超过 8）
 * - title：面板标题，默认 NetSpeed
 *
 * 说明：Surge $httpClient 不支持流式读取，须在超时内完整下完测速包才能算速；
 * 默认 3MB/4s 下低于约 6 Mbps（模块 3MB/8s 下低于约 3 Mbps）会超时并回退缓存。
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
const RECENT_START_UPPER_TOLERANCE_MS = 3000;
const MAX_POLICY_DEPTH = 10;
const MIN_DURATION = 0.01;
const SIZE_TOLERANCE = 0.01;
const MAX_RAW_KEY_ENCODED_LEN = 120;
const FAILED_TEXT = '⚠️ 测速失败';

const UNRESOLVED_PLACEHOLDER_RE = /^\{\{\{[A-Za-z0-9_]+\}\}\}$/;
const STRICT_DECIMAL_RE = /^\d+(?:\.\d+)?$/;
const SPEED_HOST_RE = /^(?:https?:\/\/)?speed\.cloudflare\.com(?::\d+)?(?:\/|\?|$)/i;

const DEFAULT_SPEED_DATA = {
  mbps: 0,
  mBs: 0,
  duration: 0,
  timestamp: 0,
  node: ''
};

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function decodeValue(value) {
  try {
    return decodeURIComponent(value);
  } catch (_) {
    console.log(`[NetSpeed] 参数值 URL 解码失败，已按原文使用: ${value}`);
    return value;
  }
}

function parseArguments(raw) {
  const result = {};
  if (typeof raw !== 'string' || !raw.trim()) {
    return result;
  }

  for (const pair of raw.split('&')) {
    if (!pair) {
      continue;
    }

    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }

    const key = pair.slice(0, eqIndex).trim();
    const rawValue = pair.slice(eqIndex + 1).trim();
    if (!key || UNRESOLVED_PLACEHOLDER_RE.test(rawValue)) {
      continue;
    }

    result[key] = decodeValue(rawValue);
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
  const hasSystem =
    typeof $environment !== 'undefined' &&
    $environment &&
    typeof $environment.system === 'string';
  const system = hasSystem ? $environment.system.toLowerCase() : '';
  return system === 'macos' ? MAX_PACKET_MB_MAC : MAX_PACKET_MB_IOS;
}

function parsePositivePacketBytes(value, maxPacketMB) {
  const raw = getNonEmptyString(value);
  if (!raw) {
    return 0;
  }

  if (!STRICT_DECIMAL_RE.test(raw)) {
    console.log(`[NetSpeed] 测速包体参数无效 (${raw})，已忽略`);
    return 0;
  }

  let mb = Number(raw);
  if (!Number.isFinite(mb) || mb <= 0) {
    console.log(`[NetSpeed] 测速包体参数无效 (${raw})，已忽略`);
    return 0;
  }

  if (mb > maxPacketMB) {
    console.log(
      `[NetSpeed] 测速包体 ${mb}MB 超过当前平台安全上限 ${maxPacketMB}MB，已自动限幅`
    );
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

  if (!STRICT_DECIMAL_RE.test(raw)) {
    console.log(
      `[NetSpeed] timeout=${raw} 格式无效，已回退默认 ${DEFAULT_TIMEOUT}s`
    );
    return DEFAULT_TIMEOUT;
  }

  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    console.log(
      `[NetSpeed] timeout=${raw} 无效，已回退默认 ${DEFAULT_TIMEOUT}s`
    );
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

function buildKeyWithHash(prefix, hashPrefix, rawKey) {
  const encoded = encodeURIComponent(rawKey);
  if (encoded.length <= MAX_RAW_KEY_ENCODED_LEN) {
    return `${prefix}${encoded}`;
  }

  return `${hashPrefix}${hash64Hex(rawKey)}`;
}

function getFallbackCacheKey(policy) {
  if (policy === null) {
    return 'netspeed_cache_rule';
  }

  return buildKeyWithHash(
    'netspeed_cache_policy_',
    'netspeed_cache_policy_h_',
    policy
  );
}

function getCacheKey(policy, resolvedNode) {
  const node = getNonEmptyString(resolvedNode);

  if (policy === null) {
    if (!node || node === RULE_POLICY_LABEL) {
      return 'netspeed_cache_rule';
    }

    return buildKeyWithHash(
      'netspeed_cache_rule_node_',
      'netspeed_cache_rule_node_h_',
      node
    );
  }

  if (node && node !== policy) {
    return buildKeyWithHash(
      'netspeed_cache_node_',
      'netspeed_cache_node_h_',
      `${policy}\0${node}`
    );
  }

  return getFallbackCacheKey(policy);
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
    timestamp: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0,
    node: getNonEmptyString(data.node)
  };
}

function isValidSpeedData(data) {
  return Boolean(data && data.timestamp > 0 && data.duration > 0);
}

function getSpeedStyle(mbps, failed) {
  if (failed) {
    return {
      icon: 'exclamationmark.triangle.fill',
      color: '#FF383C'
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
      color: '#0088FF'
    };
  }

  return {
    icon: 'tortoise',
    color: '#FF8D28'
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
    console.log(
      `[NetSpeed] 写入缓存异常: ${e && e.message ? e.message : e}`
    );
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
  if (!data) {
    return 0;
  }

  if (typeof data.byteLength === 'number') {
    return data.byteLength;
  }

  if (typeof data === 'string') {
    return data.length;
  }

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
      const statusText = response ? response.status : 'unknown';
      console.log(`[NetSpeed] 测速失败 (${policyLabel}): HTTP ${statusText}`);
      return null;
    }

    const downloadedBytes = getByteLength(data);
    const duration = (Date.now() - startTime) / 1000;

    if (!isExpectedSize(downloadedBytes, expectedBytes)) {
      console.log(
        `[NetSpeed] 响应体大小异常 (${policyLabel}): ` +
          `expected=${expectedBytes}, actual=${downloadedBytes}`
      );
      return null;
    }

    if (duration < MIN_DURATION) {
      console.log(
        `[NetSpeed] 测速耗时过短 (${policyLabel}): duration=${duration}s`
      );
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
    console.log(
      `[NetSpeed] 测速失败 (${policyLabel}): ${e && e.message ? e.message : e}`
    );
    return null;
  }
}

function createRunId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2).padEnd(6, '0').slice(0, 6);
  return `${ts}${rand}`;
}

function toEpochMs(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return 0;
  }

  return num > 1e12 ? num : num * 1000;
}

function getRemainingMs(deadline) {
  return Math.max(0, deadline - Date.now());
}

function buildApiPath(path, params) {
  if (!params || typeof params !== 'object') {
    return path;
  }

  const pairs = [];
  for (const key of Object.keys(params)) {
    const val = params[key];
    if (val === undefined || val === null) {
      continue;
    }

    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`);
  }

  if (pairs.length === 0) {
    return path;
  }

  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}${pairs.join('&')}`;
}

function httpApiGet(path, params, timeoutMs) {
  if (typeof $httpAPI !== 'function' || timeoutMs <= 0) {
    return Promise.resolve(null);
  }

  const requestPath = buildApiPath(path, params);

  return new Promise((resolve) => {
    let settled = false;
    let timerId = null;

    const finish = (value) => {
      if (settled) {
        return;
      }

      settled = true;
      if (timerId !== null && typeof clearTimeout === 'function') {
        clearTimeout(timerId);
        timerId = null;
      }

      resolve(value);
    };

    if (typeof setTimeout === 'function') {
      timerId = setTimeout(() => {
        console.log(`[NetSpeed] $httpAPI 查询超时 (${path})`);
        finish(null);
      }, timeoutMs);
    }

    try {
      $httpAPI('GET', requestPath, null, (result) => {
        finish(result && typeof result === 'object' ? result : null);
      });
    } catch (e) {
      console.log(
        `[NetSpeed] $httpAPI 调用异常 (${path}): ${e && e.message ? e.message : e}`
      );
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
        const groups =
          details.groups && typeof details.groups === 'object'
            ? details.groups
            : {};
        const decisions =
          details.decisions && typeof details.decisions === 'object'
            ? details.decisions
            : {};
        return { groups, decisions };
      }
    }
  } catch (e) {
    console.log(
      `[NetSpeed] 读取策略组信息异常: ${e && e.message ? e.message : e}`
    );
  }

  return null;
}

async function followSelectChain(startName, selectDetails, apiDeadline) {
  let current = getNonEmptyString(startName);
  if (!current) {
    return { node: '', complete: true };
  }

  const visited = new Set([current]);

  if (selectDetails) {
    for (let i = 0; i < MAX_POLICY_DEPTH; i++) {
      const next = getNonEmptyString(selectDetails.decisions[current]);
      if (!next || visited.has(next)) {
        return { node: current, complete: true };
      }

      visited.add(next);
      current = next;
    }

    const more = getNonEmptyString(selectDetails.decisions[current]);
    return { node: current, complete: !more || visited.has(more) };
  }

  for (let i = 0; i < MAX_POLICY_DEPTH; i++) {
    const remaining = getRemainingMs(apiDeadline);
    if (remaining <= 0) {
      return { node: current, complete: false };
    }

    const res = await httpApiGet(
      '/v1/policy_groups/select',
      { group_name: current },
      remaining
    );
    if (res === null && getRemainingMs(apiDeadline) <= 0) {
      return { node: current, complete: false };
    }

    const next = getNonEmptyString(res && res.policy);
    if (!next || visited.has(next)) {
      return { node: current, complete: true };
    }

    visited.add(next);
    current = next;
  }

  return { node: current, complete: false };
}

function hasRunIdToken(url, runId) {
  const token = `_=${runId}`;
  let pos = url.indexOf(token);
  while (pos !== -1) {
    const before = pos > 0 ? url.charAt(pos - 1) : '';
    const afterPos = pos + token.length;
    const after = afterPos < url.length ? url.charAt(afterPos) : '';
    if (
      (before === '?' || before === '&') &&
      (after === '' || after === '&')
    ) {
      return true;
    }

    pos = url.indexOf(token, pos + 1);
  }

  return false;
}

function pickNewerRequest(current, candidate) {
  if (!current) {
    return candidate;
  }

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

function pickClosestRequest(current, candidate, startedAt) {
  if (!current) {
    return candidate;
  }

  const curDiff = Math.abs(toEpochMs(current.startDate) - startedAt);
  const candDiff = Math.abs(toEpochMs(candidate.startDate) - startedAt);
  if (candDiff !== curDiff) {
    return candDiff < curDiff ? candidate : current;
  }

  return pickNewerRequest(current, candidate);
}

function findRecentSpeedRequest(
  recentData,
  runId,
  startedAt,
  finishedAt,
  policy,
  selectLeaf
) {
  const list =
    recentData && Array.isArray(recentData.requests)
      ? recentData.requests
      : [];
  if (list.length === 0) {
    return null;
  }

  const windowStart = startedAt - RECENT_TIME_TOLERANCE_MS;
  const windowEnd = Math.min(
    finishedAt + RECENT_TIME_TOLERANCE_MS,
    startedAt + RECENT_START_UPPER_TOLERANCE_MS
  );
  let exactMatch = null;
  let downWindowMatch = null;
  let hostWindowMatch = null;

  for (const item of list) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const url = getNonEmptyString(item.URL || item.url);
    if (!url || !SPEED_HOST_RE.test(url)) {
      continue;
    }

    if (hasRunIdToken(url, runId)) {
      exactMatch = pickNewerRequest(exactMatch, item);
      continue;
    }

    const startMs = toEpochMs(item.startDate);
    if (startMs <= 0 || startMs < windowStart || startMs > windowEnd) {
      continue;
    }

    if (policy !== null) {
      const origPolicy = getNonEmptyString(item.originalPolicyName);
      const matchesPolicy =
        origPolicy === policy ||
        (Boolean(selectLeaf) && origPolicy === selectLeaf);
      if (!matchesPolicy) {
        continue;
      }
    }

    if (url.toLowerCase().includes('/__down')) {
      downWindowMatch = pickClosestRequest(downWindowMatch, item, startedAt);
    } else {
      hostWindowMatch = pickClosestRequest(hostWindowMatch, item, startedAt);
    }
  }

  if (exactMatch) {
    return { item: exactMatch, exact: true };
  }

  if (downWindowMatch) {
    return { item: downWindowMatch, exact: false };
  }

  if (hostWindowMatch) {
    return { item: hostWindowMatch, exact: false };
  }

  return null;
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
  const selectChain =
    policy !== null
      ? await followSelectChain(policy, selectDetails, apiDeadline)
      : { node: '', complete: true };
  const selectLeaf = selectChain.node;

  const recentData = await httpApiGet(
    '/v1/requests/recent',
    null,
    getRemainingMs(apiDeadline)
  );
  const recentMatch = findRecentSpeedRequest(
    recentData,
    runId,
    startedAt,
    finishedAt,
    policy,
    selectLeaf
  );
  const recentReq = recentMatch ? recentMatch.item : null;
  const recentExact = Boolean(recentMatch && recentMatch.exact);
  const recentOrigPolicy = getNonEmptyString(
    recentReq && recentReq.originalPolicyName
  );
  const recentPolicy = getNonEmptyString(recentReq && recentReq.policyName);
  const recentChain = recentPolicy
    ? await followSelectChain(recentPolicy, selectDetails, apiDeadline)
    : { node: '', complete: true };
  const recentResolved = recentChain.node;

  if (policy !== null) {
    let finalNode = selectLeaf;
    const recentIsUnexpandedSelect =
      !recentChain.complete ||
      Boolean(selectGroups && hasOwn(selectGroups, recentResolved));
    const recentReliable =
      recentExact ||
      recentOrigPolicy === policy ||
      (selectLeaf !== policy && recentOrigPolicy === selectLeaf);

    if (recentResolved && !recentIsUnexpandedSelect && recentReliable) {
      if (selectLeaf === policy) {
        if (recentResolved !== policy) {
          finalNode = recentResolved;
        }
      } else if (
        recentResolved !== policy &&
        recentResolved !== selectLeaf
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
  const speedTestUrl =
    `https://speed.cloudflare.com/__down?bytes=${packetBytes}&_=${runId}`;
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

    const nodeInfo = await resolveSpeedNode(
      policy,
      runId,
      startedAt,
      finishedAt
    );
    nodeDisplay = nodeInfo.display;

    const primaryCacheKey = getCacheKey(policy, nodeInfo.node);
    const fallbackCacheKey = getFallbackCacheKey(policy);

    let speedData;
    let fromCache = false;

    if (measuredData) {
      const record = {
        ...measuredData,
        node: nodeInfo.node
      };
      speedData = record;
      saveCachedSpeedData(primaryCacheKey, record);
      if (fallbackCacheKey !== primaryCacheKey) {
        saveCachedSpeedData(fallbackCacheKey, record);
      }
    } else {
      const primaryData = loadCachedSpeedData(primaryCacheKey);
      if (isValidSpeedData(primaryData)) {
        speedData = primaryData;
        if (
          primaryCacheKey === fallbackCacheKey &&
          primaryData.node &&
          primaryData.node !== RULE_POLICY_LABEL
        ) {
          nodeDisplay = primaryData.node;
        }
      } else if (fallbackCacheKey !== primaryCacheKey) {
        const fallbackData = loadCachedSpeedData(fallbackCacheKey);
        const canUseFallback =
          isValidSpeedData(fallbackData) &&
          fallbackData.node === nodeInfo.node;
        speedData = canUseFallback ? fallbackData : { ...DEFAULT_SPEED_DATA };
      } else {
        speedData = { ...DEFAULT_SPEED_DATA };
      }
      fromCache = true;
    }

    const failed = !isValidSpeedData(speedData);
    const style = getSpeedStyle(speedData.mbps, failed);

    const content = failed
      ? `${FAILED_TEXT}\n测速节点：${nodeDisplay}`
      : [
          `下行速率：${speedData.mbps.toFixed(1)} Mbps ` +
            `[${speedData.mBs.toFixed(2)} MB/s]`,
          `测试耗时：${speedData.duration.toFixed(2)}s` +
            `${fromCache ? '（缓存）' : ''}`,
          `测速节点：${nodeDisplay}`
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
      content: `${FAILED_TEXT}\n测速节点：${nodeDisplay}`,
      icon: style.icon,
      'icon-color': style.color
    });
  }
})();