const codeMap = { HK: '🇭🇰 香港', TW: '🇼🇸 台湾', SG: '🇸🇬 新加坡', JP: '🇯🇵 日本', KR: '🇰🇷 韩国', US: '🇺🇸 美国', DE: '🇩🇪 德国', GB: '🇬🇧 英国', NL: '🇳🇱 荷兰', FR: '🇫🇷 法国', CA: '🇨🇦 加拿大', AU: '🇦🇺 澳大利亚', TR: '🇹🇷 土耳其', MO: '🇲🇴 澳门', RU: '🇷🇺 俄罗斯' };

const cityMap = {

  // 中国香港
  'aberdeen': '香港仔',
  'causeway bay': '铜锣湾',
  'central': '中环',
  'chai wan': '柴湾',
  'cheung sha wan': '长沙湾',
  'hong kong': '香港',
  'kowloon': '九龙',
  'kwai chung': '葵涌',
  'kwun tong': '观塘',
  'lai chi kok': '荔枝角',
  'sha tin': '沙田',
  'shatin': '沙田',
  'tai po': '大埔',
  'tseung kwan o': '将军澳',
  'tsing yi': '青衣',
  'tsuen wan': '荃湾',
  'tuen mun': '屯门',
  'wan chai': '湾仔',
  'yuen long': '元朗',

  // 中国台湾
  'banqiao': '板桥',
  'changhua': '彰化',
  'hsinchu': '新竹',
  'kaohsiung': '高雄',
  'new taipei': '新北',
  'taichung': '台中',
  'tainan': '台南',
  'taipei': '台北',
  'taoyuan': '桃园',
  'xizhi': '汐止',
  'zhubei': '竹北',

  // 新加坡
  'singapore': '新加坡',
  'loyang': '罗央',

  // 日本
  'akita': '秋田',
  'chiba': '千叶',
  'fukuoka': '福冈',
  'inzai': '印西',
  'ishikari': '石狩',
  'kanagawa': '神奈川',
  'kawasaki': '川崎',
  'kobe': '神户',
  'koto': '江东区',
  'kyoto': '京都',
  'nagoya': '名古屋',
  'osaka': '大阪',
  'saitama': '埼玉',
  'sapporo': '札幌',
  'sendai': '仙台',
  'shibuya': '涩谷',
  'shinagawa': '品川',
  'shinjuku': '新宿',
  'tokyo': '东京',
  'toyosu': '丰洲',
  'yokohama': '横滨',

  // 韩国
  'anyang': '安养',
  'busan': '釜山',
  'chuncheon': '春川',
  'daegu': '大邱',
  'daejeon': '大田',
  'gangnam gu': '江南区',
  'gangseo gu': '江西区',
  'geumcheon gu': '衿川区',
  'guro gu': '九老区',
  'gwangju': '光州',
  'incheon': '仁川',
  'jeju': '济州',
  'mapo gu': '麻浦区',
  'seocho gu': '瑞草区',
  'seongdong gu': '城东区',
  'seongnam': '城南',
  'seoul': '首尔',
  'songpa gu': '松坡区',
  'suwon': '水原',
  'ulsan': '蔚山',
  'yeongdeungpo gu': '永登浦区',
  'yongsan gu': '龙山区',

  // 美国
  'ashburn': '阿什本',
  'atlanta': '亚特兰大',
  'boston': '波士顿',
  'buffalo': '布法罗',
  'carteret': '卡特雷特',
  'cary': '凯瑞',
  'charlotte': '夏洛特',
  'chicago': '芝加哥',
  'cleveland': '克利夫兰',
  'clifton': '克利夫顿',
  'council bluffs': '康索尔布拉夫斯',
  'dallas': '达拉斯',
  'denver': '丹佛',
  'detroit': '底特律',
  'durham': '达勒姆',
  'fort worth': '沃斯堡',
  'fremont': '弗里蒙特',
  'herndon': '赫恩登',
  'hillsboro': '希尔斯伯勒',
  'houston': '休斯顿',
  'jacksonville': '杰克逊维尔',
  'kansas city': '堪萨斯城',
  'las vegas': '拉斯维加斯',
  'los angeles': '洛杉矶',
  'mclean': '麦克林',
  'miami': '迈阿密',
  'minneapolis': '明尼阿波利斯',
  'new york': '纽约',
  'newark': '纽瓦克',
  'north bergen': '北卑尔根',
  'norwalk': '诺沃克',
  'ogden': '奥格登',
  'orlando': '奥兰多',
  'philadelphia': '费城',
  'phoenix': '凤凰城',
  'piscataway': '皮斯卡塔韦',
  'portland': '波特兰',
  'prineville': '普林维尔',
  'provo': '普罗沃',
  'quincy': '昆西',
  'raleigh': '罗利',
  'reston': '雷斯顿',
  'salt lake city': '盐湖城',
  'san francisco': '旧金山',
  'san jose': '圣何塞',
  'sandy': '桑迪',
  'santa clara': '圣克拉拉',
  'santa monica': '圣塔莫尼卡',
  'seattle': '西雅图',
  'secaucus': '塞考克斯',
  'somerset': '萨默塞特',
  'sunnyvale': '桑尼维尔',
  'tampa': '坦帕',
  'the dalles': '达尔斯',

  // 德国
  'berlin': '柏林',
  'dusseldorf': '杜塞尔多夫',
  'falkenstein': '法尔肯施泰因',
  'frankfurt': '法兰克福',
  'hamburg': '汉堡',
  'munich': '慕尼黑',
  'nuremberg': '纽伦堡',
  'stuttgart': '斯图加特',

  // 英国
  'canary wharf': '金丝雀码头',
  'london': '伦敦',
  'manchester': '曼彻斯特',
  'reading': '雷丁',
  'slough': '斯劳',

  // 荷兰
  'amsterdam': '阿姆斯特丹',
  'eindhoven': '埃因霍温',
  'haarlem': '哈勒姆',
  'rotterdam': '鹿特丹',
  'schiphol': '史基浦',
  'utrecht': '乌德勒支',

  // 法国
  'lyon': '里昂',
  'marseille': '马赛',
  'paris': '巴黎',
  'strasbourg': '斯特拉斯堡',

  // 加拿大
  'beauharnois': '博阿努瓦',
  'montreal': '蒙特利尔',
  'toronto': '多伦多',
  'vancouver': '温哥华',

  // 澳大利亚
  'brisbane': '布里斯班',
  'melbourne': '墨尔本',
  'perth': '珀斯',
  'sydney': '悉尼',

  // 土耳其
  'ankara': '安卡拉',
  'istanbul': '伊斯坦布尔',
  'izmir': '伊兹密尔',

  // 中国澳门
  'macao': '澳门',
  'macau': '澳门',

  // 俄罗斯
  'moscow': '莫斯科',
  'saint petersburg': '圣彼得堡',
  'st petersburg': '圣彼得堡'
};

