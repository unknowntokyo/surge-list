const API_URL = 'https://dabenshi.cn/other/api/hot.php?type=douyinhot';
const REFRESH_INTERVAL = 15 * 60 * 1000;
const MAX_ITEMS = 5;

const RANK_COLORS = ['#FF3B30', '#FF9500', '#FFCC00'];

const PRIMARY_TEXT_COLOR = {
  light: '#1C1C1E',
  dark: '#FFFFFF'
};

const SECONDARY_TEXT_COLOR = {
  light: '#8E8E93',
  dark: '#C7C7CC'
};

const WIDGET_BG_COLOR = {
  light: '#FFFFFF',
  dark: '#2C2C2E'
};

const ERROR_BG_COLOR = {
  light: '#F2F2F7',
  dark: '#1C1C1E'
};

const FONT_SUBHEADLINE = {
  size: 'subheadline'
};

const FONT_SUBHEADLINE_BOLD = {
  size: 'subheadline',
  weight: 'bold'
};

const FONT_CAPTION = {
  size: 'caption1'
};

const FONT_BODY = {
  size: 'body'
};

function getHotList(data) {
  return [data, data?.data, data?.list, data?.result].find(Array.isArray) || [];
}

function isZeroHot(value) {
  const text = String(value ?? '').replace(/\s+/g, '');
  return /^0(?:\.0+)?万$/.test(text);
}

function getItemTitle(item, rank) {
  return String(
    item?.title ??
    item?.name ??
    item?.keyword ??
    `热榜 ${rank}`
  );
}

function getItemHot(item) {
  return String(
    item?.hot ??
    item?.hot_num ??
    item?.desc ??
    ''
  );
}

function createHotItem(item, index) {
  const rank = index + 1;
  const title = getItemTitle(item, rank);
  const hot = getItemHot(item);
  const displayHot = isZeroHot(hot) ? '' : hot;

  const children = [
    {
      type: 'stack',
      width: 30,
      children: [
        {
          type: 'text',
          text: `#${rank}`,
          font: FONT_SUBHEADLINE_BOLD,
          textColor: RANK_COLORS[index] || '#8E8E93'
        }
      ]
    },
    {
      type: 'text',
      text: title,
      font: FONT_SUBHEADLINE,
      textColor: PRIMARY_TEXT_COLOR,
      flex: 1,
      maxLines: 1
    }
  ];

  if (displayHot) {
    children.push({
      type: 'text',
      text: displayHot,
      font: FONT_CAPTION,
      textColor: SECONDARY_TEXT_COLOR
    });
  }

  return {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 6,
    children
  };
}

function createEmptyItem() {
  return {
    type: 'text',
    text: '暂无热榜数据',
    font: FONT_SUBHEADLINE,
    textColor: SECONDARY_TEXT_COLOR
  };
}

function createErrorWidget(message) {
  return {
    type: 'widget',
    padding: 16,
    backgroundColor: ERROR_BG_COLOR,
    children: [
      {
        type: 'text',
        text: `⚠️ 加载失败：${message}`,
        font: FONT_BODY,
        textColor: PRIMARY_TEXT_COLOR
      }
    ]
  };
}

export default async function(ctx) {
  try {
    const resp = await ctx.http.get(API_URL, {
      timeout: 15000
    });

    if (resp.status !== 200) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const hotList = getHotList(data);

    const currentTime = new Date().toTimeString().slice(0, 5);

    const items = hotList
      .slice(0, MAX_ITEMS)
      .map(createHotItem);

    if (items.length === 0) {
      items.push(createEmptyItem());
    }

    return {
      type: 'widget',
      refreshAfter: new Date(Date.now() + REFRESH_INTERVAL).toISOString(),
      padding: 14,
      gap: 6,
      backgroundColor: WIDGET_BG_COLOR,
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
              font: FONT_SUBHEADLINE_BOLD,
              textColor: PRIMARY_TEXT_COLOR,
              flex: 1
            },
            {
              type: 'text',
              text: `↻ ${currentTime}`,
              font: FONT_CAPTION,
              textColor: SECONDARY_TEXT_COLOR
            }
          ]
        },
        ...items
      ]
    };
  } catch (err) {
    return createErrorWidget(err?.message || '未知错误');
  }
}