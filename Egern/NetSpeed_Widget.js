/**
 * 📌 桌面小组件: NetSpeed 小组件
 * 小组件环境变量：
 * 1、名称 policy，值为策略组名称，默认 DIRECT；
 * 2、下行测速数据量 SPEED_TEST_PACKET，默认为 3MB
 */

const MB = 1048576;
const DEFAULT_POLICY = 'DIRECT';
const DEFAULT_PACKET_MB = 3;
const TIMEOUT = 8000;
const FAILED_TEXT = '⚠️ 测速失败';

const BAR_MIN_WIDTH = 30;
const BAR_MAX_WIDTH = 140;
const BAR_MAX_SPEED = 120;

const DEFAULT_SPEED_DATA = {
  mbps: 0,
  mBs: 0,
  duration: 0,
  timestamp: 0
};

function getPolicy(value) {
  const policy = typeof value === 'string' ? value.trim() : '';
  return policy || DEFAULT_POLICY;
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

function getBarWidth(mbps) {
  const width = BAR_MIN_WIDTH + (mbps / BAR_MAX_SPEED) * (BAR_MAX_WIDTH - BAR_MIN_WIDTH);
  return Math.min(Math.max(width, BAR_MIN_WIDTH), BAR_MAX_WIDTH);
}

function loadCachedSpeedData(ctx, cacheKey) {
  try {
    return normalizeSpeedData(ctx.storage.getJSON(cacheKey));
  } catch {
    return { ...DEFAULT_SPEED_DATA };
  }
}

async function measureSpeed(ctx, url, policy, packetBytes) {
  let body;
  let reader;
  let completed = false;
  let downloadedBytes = 0;
  const startTime = Date.now();

  try {
    const response = await ctx.http.get(url, {
      headers: { 'Cache-Control': 'no-cache' },
      timeout: TIMEOUT,
      policy,
      credentials: 'omit'
    });

    body = response?.body;

    if (!response || response.status < 200 || response.status >= 300) {
      return null;
    }

    reader = body?.getReader?.();
    if (!reader) {
      return null;
    }

    while (true) {
      if (Date.now() - startTime >= TIMEOUT) {
        break;
      }

      const { done, value } = await reader.read();
      if (done) {
        completed = true;
        break;
      }

      downloadedBytes += value?.byteLength || value?.length || 0;

      if (downloadedBytes >= packetBytes) {
        break;
      }
    }

    const duration = (Date.now() - startTime) / 1000;

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
    } else if (!reader && body) {
      try {
        await body.cancel?.();
      } catch {}
    }
  }
}

export default async function(ctx) {
  const policy = getPolicy(ctx.env?.policy);
  const packetBytes = getPacketBytes(ctx.env?.SPEED_TEST_PACKET);
  const speedTestUrl = `https://speed.cloudflare.com/__down?bytes=${packetBytes}`;
  const cacheKey = `netspeed_cache_${policy}`;

  const measuredData = await measureSpeed(ctx, speedTestUrl, policy, packetBytes);

  let speedData;
  if (measuredData) {
    speedData = measuredData;

    try {
      ctx.storage.setJSON(cacheKey, speedData);
    } catch {}
  } else {
    speedData = loadCachedSpeedData(ctx, cacheKey);
  }

  const failed = speedData.timestamp <= 0 || speedData.duration <= 0;

  const layout = ctx.widgetFamily === 'systemSmall'
    ? {
        padding: 12,
        gap: 8,
        iconSize: 14,
        titleFont: 'caption2',
        detailFont: 'caption2',
        speedMainFontSize: 32,
        failedMainFontSize: 22,
        speedUnitSeparator: '\n'
      }
    : {
        padding: 16,
        gap: 12,
        iconSize: 16,
        titleFont: 'caption1',
        detailFont: 'caption1',
        speedMainFontSize: 44,
        failedMainFontSize: 30,
        speedUnitSeparator: ' '
      };

  const { icon, color } = getSpeedStyle(speedData.mbps, failed);
  const barWidth = failed ? 80 : getBarWidth(speedData.mbps);
  const timeStr = failed ? '--:--' : formatTime(speedData.timestamp);

  const mainText = failed
    ? FAILED_TEXT
    : `${speedData.mbps}${layout.speedUnitSeparator}Mbps`;

  const mainFontSize = failed
    ? layout.failedMainFontSize
    : layout.speedMainFontSize;

  const mutedTextColor = { light: '#6B6B6B', dark: '#A1A1A6' };

  const children = [
    {
      type: 'stack',
      direction: 'row',
      alignItems: 'center',
      children: [
        {
          type: 'image',
          src: `sf-symbol:${icon}`,
          width: layout.iconSize,
          height: layout.iconSize,
          color
        },
        {
          type: 'text',
          text: ' NetSpeed',
          font: { size: layout.titleFont, weight: 'semibold' },
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
          text: mainText,
          textAlign: 'center',
          font: {
            size: mainFontSize,
            weight: 'bold'
          },
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
          borderRadius: 2,
          children: [{ type: 'spacer' }]
        },
        { type: 'spacer' }
      ]
    }
  ];

  if (!failed) {
    children.push({
      type: 'stack',
      direction: 'row',
      children: [
        {
          type: 'text',
          text: `${speedData.mBs} MB/s`,
          font: { size: layout.detailFont },
          textColor: mutedTextColor
        },
        { type: 'spacer' },
        {
          type: 'text',
          text: `${speedData.duration}s`,
          font: { size: layout.detailFont },
          textColor: mutedTextColor
        }
      ]
    });
  }

  return {
    type: 'widget',
    padding: layout.padding,
    gap: layout.gap,

    backgroundColor: {
      light: '#FFFFFF',
      dark: '#2C2C2E'
    },

    children
  };
}