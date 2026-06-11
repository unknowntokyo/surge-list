/**
 * 📌 桌面小组件: NetSpeed 小组件
 * 小组件环境变量：
 * 1、名称policy，值为策略组名称，默认DIRECT；
 * 2、下行测速数据量SPEED_TEST_PACKET，值为数字，默认3MB
 */

export default async function(ctx) {
  const POLICY = ctx.env.policy || 'DIRECT';
  const SPEED_TEST_PACKET = Math.floor((parseFloat(ctx.env?.SPEED_TEST_PACKET) || 3) * 1048576);
  const SPEED_TEST_URL = `https://speed.cloudflare.com/__down?bytes=${SPEED_TEST_PACKET}`;
  const CACHE_KEY = `netspeed_cache_${POLICY}`;
  const TIMEOUT = 10000;
  
  let speedData = { mbps: 0, mBs: 0, duration: 0, timestamp: 0 };
  
  try {
    const cached = ctx.storage.getJSON(CACHE_KEY);
    if (cached) speedData = cached;
  } catch(e) {}
  
  let downloadedBytes = 0;
  let reader;
  let timeoutId = null;

  try {
    const dlStartTime = performance.now();
    const downloadPromise = (async () => {
      const response = await ctx.http.get(SPEED_TEST_URL, {
        headers: { 'Cache-Control': 'no-cache' },
        timeout: TIMEOUT,
        policy: POLICY 
      });

      reader = response?.body?.getReader();
      if (!reader) throw new Error();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        downloadedBytes += value?.byteLength || value?.length || 0;
      }
    })();

    await Promise.race([
      downloadPromise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error()), TIMEOUT);
      })
    ]);

    const duration = (performance.now() - dlStartTime) / 1000;
    const speedMBs = (downloadedBytes / 1048576) / duration;
    
    speedData = {
      mbps: parseFloat((speedMBs * 8).toFixed(1)),
      mBs: parseFloat(speedMBs.toFixed(2)),
      duration: duration.toFixed(2),
      timestamp: Date.now()
    };
    ctx.storage.setJSON(CACHE_KEY, speedData);

  } catch(e) {
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (reader) try { await reader.cancel(); } catch {}
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

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  
  const isSmall = ctx.widgetFamily === 'systemSmall';

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
            cornerRadius: 2
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