const IPPURE_RESIDENTIAL_KEYS = ['isResidential', 'is_residential', 'residential'];
const IPPURE_RISK_KEYS = ['fraudScore', 'riskScore', 'risk_score', 'score'];

let CITY_REGEX = null;
let CITY_REGEX_READY = false;

function now() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function isEnvOn(v) {
  return String(v || '').trim() === '开启';
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getCityRegex() {
  if (CITY_REGEX_READY) return CITY_REGEX;

  const keys = Object.keys(cityMap)
    .sort((a, b) => b.length - a.length);

  CITY_REGEX = keys.length
    ? new RegExp('\\b(' + keys.map(escapeRegExp).join('|') + ')\\b')
    : null;

  CITY_REGEX_READY = true;
  return CITY_REGEX;
}

function normalizeCityKey(text) {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f.,]/g, '')
    .replace(/[-_\s]+/g, ' ');
}

function translateCity(text) {
  if (typeof text !== 'string') return '';

  const raw = text.trim();
  if (!raw) return '';

  const lower = raw.toLowerCase();

  let translated = cityMap[lower];
  if (translated) return translated;

  const key = normalizeCityKey(raw);
  if (!key) return raw;

  if (key !== lower) {
    translated = cityMap[key];
    if (translated) return translated;
  }

  const regex = getCityRegex();
  if (regex) {
    const match = regex.exec(key);
    if (match) return cityMap[match[1]];
  }

  return raw;
}

