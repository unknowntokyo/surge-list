export default async function(ctx) {
  try {
    const resp = await ctx.http.get(
      'https://dabenshi.cn/other/api/hot.php?type=douyinhot',
      { timeout: 15000 }
    );

    if (resp.status !== 200) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();

    const hotList = [data, data?.data, data?.list, data?.result].find(Array.isArray) || [];

    const currentTime = new Date().toTimeString().slice(0, 5);
    const items = [];

    // 判断热度值是否为0
    const isZeroHot = value => {
      const text = String(value ?? '').replace(/\s+/g, '');
      return /^0(?:\.0+)?万$/.test(text);
    };

    for (let i = 0; i < Math.min(5, hotList.length); i++) {
      const item = hotList[i];
      const rank = i + 1;

      const text = String(
        item?.title ||
        item?.name ||
        item?.keyword ||
        `热榜 ${rank}`
      );

      const hot = String(
        item?.hot ??
        item?.hot_num ??
        item?.desc ??
        ''
      );

      // 热度值为0不显示热度值，但保留这条热榜
      const displayHot = isZeroHot(hot) ? ' ' : hot;

      items.push({
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 6,
        children: [
          {
            type: 'stack',
            width: 30,
            children: [
              {
                type: 'text',
                text: `#${rank}`,
                font: {
                  size: 'subheadline',
                  weight: 'bold'
                },
                textColor:
                  ['#FF3B30', '#FF9500', '#FFCC00'][i] || '#8E8E93'
              }
            ]
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
            text: displayHot,
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

    if (items.length === 0) {
      items.push({
        type: 'text',
        text: '暂无数据',
        font: {
          size: 'subheadline'
        },
        textColor: {
          light: '#8E8E93',
          dark: '#C7C7CC'
        }
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
              text: ' 抖音热榜',
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
  } catch (err) {
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
          text: `⚠️ 加载失败：${err?.message || '未知错误'}`,
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