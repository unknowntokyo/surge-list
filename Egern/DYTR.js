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

const HOT_KEYS = ['hot', 'hot_num', 'hot_value'];
const TITLE_KEYS = ['title', 'word', 'name', 'keyword'];

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
    const rows = buildHotRows(hotList);

    return makeWidget(rows);
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

function buildHotRows(hotList) {
  const rows = [];

  for (let i = 0; i < hotList.length && rows.length < MAX_ITEMS; i++) {
    const item = hotList[i];

    if (!item || typeof item !== 'object') {
      continue;
    }

    const hot = getHotText(item);

    if (!hot || isZeroHot(hot)) {
      continue;
    }

    const rank = rows.length + 1;
    const text = getTitleText(item, rank);

    rows.push(makeHotItem(rank, text, hot));
  }

  return rows;
}

function getHotText(item) {
  return pickText(item, HOT_KEYS);
}

function getTitleText(item, rank) {
  return pickText(item, TITLE_KEYS) || `热榜 ${rank}`;
}

function pickText(item, keys) {
  for (let i = 0; i < keys.length; i++) {
    const value = item[keys[i]];

    if (value === null || value === undefined) {
      continue;
    }

    const text = String(value).trim();

    if (text) {
      return text;
    }
  }

  return '';
}

function makeWidget(rows) {
  return {
    type: 'widget',
    refreshAfter: after(REFRESH_MS),
    padding: 10,
    gap: 6,
    backgroundColor: colors.bg,
    children: [
      makeHeader(`↻ ${currentTime()}`),
      ...(rows.length ? rows : [makeEmpty()])
    ]
  };
}

function makeHeader(statusText) {
  return {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 6,
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
        text: statusText,
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
      {
        type: 'text',
        text: `#${rank}`,
        font: {
          size: 'subheadline',
          weight: 'bold'
        },
        textColor: rankColors[rank - 1] || '#8E8E93',
        textAlign: 'center'
      },
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