function parseBooleanLike(v) {
  if (typeof v === 'boolean') return v;

  if (typeof v === 'number') {
    if (v === 1) return true;
    if (v === 0) return false;
    return undefined;
  }

  if (typeof v === 'string') {
    switch (v.trim().toLowerCase()) {
      case 'true':
      case '1':
      case 'yes':
      case 'y':
        return true;

      case 'false':
      case '0':
      case 'no':
      case 'n':
        return false;

      default:
        return undefined;
    }
  }

  return undefined;
}

function pickFirstValidField(obj, keys) {
  if (!obj || typeof obj !== 'object') return undefined;

  for (let i = 0; i < keys.length; i++) {
    const value = obj[keys[i]];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return undefined;
}

function parsePositiveFloat(v, fallback) {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isSuccessfulResponse(ctx) {
  const status = ctx.response.status;
  return status >= 200 && status < 300;
}

function isJsonLikeResponse(ctx) {
  const contentType = ctx.response?.headers?.get?.('Content-Type') || '';

  return /(?:application|text)\/json|\+json|text\/plain/i.test(contentType);
}

function isValidIPInfoObject(data) {
  return (
    data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    typeof data.ip === 'string' &&
    data.ip.trim() !== ''
  );
}

async function getIPInfo(ctx) {
  if (!isSuccessfulResponse(ctx)) {
    console.log('原始响应状态码非 2xx，跳过改写:', ctx.response.status);

    return {
      ipInfo: null,
      fallbackBody: undefined,
      passthrough: true
    };
  }

  if (!isJsonLikeResponse(ctx)) {
    console.log(
      '原始响应不是 JSON-like 类型，跳过改写:',
      ctx.response.headers?.get?.('Content-Type') || '无 Content-Type'
    );

    return {
      ipInfo: null,
      fallbackBody: undefined,
      passthrough: true
    };
  }

  let text;

  try {
    text = await ctx.response.text();

    const data = JSON.parse(text);

    if (!isValidIPInfoObject(data)) {
      console.log('响应不是预期 IP 信息结构，跳过格式化改写');

      return {
        ipInfo: null,
        fallbackBody: text,
        passthrough: false
      };
    }

    if (typeof data.city_name === 'string' && data.city_name) {
      data.city_name_zh = translateCity(data.city_name);
    }

    return {
      ipInfo: data,
      passthrough: false
    };
  } catch (e) {
    console.log('IP信息解析失败，尝试返回原始响应:', e);

    return {
      ipInfo: null,
      fallbackBody: typeof text === 'string' ? text : undefined,
      passthrough: false
    };
  }
}

function cancelReader(reader) {
  if (!reader?.cancel) return;

  try {
    const result = reader.cancel();
    if (result?.catch) result.catch(() => {});
  } catch {}
}

async function getSpeedTest(ctx, policy, timeoutMs, packetBytes) {
  let downloadedBytes = 0;
  let reader = null;
  let timeoutId = null;
  let timedOut = false;
  let streamCompleted = false;

  const start = now();
  const deadline = start + timeoutMs;

  try {
    const response = await ctx.http.get(
      `https://speed.cloudflare.com/__down?bytes=${packetBytes}`,
      {
        timeout: timeoutMs,
        policy,
        credentials: 'omit'
      }
    );

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }

    reader = response.body?.getReader?.();
    if (!reader) throw new Error('Reader Error');

    const remainingMs = deadline - now();
    if (remainingMs <= 0) {
      throw new Error('Timeout');
    }

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        cancelReader(reader);
        reject(new Error('Timeout'));
      }, Math.max(1, Math.ceil(remainingMs)));
    });

    timeoutPromise.catch(() => {});

    while (true) {
      const readPromise = reader.read();

      readPromise.catch(() => {});

      const { done, value } = await Promise.race([
        readPromise,
        timeoutPromise
      ]);

      if (timedOut) {
        throw new Error('Timeout');
      }

      if (done) {
        streamCompleted = true;
        break;
      }

      downloadedBytes += value?.byteLength || value?.length || 0;
    }
  } catch {
  } finally {
    if (timeoutId) clearTimeout(timeoutId);

    if (!streamCompleted) {
      cancelReader(reader);
    }

    if (reader?.releaseLock) {
      try {
        reader.releaseLock();
      } catch {}
    }
  }

  if (downloadedBytes <= 0) return '⚠️ 测速失败';

  const seconds = (now() - start) / 1000;
  if (seconds < 0.2) return '⚠️ 测速失败';

  return `${((downloadedBytes * 8) / 1e6 / seconds).toFixed(1)} Mbps`;
}

