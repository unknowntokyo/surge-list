const API_URL = 'https://dabenshi.cn/other/api/hot.php?type=douyinhot';

const REFRESH_MS = 15 * 60 * 1000;
const ERROR_REFRESH_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;
const MAX_ITEMS = 5;

const REQUEST_OPTIONS = {
  timeout: REQUEST_TIMEOUT_MS,
  insecureTls: true,
  credentials: 'omit'
};

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

const SPACE_RE = /\s+/g;
const ZERO_HOT_RE = /^0+(?:\.0+)?(?:万)?$/;

export default async function(ctx) {
  try {
    const data = await fetchHotData(ctx);
    const hotList = getHotList(data);
    const items = buildHotItems(hotList);

    return makeWidget(items);
  } catch (err) {
    return makeError(err);
  }
}

async function fetchHotData(ctx) {
  const resp = await ctx.http.get(API_URL, REQUEST_OPTIONS);

  if (resp.status < 200 || resp.status >= 300) {
    throw new Error(`HTTP ${resp.status}`);
  }

  try {
    return await resp.json();
  } catch {
    throw new Error('JSON 解析失败');
  }
}

function getHotList(data) {
  if (data?.success === false) {
    throw new Error(data?.message || data?.msg || '接口返回失败');
  }

  if (!Array.isArray(data?.data)) {
    throw new Error('接口数据格式异常');
  }

  return data.data;
}

function buildHotItems(hotList) {
  const items = [];

  for (let i = 0; i < hotList.length && items.length < MAX_ITEMS; i++) {
    const rank = items.length + 1;
    const item = normalizeHotItem(hotList[i], rank);

    if (item) {
      items.push(makeHotItem(item.rank, item.text, item.hot));
    }
  }

  return items;
}

function normalizeHotItem(item, rank) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const hot = getHotText(item);

  if (!hot || isZeroHot(hot)) {
    return null;
  }

  return {
    rank,
    text: getTitleText(item, rank),
    hot
  };
}

function getHotText(item) {
  return String(
    item.hot ??
    item.hot_num ??
    item.hot_value ??
    ''
  ).trim();
}

function getTitleText(item, rank) {
  const text = String(
    item.title ||
    item.word ||
    item.name ||
    item.keyword ||
    ''
  ).trim();

  return text || `热榜 ${rank}`;
}

function makeWidget(items) {
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
        text: '抖音热榜',
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
  const text = String(value ?? '').replace(SPACE_RE, '');
  return ZERO_HOT_RE.test(text);
}

function currentTime() {
  const date = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

function pad2(value) {
  return value < 10 ? `0${value}` : String(value);
}

function after(ms) {
  return new Date(Date.now() + ms).toISOString();
}