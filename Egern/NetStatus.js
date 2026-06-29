/**
 * ==========================================================================
 * 📌 网络服务解锁监测 (NetStatus) 小组件
 *
 * ✨ 主要功能：
 * • 刷新时检测：支持 YouTube、Netflix、ChatGPT、Gemini 4 项主流服务。
 * • 真实地区：通过 ipwho.de 按服务对应策略检测出口 IP 地区。
 * • 策略配置：通过 Egern Widget 环境变量配置每个服务使用的策略。
 * • 智能布局：适配 iOS Small、Medium、Large 三种组件尺寸。
 * • 布局样式：Medium / Large 使用上面两个、下面两个的 2×2 布局。
 * • 状态展示：显示服务连通状态、出口地区及响应延迟。
 *
 * Egern 环境变量示例：
 *
 * widgets:
 *   - name: "NetStatus"
 *     env:
 *       YouTube: "YouTube"
 *       Netflix: "Netflix"
 *       ChatGPT: "OpenAI"
 *       Gemini: "Gemini"
 *
 * 注意：
 * • 环境变量的值必须填写为你 Egern 中真实存在的策略名 / 策略组名。
 * • 如果某个环境变量不填写，则对应服务使用当前默认策略。
 * • 该组件会在每次刷新时发起网络检测请求，不是严格实时检测。
 * ==========================================================================
 */