function pickIPPureData(d) {
  if (!d || typeof d !== 'object') return null;

  if (d.data && typeof d.data === 'object') return d.data;
  if (d.result && typeof d.result === 'object') return d.result;

  return d;
}

function formatNativeType(isResidential) {
  if (isResidential === true) return '原生住宅';
  if (isResidential === false) return '商业机房';

  return null;
}

function formatRiskLevel(risk) {
  if (risk === undefined || risk === null || risk === '') return null;

  const score = Number(risk);
  if (!Number.isFinite(score)) return null;

  if (score >= 80) return `极高风险 (${score})`;
  if (score >= 70) return `高风险 (${score})`;
  if (score >= 40) return `中等风险 (${score})`;

  return `纯净低危 (${score})`;
}

function makeIPPureStatus(failed, reason) {
  if (reason) {
    console.log(failed ? 'IPPure不可用:' : '暂无评级:', reason);
  }

  return {
    failed,
    nativeText: null,
    riskText: failed ? null : '暂无评级'
  };
}

function normalizeIPPureInfo(d) {
  const data = pickIPPureData(d);
  if (!data) return makeIPPureStatus(false, 'IPPure返回数据为空');

  const rawResidential = pickFirstValidField(data, IPPURE_RESIDENTIAL_KEYS);
  const rawRiskScore = pickFirstValidField(data, IPPURE_RISK_KEYS);

  const nativeText = formatNativeType(parseBooleanLike(rawResidential));
  const riskText = formatRiskLevel(rawRiskScore);

  if (!nativeText && !riskText) {
    console.log('IPPure字段缺失，返回字段:', Object.keys(data).join(','));
    return makeIPPureStatus(false, '缺少fraudScore和isResidential字段');
  }

  return {
    failed: false,
    nativeText,
    riskText
  };
}

async function getIPPureInfo(ctx, policy) {
  try {
    const res = await ctx.http.get('https://my.ippure.com/v1/info', {
      timeout: 5000,
      policy,
      credentials: 'omit'
    });

    if (res.status < 200 || res.status >= 300) {
      console.log('IPPure HTTP状态异常:', res.status);
      return makeIPPureStatus(true, `HTTP ${res.status}`);
    }

    const d = await res.json();

    if (!d || typeof d !== 'object') {
      return makeIPPureStatus(false, 'IPPure返回内容为空');
    }

    return normalizeIPPureInfo(d);
  } catch (e) {
    console.log('IPPure信息获取失败:', e);
    return makeIPPureStatus(true, 'IPPure请求失败或超时');
  }
}

function formatIPPureText(ipPureInfo) {
  if (!ipPureInfo) return null;
  if (ipPureInfo.failed) return 'IPPure信息获取失败';

  const nativeText = ipPureInfo.nativeText;
  const riskText = ipPureInfo.riskText;

  if (nativeText && riskText) return `${nativeText}·${riskText}`;

  return nativeText || riskText || '暂无评级';
}

