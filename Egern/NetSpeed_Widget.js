/**
 * 📌 桌面小组件: NetSpeed 小组件
 * 小组件环境变量：
 * 1、名称 policy，值为策略组名称，默认 DIRECT；
 * 2、下行测速数据量 SPEED_TEST_PACKET，值为数字，默认 3MB
 */

const MB = 1048576;
const DEFAULT_POLICY = 'DIRECT';
const DEFAULT_PACKET_MB = 3;
const TIMEOUT = 8000;

const DEFAULT_SPEED_DATA = {
  mbps: 0,
  mBs: 0,
  duration: 0,
  timestamp: 0
};

function getNowMs() {
  return typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now();
}

function getPacketBytes(value) {
  const mb = parseFloat(value);
  if (!Number.isFinite(mb) || mb <= 0) {
    return DEFAULT_PACKET_MB * MB;
  }

  const bytes = Math.floor(mb * MB);
  return bytes > 0 ? bytes : DEFAULT_PACKET_MB * MB;
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

function getSpeedStyle(mbps) {
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

function getBarWidth(mbps) {
  const minWidth = 30;
  const maxWidth = 140;
  const maxSpeed = 120;

  const width = minWidth + (mbps / maxSpeed) * (maxWidth - minWidth);
  return Math.min(Math.max(width, minWidth), maxWidth);
}

function loadCachedSpeedData(ctx, cacheKey) {
  try {
    return normalizeSpeedData(ctx.storage.getJSON(cacheKey));
  } catch {
    return { ...DEFAULT_SPEED_DATA };
  }
}

async function cancelResponseBody(response) {
  try {
    await response?.body?.cancel?.();
  } catch {}
}

async function measureSpeed(ctx, url, policy) {
  let reader;
  let completed = false;
  let downloadedBytes = 0;
  const startTime = getNowMs();

  try {
    const response = await ctx.http.get(url, {
      headers: { 'Cache-Control': 'no-cache' },
      timeout: TIMEOUT,
      policy,
      credentials: 'omit'
    });

    if (!response || response.status < 200 || response.status >= 300) {
      await cancelResponseBody(response);
      return null;
    }

    reader = response.body?.getReader();
    if (!reader) {
      return null;
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        completed = true;
        break;
      }

      downloadedBytes += value?.byteLength || value?.length || 0;
    }

    const duration = (getNowMs() - startTime) / 1000;

    if (downloadedBytes <= 0 || duration < 0.2) {
      return null;
    }

    const speedMBs = downloadedBytes / MB / duration;

    return {
      mbps: Number((speedMBs * 8).toFixed(1)),
      mBs: Number(speedMBs.toFixed(2)),
      duration: Number(duration.toFixed(2)),
      timestamp: Date.now()
    };
  } catch {
    return null;
  } finally {
    if (reader && !completed) {
      try {
        await reader.cancel();
      } catch {}
    }
  }
}

export default async function(ctx) {
  const policy = ctx.env?.policy || DEFAULT_POLICY;
  const packetBytes = getPacketBytes(ctx.env?.SPEED_TEST_PACKET);
  const speedTestUrl = `https://speed.cloudflare.com/__down?bytes=${packetBytes}`;
  const cacheKey = `netspeed_cache_${policy}`;

  const measuredData = await measureSpeed(ctx, speedTestUrl, policy);

  let speedData;
  if (measuredData) {
    speedData = measuredData;

    try {
      ctx.storage.setJSON(cacheKey, speedData);
    } catch {}
  } else {
    speedData = loadCachedSpeedData(ctx, cacheKey);
  }

  const isSmall = ctx.widgetFamily === 'systemSmall';
  const { icon, color } = getSpeedStyle(speedData.mbps);
  const barWidth = getBarWidth(speedData.mbps);
  const timeStr = formatTime(speedData.timestamp);

  return {
    type: 'widget',
    padding: isSmall ? 12 : 16,
    gap: isSmall ? 8 : 12,

    backgroundColor: {
      light: '#FFFFFF',
      dark: '#2C2C2E'
    },

    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        children: [
          {
            type: 'image',
            src: `sf-symbol:${icon}`,
            width: isSmall ? 14 : 16,
            height: isSmall ? 14 : 16,
            color
          },
          {
            type: 'text',
            text: ' NetSpeed',
            font: { size: isSmall ? 'caption2' : 'caption1', weight: 'semibold' },
            textColor: color
          },
          { type: 'spacer' },
          {
            type: 'text',
            text: `↻ ${timeStr}`,
            font: { size: 'caption2' },
            textColor: { light: '#8E8E93', dark: '#8E8E93' }
          }
        ]
      },
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        children: [
          { type: 'spacer' },
          {
            type: 'text',
            text: isSmall ? `${speedData.mbps}\nMbps` : `${speedData.mbps} Mbps`,
            textAlign: 'center',
            font: { size: isSmall ? 32 : 44, weight: 'bold' },
            textColor: color
          },
          { type: 'spacer' }
        ]
      },
      {
        type: 'stack',
        direction: 'row',
        children: [
          { type: 'spacer' },
          {
            type: 'stack',
            width: barWidth,
            height: 4,
            backgroundColor: color,
            borderRadius: 2
          },
          { type: 'spacer' }
        ]
      },
      {
        type: 'stack',
        direction: 'row',
        children: [
          {
            type: 'text',
            text: `${speedData.mBs} MB/s`,
            font: { size: isSmall ? 'caption2' : 'caption1' },
            textColor: { light: '#6B6B6B', dark: '#A1A1A6' }
          },
          { type: 'spacer' },
          {
            type: 'text',
            text: `${speedData.duration}s`,
            font: { size: isSmall ? 'caption2' : 'caption1' },
            textColor: { light: '#6B6B6B', dark: '#A1A1A6' }
          }
        ]
      }
    ]
  };
}