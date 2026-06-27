/**
 * 📌 桌面小组件: NetSpeed 小组件
 * 小组件环境变量：
 * 1、名称policy，值为策略组名称，默认DIRECT；
 * 2、下行测速数据量SPEED_TEST_PACKET，值为数字，默认3MB
 */

export default async function(ctx) {
  const POLICY = ctx.env?.policy || 'DIRECT';
  const SPEED_TEST_PACKET = Math.floor((parseFloat(ctx.env?.SPEED_TEST_PACKET) || 3) * 1048576);
  const SPEED_TEST_URL = `https://speed.cloudflare.com/__down?bytes=${SPEED_TEST_PACKET}&_=${Date.now()}`;
  const CACHE_KEY = `netspeed_cache_${POLICY}`;
  const TIMEOUT = 10000;

  // 缓存有效期：5分钟
  const CACHE_TTL = 5 * 60 * 1000;

  let speedData = { mbps: 0, mBs: 0, duration: 0, timestamp: 0 };
  let hasValidCache = false;
  let isStaleCache = false;
  let errorMessage = '';

  function isValidSpeedData(data) {
    return data &&
      Number.isFinite(Number(data.mbps)) &&
      Number.isFinite(Number(data.mBs)) &&
      Number.isFinite(Number(data.duration)) &&
      Number.isFinite(Number(data.timestamp)) &&
      Number(data.timestamp) > 0;
  }

  try {
    const cached = ctx.storage.getJSON(CACHE_KEY);

    if (isValidSpeedData(cached)) {
      speedData = {
        mbps: Number(cached.mbps),
        mBs: Number(cached.mBs),
        duration: Number(cached.duration),
        timestamp: Number(cached.timestamp)
      };

      hasValidCache = true;
      isStaleCache = Date.now() - speedData.timestamp > CACHE_TTL;
    }
  } catch (e) {
    errorMessage = '缓存读取失败';
  }

  let downloadedBytes = 0;
  let reader;
  let timeoutId = null;

  // 如果缓存未过期，直接使用缓存，避免每次 Widget 刷新都重新测速
  if (!hasValidCache || isStaleCache) {
    try {
      const dlStartTime = performance.now();

      const downloadPromise = (async () => {
        const response = await ctx.http.get(SPEED_TEST_URL, {
          headers: {
            'Cache-Control': 'no-store',
            'Pragma': 'no-cache'
          },
          timeout: TIMEOUT,
          policy: POLICY,
          credentials: 'omit'
        });

        reader = response?.body?.getReader();
        if (!reader) throw new Error('Response body is not readable');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          downloadedBytes += value?.byteLength || value?.length || 0;
        }
      })();

      await Promise.race([
        downloadPromise,
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Speed test timeout')), TIMEOUT);
        })
      ]);

      const duration = (performance.now() - dlStartTime) / 1000;

      if (downloadedBytes > 0 && duration >= 0.2) {
        const speedMBs = (downloadedBytes / 1048576) / duration;

        speedData = {
          mbps: Number((speedMBs * 8).toFixed(1)),
          mBs: Number(speedMBs.toFixed(2)),
          duration: Number(duration.toFixed(2)),
          timestamp: Date.now()
        };

        ctx.storage.setJSON(CACHE_KEY, speedData);

        hasValidCache = true;
        isStaleCache = false;
        errorMessage = '';
      }
    } catch (e) {
      errorMessage = hasValidCache ? '测速失败，显示缓存' : '测速失败';
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (reader) {
        try {
          await reader.cancel();
        } catch {}
      }
    }
  }

  let icon = 'tortoise';
  let color = '#FF9500';

  if (speedData.mbps >= 50) {
    icon = 'bolt.fill';
    color = '#34C759';
  } else if (speedData.mbps >= 10) {
    icon = 'hare.fill';
    color = '#007AFF';
  }

  const minWidth = 30;
  const maxWidth = 140;
  const maxSpeed = 120;

  let barWidth = minWidth + (speedData.mbps / maxSpeed) * (maxWidth - minWidth);
  barWidth = Math.min(Math.max(barWidth, minWidth), maxWidth);

  const displayTime = speedData.timestamp ? new Date(speedData.timestamp) : new Date();
  const timeStr = `${String(displayTime.getHours()).padStart(2, '0')}:${String(displayTime.getMinutes()).padStart(2, '0')}`;

  const isSmall = ctx.widgetFamily === 'systemSmall';

  const refreshText = speedData.timestamp
    ? `${isStaleCache ? '缓存 ' : '↻ '}${timeStr}`
    : '--:--';

  const statusText = errorMessage
    ? errorMessage
    : `${speedData.duration}s`;

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
            color: color
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
            text: refreshText,
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
            text: statusText,
            font: { size: isSmall ? 'caption2' : 'caption1' },
            textColor: errorMessage
              ? '#FF9500'
              : { light: '#6B6B6B', dark: '#A1A1A6' }
          }
        ]
      }
    ]
  };
}