function normalizePlaceNameForCompare(text) {
  return String(text || '')
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/\s+/g, '')
    .replace(/[·・.。,_-]/g, '')
    .trim()
    .toLowerCase();
}

function getCountryName(ipInfo) {
  const countryCode = String(ipInfo?.country_code || '').toUpperCase();

  return (
    codeMap[countryCode] ||
    countryCode ||
    '未知'
  ).trim();
}

function formatLocationName(ipInfo) {
  const countryName = getCountryName(ipInfo);

  const cityName = typeof ipInfo.city_name_zh === 'string'
    ? ipInfo.city_name_zh.trim()
    : '';

  if (!cityName) {
    return countryName;
  }

  const normalizedCountry = normalizePlaceNameForCompare(countryName);
  const normalizedCity = normalizePlaceNameForCompare(cityName);

  if (
    normalizedCountry &&
    normalizedCity &&
    normalizedCountry.endsWith(normalizedCity)
  ) {
    return countryName;
  }

  return `${countryName}·${cityName}`;
}

function modResponseBody(ipInfo, speedMbps, ipPureInfo) {
  const ipPureText = formatIPPureText(ipPureInfo);

  const body = {
    'IP地址': ipInfo.ip || '未知',

    '出口': formatLocationName(ipInfo),

    '互联网服务提供商': ipInfo.asn
      ? `AS${ipInfo.asn} ${ipInfo.as_desc || ''}`.trim()
      : '未知',

    '客户端': ipInfo.user_agent
      ? ipInfo.user_agent.replace(/^egern/i, 'Egern')
      : 'Egern'
  };

  if (speedMbps) {
    body['下行带宽'] = speedMbps;
  }

  if (ipPureText) {
    body['IP纯净度'] = ipPureText;
  }

  return body;
}

function prepareResponseHeaders(ctx, contentType) {
  const headers = new Headers(ctx.response.headers);

  if (contentType) {
    headers.set('Content-Type', contentType);
  }

  headers.delete('Content-Length');
  headers.delete('Content-Encoding');
  headers.delete('ETag');

  return headers;
}

export default async function(ctx) {
  if (!ctx.response) return;

  const env = ctx.env || {};
  const policy = env.POLICY || 'DIRECT';

  const ipResult = await getIPInfo(ctx);

  if (ipResult?.passthrough) {
    return;
  }

  const ipInfo = ipResult?.ipInfo;

  if (!ipInfo) {
    if (typeof ipResult?.fallbackBody === 'string') {
      return {
        headers: prepareResponseHeaders(ctx),
        body: ipResult.fallbackBody
      };
    }

    console.log('IP信息读取失败且无可回写原文，返回错误响应');
    return {
      headers: prepareResponseHeaders(ctx, 'application/json; charset=utf-8'),
      body: {
        error: 'IP信息解析失败',
        message: '原始响应体已无法安全回写'
      }
    };
  }

  const showSpeedTest = isEnvOn(env.SHOW_SPEED_TEST);
  const showIPPure = isEnvOn(env.SHOW_IPPURE);

  let speedTask = null;

  if (showSpeedTest) {
    const speedTimeoutMs = Math.floor(
      parsePositiveFloat(env.SPEED_TEST_TIMEOUT, 5) * 1000
    );

    const speedPacketBytes = Math.floor(
      parsePositiveFloat(env.SPEED_TEST_PACKET, 3) * 1048576
    );

    speedTask = getSpeedTest(
      ctx,
      policy,
      speedTimeoutMs,
      speedPacketBytes
    );
  }

  const ipPureTask = showIPPure
    ? getIPPureInfo(ctx, policy)
    : null;

  const [speedMbps, ipPureInfo] = await Promise.all([
    speedTask,
    ipPureTask
  ]);

  return {
    headers: prepareResponseHeaders(ctx, 'application/json; charset=utf-8'),
    body: modResponseBody(ipInfo, speedMbps, ipPureInfo)
  };
}