const API_URL = 'https://dabenshi.cn/other/api/hot.php?type=douyinhot';

const REFRESH_MS = 15 * 60 * 1000;
const ERROR_REFRESH_MS = 5 * 60 * 1000;
const MAX_ITEMS = 5;

const rankColors = ['#FF3B30', '#FF9500', '#FFCC00'];

const colors = {
  bg: {
    light: '#FFFFFF',
    dark: '#2C2C2E'
  },
  errorBg: {
    light: '#F2F2F7',
    dark: '#1C1C1E'
  },
  primary: {
    light: '#1C1C1E',
    dark: '#FFFFFF'
  },
  secondary: {
    light: '#8E8E93',
    dark: '#C7C7CC'
  }
};

export default async function(ctx) {
  try {
    const resp = await ctx.http.get(API_URL, {
      timeout: 15000,
      insecureTls: true,
      credentials: 'omit'
    });

    if (resp.status < 200 || resp.status >= 300) {
      throw new Error(`HTTP ${resp.status}`);
    }

    let data;
    try {
      data = await resp.json();
    } catch {
      throw new Error('JSON 解析失败');
    }

    const hotList = getHotList(data);
    const items = [];

    for (let i = 0; i < hotList.length && items.length < MAX_ITEMS; i++) {
      const item = hotList[i];

      const hot = String(
        item?.hot ??
        item?.hot_num ??
        item?.desc ??
        ''
      );

      if (isZeroHot(hot)) {
        continue;
      }

      const rank = items.length + 1;

      const text = String(
        item?.title ||
        item?.name ||
        item?.keyword ||
        (typeof item === 'string' ? item : '') ||
        `热榜 ${rank}`
      );

      items.push(makeHotItem(rank, text, hot));
    }

    return {
      type: 'widget',
      refreshAfter: after(REFRESH_MS),
      padding: 10,
      gap: 6,
      backgroundColor: colors.bg,
      children: [
        makeHeader(),
        ...(items.length ? items : [makeEmpty()])
      ]
    };
  } catch (err) {
    return makeError(err);
  }
}

function getHotList(data) {
  return [
    data,
    data?.data,
    data?.data?.list,
    data?.data?.result,
    data?.list,
    data?.result,
    data?.result?.list
  ].find(Array.isArray) || [];
}

function makeHeader() {
  return {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 6,
    children: [
      centerBox({
        type: 'image',
        src: 'sf-symbol:flame',
        color: '#FF3B30',
        width: 16,
        height: 16
      }),
      {
        type: 'text',
        text: ' 抖音热榜',
        font: {
          size: 'subheadline',
          weight: 'bold'
        },
        textColor: colors.primary,
        flex: 1
      },
      {
        type: 'text',
        text: `↻ ${currentTime()}`,
        font: {
          size: 'caption1'
        },
        textColor: colors.secondary
      }
    ]
  };
}

function makeHotItem(rank, text, hot) {
  return {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 6,
    children: [
      centerBox({
        type: 'text',
        text: `#${rank}`,
        font: {
          size: 'subheadline',
          weight: 'bold'
        },
        textColor: rankColors[rank - 1] || '#8E8E93'
      }),
      {
        type: 'text',
        text,
        font: {
          size: 'subheadline'
        },
        textColor: colors.primary,
        flex: 1,
        maxLines: 1
      },
      {
        type: 'text',
        text: hot,
        font: {
          size: 'caption1'
        },
        textColor: colors.secondary
      }
    ]
  };
}

function makeEmpty() {
  return {
    type: 'text',
    text: '暂无数据',
    font: {
      size: 'subheadline'
    },
    textColor: colors.secondary
  };
}

function makeError(err) {
  return {
    type: 'widget',
    refreshAfter: after(ERROR_REFRESH_MS),
    padding: 14,
    backgroundColor: colors.errorBg,
    children: [
      {
        type: 'text',
        text: `⚠️ 加载失败：${err?.message || '未知错误'}`,
        font: {
          size: 'body'
        },
        textColor: colors.primary
      }
    ]
  };
}

function centerBox(child) {
  return {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    width: 30,
    children: [
      {
        type: 'spacer'
      },
      child,
      {
        type: 'spacer'
      }
    ]
  };
}

function isZeroHot(value) {
  const text = String(value ?? '').replace(/\s+/g, '');
  return /^0+(?:\.0+)?(?:万)?$/.test(text);
}

function currentTime() {
  const date = new Date();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${hour}:${minute}`;
}

function after(ms) {
  return new Date(Date.now() + ms).toISOString();
}