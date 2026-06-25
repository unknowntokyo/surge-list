export default async function(ctx) {
  try {
    const resp = await ctx.http.get(
      'https://dabenshi.cn/other/api/hot.php?type=douyinhot',
      {
        timeout: 15000,
        insecureTls: true
      }
    );

    if (resp.status !== 200) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();

    const hotList = [data, data?.data, data?.list, data?.result].find(Array.isArray) || [];

    const currentTime = new Date().toTimeString().slice(0, 5);
    const items = [];
    const rankColors = ['#FF3B30', '#FF9500', '#FFCC00'];

    // 判断热度值是否为0
    const isZeroHot = value => {
      const text = String(value ?? '').replace(/\s+/g, '');
      return /^0+(?:\.0+)?(?:万)?$/.test(text);
    };

    // 最多显示5条非0热度的
    for (let i = 0; i < hotList.length && items.length < 5; i++) {
      const item = hotList[i];

      const hot = String(
        item?.hot ??
        item?.hot_num ??
        item?.desc ??
        ''
      );

      // 热度为0，整条不显示
      if (isZeroHot(hot)) {
        continue;
      }

      // 使用显示排名，避免跳号
      const rank = items.length + 1;

      const text = String(
        item?.title ||
        item?.name ||
        item?.keyword ||
        `热榜 ${rank}`
      );

      items.push({
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 6,
        children: [
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            width: 30,
            children: [
              {
                type: 'spacer'
              },
              {
                type: 'text',
                text: `#${rank}`,
                font: {
                  size: 'subheadline',
                  weight: 'bold'
                },
                textColor: rankColors[rank - 1] || '#8E8E93'
              },
              {
                type: 'spacer'
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
      padding: 10,
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
              type: 'stack',
              direction: 'row',
              alignItems: 'center',
              width: 30,
              children: [
                {
                  type: 'spacer'
                },
                {
                  type: 'image',
                  src: 'sf-symbol:flame',
                  color: '#FF3B30',
                  width: 16,
                  height: 16
                },
                {
                  type: 'spacer'
                }
              ]
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
      padding: 14,
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