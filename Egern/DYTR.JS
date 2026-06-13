export default async function(ctx) {
  try {
    const resp = await ctx.http.get(
      'https://api.zxki.cn/api/jhrs?type=douyin',
      { timeout: 15000 }
    );

    if (resp.status !== 200) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();

    const hotList = [data, data?.data, data?.list, data?.result].find(Array.isArray) || [];

    const currentTime = new Date().toTimeString().slice(0, 5);
    const items = [];

    for (let i = 0; i < Math.min(5, hotList.length); i++) {
      const item = hotList[i];
      const rank = i + 1;

      const text = String(
        item?.title ||
        item?.name ||
        item?.keyword ||
        `热搜 ${rank}`
      );

      const hot = String(
        item?.hot ||
        item?.hot_num ||
        item?.desc ||
        ''
      );

      items.push({
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 6,
        children: [
          {
            type: 'text',
            text: `#${rank}`,
            font: {
              size: 'subheadline',
              weight: 'bold'
            },
            textColor:
              ['#FF3B30', '#FF9500', '#FFCC00'][i] || '#8E8E93',
            width: 30
          },
          {
            type: 'text',
            text,
            font: {
              size: 'subheadline'
            },
            textColor: {
              light: '#1C1C1E',
              dark: '#FFFFFF'
            },
            flex: 1,
            maxLines: 1
          },
          {
            type: 'text',
            text: hot,
            font: {
              size: 'caption1'
            },
            textColor: {
              light: '#8E8E93',
              dark: '#C7C7CC'
            }
          }
        ]
      });
    }

    return {
      type: 'widget',
      refreshAfter: new Date(Date.now() + 900000).toISOString(),
      padding: 14,
      gap: 6,
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
              src: 'sf-symbol:flame',
              color: '#FF3B30',
              width: 16,
              height: 16
            },
            {
              type: 'text',
              text: ' 抖音热搜',
              font: {
                size: 'subheadline',
                weight: 'bold'
              },
              textColor: {
                light: '#1C1C1E',
                dark: '#FFFFFF'
              },
              flex: 1
            },
            {
              type: 'text',
              text: `↻ ${currentTime}`,
              font: {
                size: 'caption1'
              },
              textColor: {
                light: '#8E8E93',
                dark: '#C7C7CC'
              }
            }
          ]
        },
        ...items
      ]
    };
  } catch {
    return {
      type: 'widget',
      padding: 16,
      backgroundColor: {
        light: '#F2F2F7',
        dark: '#1C1C1E'
      },
      children: [
        {
          type: 'text',
          text: '⚠️ 加载失败',
          font: {
            size: 'body'
          },
          textColor: {
            light: '#1C1C1E',
            dark: '#FFFFFF'
          }
        }
      ]
    };
  }
}