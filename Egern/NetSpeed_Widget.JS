  // NetSpeed 小组件
  // 测试网络下载速度

  export default async function(ctx) {
    const fontsize = Number(ctx.env.网速字体大小?.trim()) || 29;
    const MB = 5;
    const BYTES = MB * 1024 * 1024;
    const SPEED_TEST_URL = `https://speed.cloudflare.com/__down?bytes=${BYTES}`;
    const CACHE_KEY = 'netspeed_cache';
    
    let speedData = { mbps: 0, mBs: 0, duration: 0, timestamp: 0 };
    try {
      const cached = ctx.storage.getJSON(CACHE_KEY);
      if (cached) speedData = cached;
    } catch(e) {}
    
    try {
      const startTime = Date.now();
      await ctx.http.get(SPEED_TEST_URL, {
        headers: { 'Cache-Control': 'no-cache' },
        timeout: 5000
      });
      const duration = (Date.now() - startTime) / 1000;
      const speedMBs = MB / duration;
      const speedMbps = speedMBs * 8;

      speedData = {
        mbps: Math.round(speedMbps),
        mBs: parseFloat(speedMBs.toFixed(2)),
        duration: duration.toFixed(2),
        timestamp: Date.now()
      };

      ctx.storage.setJSON(CACHE_KEY, speedData);
    } catch(e) {}

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

    return {
      type: 'widget',
      padding: 12,
      gap: 14,

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
              width: 16,
              height: 16,
              color: color
            },
            {
              type: 'text',
              text: ' NetSpeed',
              font: { size: 'caption1', weight: 'semibold' },
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
              text: `${speedData.mbps} Mbps`,
              font: { size: fontsize, weight: 'bold' },
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
        { type: 'stack', height: 1 }, 
        {
          type: 'stack',
          direction: 'row',
          children: [
            {
              type: 'text',
              text: `${speedData.mBs} MB/s`,
              font: { size: 'caption1' },
              textColor: { light: '#6B6B6B', dark: '#A1A1A6' }
            },
            { type: 'spacer' },
            {
              type: 'text',
              text: `${speedData.duration}s`,
              font: { size: 'caption1' },
              textColor: { light: '#6B6B6B', dark: '#A1A1A6' }
            }
          ]
        }
      ]
    };
  }