export default async function(ctx) {
  const env = ctx.env || {};

  const envSize = ctx.widgetFamily || 'systemMedium';
  const sizeStr = String(envSize).toLowerCase();

  const isSmall = sizeStr.includes('small');
  const isLarge = sizeStr.includes('large');

  const REFRESH_INTERVAL_MINUTES = 15;

  const SERVICE_POLICY = {
    YouTube: String(env.YouTube || '').trim(),
    Netflix: String(env.Netflix || '').trim(),
    ChatGPT: String(env.ChatGPT || '').trim(),
    Gemini: String(env.Gemini || '').trim()
  };

  const C = {
    bg:          { light: '#FFFFFF', dark: '#050506' },
    text:        { light: '#111114', dark: '#F7F7F8' },
    dim:         { light: '#7B7B84', dark: '#85858E' },
    panel:       { light: '#F5F5F7', dark: '#111114' },
    chip:        { light: '#E8E8ED', dark: '#202025' },
    ok:          { light: '#2F9E58', dark: '#C7FF18' },
    warn:        { light: '#8A4FC4', dark: '#C887FF' },
    fail:        { light: '#D64545', dark: '#FF626A' },
    terminalDim: { light: '#696971', dark: '#A5A5AE' }
  };

  const codeMap = {
    HK: '🇭🇰 香港',
    TW: '🇹🇼 台湾',
    SG: '🇸🇬 新加坡',
    JP: '🇯🇵 日本',
    KR: '🇰🇷 韩国',
    US: '🇺🇸 美国',
    DE: '🇩🇪 德国',
    GB: '🇬🇧 英国',
    NL: '🇳🇱 荷兰',
    FR: '🇫🇷 法国',
    CA: '🇨🇦 加拿大',
    AU: '🇦🇺 澳大利亚',
    TR: '🇹🇷 土耳其',
    MO: '🇲🇴 澳门',
    RU: '🇷🇺 俄罗斯'
  };

  const commonHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache'
  };

  function nextRefreshISO(minutes = REFRESH_INTERVAL_MINUTES) {
    return new Date(Date.now() + minutes * 60 * 1000).toISOString();
  }

  function monoFont(size, weight = 'medium') {
    return {
      size,
      weight,
      family: 'Menlo'
    };
  }

  function fixedSpace(length) {
    return {
      type: 'spacer',
      length
    };
  }

  function now() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  function getFlagEmoji(cc) {
    if (!cc || cc === 'XX' || cc === '--') return '🌐';

    return String(cc)
      .toUpperCase()
      .replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397));
  }

  function normalizeRegion(value) {
    const cc = String(value || '').trim().toUpperCase();
    return /^[A-Z]{2}$/.test(cc) ? cc : 'XX';
  }

  function firstValid(...values) {
    return values.find(v => v !== undefined && v !== null && v !== '');
  }

  function formatRegion(region) {
    const cc = normalizeRegion(region);

    if (cc === 'XX') return '--';

    return codeMap[cc] || `${getFlagEmoji(cc)} ${cc}`;
  }

  function buildOptions(options = {}, policy = '') {
    const finalOptions = {
      credentials: 'omit',
      ...options,
      headers: {
        ...commonHeaders,
        ...(options.headers || {})
      }
    };

    if (policy) {
      finalOptions.policy = policy;
    }

    return finalOptions;
  }

  /**
   * 只统计耗时，不再使用 Promise.race 做 JS 层超时。
   * 请求超时完全交给 ctx.http.get 的 timeout 选项处理。
   */
  async function timed(fn) {
    const start = now();

    try {
      const result = await fn();

      return {
        ...result,
        ms: Math.round(now() - start)
      };
    } catch {
      return {
        code: 'ERR',
        region: 'XX',
        regionText: '--',
        ms: Math.round(now() - start)
      };
    }
  }

  function includesAny(text, keywords) {
    const lowerText = String(text || '').toLowerCase();
    return keywords.some(keyword => lowerText.includes(String(keyword).toLowerCase()));
  }

  function isBlockedBody(text) {
    return includesAny(text, [
      'access denied',
      'not available in your country',
      'not available in your region',
      'unsupported country',
      'unsupported region',
      'service unavailable in your country',
      'too many requests',
      'captcha',
      'verify you are human'
    ]);
  }

  /**
   * 服务检测配置集中管理。
   *
   * 说明：
   * - YouTube 使用 generate_204，要求返回 204。
   * - Netflix / ChatGPT / Gemini 不再只用 status === 200 判断，
   *   会检查返回体中是否出现明显的封锁、风控、不可用提示。
   * - 由于不同服务页面内容会变化，此处仍然是启发式检测，
   *   但比简单 HTTP 状态码判断更保守，能减少误报 OK。
   */
  const SERVICE_CONFIGS = [
    {
      name: 'YouTube',
      url: () => `https://www.youtube.com/generate_204?_t=${Date.now()}`,
      timeout: 3000,
      redirect: 'manual',
      needBody: false,
      validate: ({ status }) => status === 204
    },
    {
      name: 'Netflix',
      url: () => `https://www.netflix.com/title/81280792?_t=${Date.now()}`,
      timeout: 5000,
      redirect: 'follow',
      needBody: true,
      validate: ({ status, body }) => {
        if (status < 200 || status >= 400) return false;
        if (!body) return false;
        if (isBlockedBody(body)) return false;

        return includesAny(body, [
          'netflix',
          'watch',
          'title',
          'signin',
          'sign in'
        ]);
      }
    },
    {
      name: 'ChatGPT',
      url: () => `https://chatgpt.com/?_t=${Date.now()}`,
      timeout: 4000,
      redirect: 'follow',
      needBody: true,
      validate: ({ status, body }) => {
        if (status < 200 || status >= 400) return false;
        if (!body) return false;
        if (isBlockedBody(body)) return false;

        return includesAny(body, [
          'chatgpt',
          'openai'
        ]);
      }
    },
    {
      name: 'Gemini',
      url: () => `https://gemini.google.com/app?_t=${Date.now()}`,
      timeout: 4000,
      redirect: 'follow',
      needBody: true,
      validate: ({ status, body }) => {
        if (status < 200 || status >= 400) return false;
        if (!body) return false;
        if (isBlockedBody(body)) return false;

        return includesAny(body, [
          'gemini',
          'google'
        ]);
      }
    }
  ];

  async function checkServiceAvailability(service, policy = '') {
    const res = await ctx.http
      .get(service.url(), buildOptions({
        timeout: service.timeout,
        redirect: service.redirect
      }, policy))
      .catch(() => null);

    if (!res) {
      return {
        code: 'ERR'
      };
    }

    let body = '';

    if (service.needBody) {
      body = await res.text().catch(() => '');
    }

    const ok = service.validate({
      status: res.status,
      body
    });

    return {
      code: ok ? 'OK' : 'ERR'
    };
  }

  async function fetchRegionByPolicy(policy = '') {
    const ts = Date.now();

    const res = await ctx.http
      .get(`http://ipwho.de/json?_t=${ts}`, buildOptions({
        timeout: 2500,
        redirect: 'follow'
      }, policy))
      .catch(() => null);

    if (!res || res.status < 200 || res.status >= 300) {
      return {
        code: 'ERR',
        region: 'XX',
        regionText: '--'
      };
    }

    try {
      const data = await res.json();

      const region = normalizeRegion(
        firstValid(
          data.country_code,
          data.countryCode,
          data.countryCode2,
          data.country_code2
        )
      );

      if (region === 'XX') {
        return {
          code: 'ERR',
          region: 'XX',
          regionText: '--'
        };
      }

      return {
        code: 'OK',
        region,
        regionText: formatRegion(region)
      };
    } catch {
      return {
        code: 'ERR',
        region: 'XX',
        regionText: '--'
      };
    }
  }

  const regionCache = new Map();

  function getRegionByPolicy(policy = '') {
    const key = policy || '__DEFAULT__';

    if (!regionCache.has(key)) {
      regionCache.set(key, fetchRegionByPolicy(policy));
    }

    return regionCache.get(key);
  }

  async function checkService(service) {
    const policy = SERVICE_POLICY[service.name] || '';

    const [statusResult, regionResult] = await Promise.all([
      timed(() => checkServiceAvailability(service, policy)),
      timed(() => getRegionByPolicy(policy))
    ]);

    const available = statusResult.code === 'OK';
    const regionAvailable = regionResult.code === 'OK';

    return {
      name: service.name,
      info: {
        available,
        region: regionAvailable ? regionResult.region : 'XX',
        regionText: regionAvailable ? regionResult.regionText : '--',
        ms: statusResult.ms || 0
      }
    };
  }

  const allServices = await Promise.all(
    SERVICE_CONFIGS.map(service => checkService(service))
  );

  const totalCount = allServices.length;
  const okCount = allServices.filter(s => s.info.available).length;
  const unavailableCount = totalCount - okCount;

  const nowDate = new Date();
  const time = `${String(nowDate.getHours()).padStart(2, '0')}:${String(nowDate.getMinutes()).padStart(2, '0')}`;

  const responseColor = (ms, available) => {
    if (!available) return C.fail;
    return ms >= 1500 ? C.warn : C.terminalDim;
  };

  const renderHeader = () => ({
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 8,
    children: [
      {
        type: 'image',
        src: 'sf-symbol:antenna.radiowaves.left.and.right',
        color: unavailableCount === 0 ? C.ok : C.dim,
        width: 14,
        height: 14
      },
      {
        type: 'text',
        text: '网络服务解锁',
        font: {
          size: 14,
          weight: 'bold'
        },
        textColor: C.text
      },
      {
        type: 'spacer'
      },
      {
        type: 'stack',
        padding: [2, 6, 2, 6],
        backgroundColor: C.chip,
        borderRadius: 4,
        children: [
          {
            type: 'text',
            text: `${okCount}/${totalCount}`,
            font: monoFont(10, 'bold'),
            textColor: unavailableCount === 0 ? C.ok : C.fail
          }
        ]
      },
      {
        type: 'text',
        text: time,
        font: monoFont(12, 'medium'),
        textColor: C.dim
      }
    ]
  });

  function baseWidget(extra) {
    return {
      type: 'widget',
      refreshAfter: nextRefreshISO(),
      backgroundColor: C.bg,
      ...extra
    };
  }

  const renderSmall = () => {
    return baseWidget({
      padding: [10, 14, 10, 14],
      gap: 4,
      children: [
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 6,
          padding: [0, 0, 4, 0],
          children: [
            {
              type: 'image',
              src: 'sf-symbol:antenna.radiowaves.left.and.right',
              color: unavailableCount === 0 ? C.ok : C.dim,
              width: 12,
              height: 12
            },
            {
              type: 'text',
              text: '解锁状态',
              font: {
                size: 11,
                weight: 'bold'
              },
              textColor: C.dim,
              maxLines: 1
            },
            {
              type: 'spacer'
            },
            {
              type: 'stack',
              padding: [2, 6, 2, 6],
              backgroundColor: C.chip,
              borderRadius: 4,
              children: [
                {
                  type: 'text',
                  text: `${okCount}/${totalCount}`,
                  font: monoFont(10, 'bold'),
                  textColor: unavailableCount === 0 ? C.ok : C.fail
                }
              ]
            },
            fixedSpace(2),
            {
              type: 'text',
              text: time,
              font: monoFont(10, 'medium'),
              textColor: C.dim,
              maxLines: 1
            }
          ]
        },
        {
          type: 'stack',
          direction: 'column',
          flex: 1,
          gap: 5,
          children: allServices.map(item => ({
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            gap: 6,
            children: [
              {
                type: 'stack',
                width: 5,
                height: 5,
                borderRadius: 2.5,
                backgroundColor: item.info.available ? C.ok : C.fail
              },
              {
                type: 'text',
                text: item.name,
                font: {
                  size: 11,
                  weight: 'bold'
                },
                textColor: C.text,
                maxLines: 1,
                minScale: 0.7
              },
              {
                type: 'spacer'
              },
              {
                type: 'text',
                text: item.info.regionText,
                font: monoFont(10, 'bold'),
                textColor: C.dim,
                maxLines: 1,
                minScale: 0.7
              }
            ]
          }))
        }
      ]
    });
  };

  function renderServiceBlock(item, style) {
    return {
      type: 'stack',
      direction: 'column',
      backgroundColor: C.panel,
      borderRadius: style.borderRadius,
      padding: style.padding,
      flex: 1,
      gap: style.gap,
      children: [
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 6,
          children: [
            {
              type: 'text',
              text: item.name,
              font: {
                size: style.nameSize,
                weight: 'bold'
              },
              textColor: C.text,
              flex: 1,
              maxLines: 1,
              minScale: 0.7
            },
            {
              type: 'stack',
              width: style.dotSize,
              height: style.dotSize,
              borderRadius: style.dotSize / 2,
              backgroundColor: item.info.available ? C.ok : C.fail
            }
          ]
        },
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 6,
          children: [
            {
              type: 'text',
              text: item.info.regionText,
              font: monoFont(style.regionSize, style.regionWeight),
              textColor: C.dim,
              maxLines: 1,
              minScale: 0.7
            },
            {
              type: 'spacer'
            },
            {
              type: 'text',
              text: `${item.info.ms}ms`,
              font: monoFont(style.msSize, 'medium'),
              textColor: responseColor(item.info.ms, item.info.available),
              maxLines: 1,
              minScale: 0.7
            }
          ]
        }
      ]
    };
  }

  function renderGrid(style) {
    return {
      type: 'stack',
      direction: 'column',
      gap: style.rowGap,
      flex: 1,
      children: [
        {
          type: 'stack',
          direction: 'row',
          gap: style.columnGap,
          flex: 1,
          children: allServices.slice(0, 2).map(item => renderServiceBlock(item, style.card))
        },
        {
          type: 'stack',
          direction: 'row',
          gap: style.columnGap,
          flex: 1,
          children: allServices.slice(2, 4).map(item => renderServiceBlock(item, style.card))
        }
      ]
    };
  }

  const renderMedium = () => {
    return baseWidget({
      padding: [14, 14, 14, 14],
      gap: 10,
      children: [
        renderHeader(),
        renderGrid({
          rowGap: 8,
          columnGap: 8,
          card: {
            borderRadius: 8,
            padding: [8, 8, 8, 8],
            gap: 5,
            nameSize: 11,
            regionSize: 10,
            regionWeight: 'semibold',
            msSize: 9,
            dotSize: 5
          }
        })
      ]
    });
  };

  const renderLarge = () => {
    return baseWidget({
      padding: [16, 16, 16, 16],
      gap: 10,
      children: [
        renderHeader(),
        renderGrid({
          rowGap: 10,
          columnGap: 10,
          card: {
            borderRadius: 12,
            padding: [12, 14, 12, 14],
            gap: 6,
            nameSize: 13,
            regionSize: 11,
            regionWeight: 'bold',
            msSize: 11,
            dotSize: 7
          }
        })
      ]
    });
  };

  if (isSmall) return renderSmall();
  if (isLarge) return renderLarge();

  return renderMedium();
}