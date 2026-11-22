/**
 * Surge 信息面板: NetSpeed 测速脚本
 * 参考 Egern/NetSpeed_Widget.js 同步核心测速、速度分级样式与缓存回退逻辑
 *
 * $argument 参数（key=value 以 & 连接，均可选；若参数值含逗号请在 [Script] 中用双引号包裹整个 argument="..."）：
 * - policy: 测速使用的策略或策略组名，默认 DIRECT；显式留空（policy=）时不传 policy，跟随 Surge 规则分流
 * - SPEED_TEST_PACKET / mb: 下行测速数据量（MB，支持小数），默认 3（按平台自动限制安全上限：iOS 16MB / Mac 64MB）
 * - timeout: 单次测速请求超时秒数，默认 4（适配 Surge 默认 5s 脚本超时，上限 60；若在 [Script] 中配置 timeout=10，建议设为 8）
 * - title: 面板标题，默认 NetSpeed
 * - icon: 测速成功时覆盖默认速度分级 SF Symbol 图标
 * - icon-color: 测速成功时覆盖默认速度分级 HEX 颜色
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
    const value = pair.slice(eqIndex + 1).trim();
    if (!key) continue;

    result[key] = decodeValue(value);
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
  return value || null;
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
  const fromPacket = parsePositivePacketBytes(arg.SPEED_TEST_PACKET, maxPacketMB);
  if (fromPacket > 0) {
    return fromPacket;
  }

  const fromMb = parsePositivePacketBytes(arg.mb, maxPacketMB);
  if (fromMb > 0) {
    return fromMb;
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

function getCacheKey(policy) {
  if (policy === null) {
    return 'netspeed_cache_rule';
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

function formatTime(timestamp) {
  if (!timestamp) return '--:--';

  const date = new Date(timestamp);
  const dateTime = date.getTime();

  if (!Number.isFinite(dateTime)) {
    return '--:--';
  }

  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${hour}:${minute}`;
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

(async () => {
  const arg = parseArguments(typeof $argument !== 'undefined' ? $argument : '');
  const panelTitle = getNonEmptyString(arg.title) || DEFAULT_TITLE;
  const policy = resolvePolicy(arg);
  const policyLabel = policy === null ? RULE_POLICY_LABEL : policy;
  const packetBytes = getPacketBytes(arg);
  const timeout = getTimeoutSeconds(arg.timeout);
  const speedTestUrl = `https://speed.cloudflare.com/__down?bytes=${packetBytes}`;
  const cacheKey = getCacheKey(policy);

  try {
    const measuredData = await measureSpeed(
      speedTestUrl,
      policy,
      policyLabel,
      timeout,
      packetBytes
    );

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
    const timeStr = failed ? '--:--' : formatTime(speedData.timestamp);

    const content = failed
      ? `${FAILED_TEXT}\n测速策略: ${policyLabel} | ↻ ${timeStr}`
      : [
          `下行速率: ${speedData.mbps} Mbps [${speedData.mBs} MB/s]`,
          `测试耗时: ${speedData.duration}s | ↻ ${timeStr}${fromCache ? ' (缓存)' : ''}`,
          `测速策略: ${policyLabel}`
        ].join('\n');

    const customIcon = getNonEmptyString(arg.icon);
    const customColor = getNonEmptyString(arg['icon-color']);

    $done({
      title: panelTitle,
      content,
      icon: failed ? style.icon : (customIcon || style.icon),
      'icon-color': failed ? style.color : (customColor || style.color)
    });
  } catch (e) {
    console.log(`[NetSpeed] 执行异常: ${e && e.message ? e.message : e}`);
    const style = getSpeedStyle(0, true);
    $done({
      title: panelTitle,
      content: `${FAILED_TEXT}\n测速策略: ${policyLabel} | ↻ --:--`,
      icon: style.icon,
      'icon-color': style.color
    });
  }
})();