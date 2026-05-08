  // NetSpeed 小组件
  // 测试网络下载速度
  // 在小组件环境变量中添加：
  // 名称：policy
  // 值：策略组名称

  export default async function(ctx) {
    const POLICY = ctx.env.policy || 'DIRECT';
    const MB = 5;
    const BYTES = MB * 1024 * 1024;
    const SPEED_TEST_URL = `https://speed.cloudflare.com/__down?bytes=${BYTES}`;
    const CACHE_KEY = `netspeed_cache_${POLICY}`;
    
    let speedData = { mbps: 0, mBs: 0, duration: 0, timestamp: 0 };
    try {
      const cached = ctx.storage.getJSON(CACHE_KEY);
      if (cached) speedData = cached;
    } catch(e) {}
    
    try {
      const startTime = Date.now();
      await ctx.http.get(SPEED_TEST_URL, {
        headers: { 'Cache-Control': 'no-cache' },
        timeout: 10000,
        policy: POLICY
      });
      const duration = (Date.now() - startTime) / 1000;
      const speedMBs = MB / duration;
      const speedMbps = speedMBs * 8;

      speedData = {
        mbps: parseFloat(speedMbps.toFixed(1)),
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
              text: ` ${POLICY}`,
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
