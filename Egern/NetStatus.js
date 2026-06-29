/**
 * ==========================================================================
 * 📌 网络服务解锁监测 (NetStatus) 小组件
 *
 * ✨ 主要功能：
 * • 实时检测：支持 YouTube、Netflix、ChatGPT、Gemini 4 项主流服务。
 * • 真实地区：通过 ipwho.de 按服务对应策略检测真实出口 IP 地区。
 * • 策略配置：通过 Egern Widget 环境变量配置每个服务使用的策略。
 * • 智能布局：适配 iOS Small、Medium、Large 三种组件尺寸。
 * • 布局样式：Medium / Large 使用上面两个、下面两个的 2×2 布局。
 * • 状态展示：显示服务连通状态、真实出口地区及响应延迟。
 *
 * Egern 环境变量示例：
 *
 * widgets:
 *   - name: "NetStatus"
 *     env:
 *       YouTube: "YouTube"
 *       Netflix: "Netflix"
 *       ChatGPT: "OpenAI"
 *       Google: "Google"
 *
 * 注意：
 * • 环境变量的值必须填写为你 Egern 中真实存在的策略名 / 策略组名。
 * • 如果某个环境变量不填写，则对应服务使用当前默认策略。
 * ==========================================================================
 */

export default async function(ctx) {
  const env = ctx.env || {};

  const envSize = ctx.widgetFamily || 'systemMedium';
  const sizeStr = String(envSize).toLowerCase();

  const isSmall = sizeStr.includes('small');
  const isLarge = sizeStr.includes('large');

  /**
   * 从 Egern 环境变量读取每个服务对应的策略名。
   *
   * 可在 Egern Widget env 中配置：
   * YouTube
   * Netflix
   * ChatGPT
   * Google
   *
   * 说明：
   * Google 环境变量用于 Gemini 检测。
   */
  const SERVICE_POLICY = {
    YouTube: String(env.YouTube || '').trim(),
    Netflix: String(env.Netflix || '').trim(),
    ChatGPT: String(env.ChatGPT || '').trim(),
    Gemini: String(env.Google || '').trim()
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
    TW: '🇼🇸 台湾',
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

  async function timed(fn, timeoutMs = 3000) {
    const start = now();
    let timeoutId = null;

    try {
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Timeout'));
        }, timeoutMs);
      });

      const result = await Promise.race([
        fn(),
        timeoutPromise
      ]);

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
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
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
          data.country_code2,
          data.countryCode3
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

  async function checkYouTube(policy = '') {
    const res = await ctx.http
      .get(`https://www.youtube.com/generate_204?_t=${Date.now()}`, buildOptions({
        timeout: 3000,
        redirect: 'manual'
      }, policy))
      .catch(() => null);

    return {
      code: res?.status === 204 ? 'OK' : 'ERR'
    };
  }

  async function checkNetflix(policy = '') {
    const res = await ctx.http
      .get(`https://www.netflix.com/title/81280792?_t=${Date.now()}`, buildOptions({
        timeout: 5000,
        redirect: 'follow'
      }, policy))
      .catch(() => null);

    return {
      code: res?.status === 200 ? 'OK' : 'ERR'
    };
  }

  async function checkChatGPT(policy = '') {
    const res = await ctx.http
      .get(`https://chatgpt.com/?_t=${Date.now()}`, buildOptions({
        timeout: 3000,
        redirect: 'manual'
      }, policy))
      .catch(() => null);

    return {
      code: res && res.status !== 403 && res.status !== 429 && res.status < 500
        ? 'OK'
        : 'ERR'
    };
  }

  async function checkGemini(policy = '') {
    const res = await ctx.http
      .get(`https://gemini.google.com/app?_t=${Date.now()}`, buildOptions({
        timeout: 3000,
        redirect: 'follow'
      }, policy))
      .catch(() => null);

    return {
      code: res && res.status === 200 ? 'OK' : 'ERR'
    };
  }

  const SERVICES = [
    {
      name: 'YouTube',
      check: checkYouTube,
      timeout: 3000
    },
    {
      name: 'Netflix',
      check: checkNetflix,
      timeout: 5000
    },
    {
      name: 'ChatGPT',
      check: checkChatGPT,
      timeout: 3000
    },
    {
      name: 'Gemini',
      check: checkGemini,
      timeout: 3000
    }
  ];

  async function checkService(service) {
    const policy = SERVICE_POLICY[service.name] || '';

    const [statusResult, regionResult] = await Promise.all([
      timed(() => service.check(policy), service.timeout),
      timed(() => getRegionByPolicy(policy), 2500)
    ]);

    const available = statusResult.code !== 'ERR';
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
    SERVICES.map(service => checkService(service))
  );

  const totalCount = allServices.length;
  const okCount = allServices.filter(s => s.info.available).length;
  const lockedCount = totalCount - okCount;

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
    children: [
      {
        type: 'image',
        src: 'sf-symbol:antenna.radiowaves.left.and.right',
        color: lockedCount === 0 ? C.ok : C.dim,
        width: 14,
        height: 14
      },
      {
        type: 'stack',
        width: 8
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
            font: {
              size: 10,
              weight: 'bold',
              design: 'monospaced'
            },
            textColor: lockedCount === 0 ? C.ok : C.fail
          }
        ]
      },
      {
        type: 'stack',
        width: 8
      },
      {
        type: 'text',
        text: time,
        font: {
          size: 12,
          weight: 'medium',
          design: 'monospaced'
        },
        textColor: C.dim
      }
    ]
  });

  const renderSmall = () => {
    return {
      type: 'widget',
      backgroundColor: C.bg,
      padding: [10, 14, 10, 14],
      children: [
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          padding: [0, 0, 4, 0],
          children: [
            {
              type: 'image',
              src: 'sf-symbol:antenna.radiowaves.left.and.right',
              color: lockedCount === 0 ? C.ok : C.dim,
              width: 12,
              height: 12
            },
            {
              type: 'stack',
              width: 6
            },
            {
              type: 'text',
              text: '解锁状态',
              font: {
                size: 11,
                weight: 'bold'
              },
              textColor: C.dim
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
                  font: {
                    size: 10,
                    weight: 'bold',
                    design: 'monospaced'
                  },
                  textColor: lockedCount === 0 ? C.ok : C.fail
                }
              ]
            },
            {
              type: 'stack',
              width: 8
            },
            {
              type: 'text',
              text: time,
              font: {
                size: 10,
                weight: 'medium',
                design: 'monospaced'
              },
              textColor: C.dim
            }
          ]
        },
        {
          type: 'stack',
          direction: 'column',
          flex: 1,
          justifyContent: 'space-around',
          gap: 4,
          children: allServices.map(item => ({
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            spacing: 6,
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
                maxLines: 1
              },
              {
                type: 'spacer'
              },
              {
                type: 'text',
                text: item.info.regionText,
                font: {
                  size: 10,
                  weight: 'bold',
                  design: 'monospaced'
                },
                textColor: C.dim,
                maxLines: 1
              }
            ]
          }))
        }
      ]
    };
  };

  const renderMedium = () => {
    const MediumServiceBlock = (item) => ({
      type: 'stack',
      direction: 'column',
      backgroundColor: C.panel,
      borderRadius: 8,
      padding: [8, 8, 8, 8],
      flex: 1,
      gap: 5,
      children: [
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          children: [
            {
              type: 'text',
              text: item.name,
              font: {
                size: 11,
                weight: 'bold'
              },
              textColor: C.text,
              flex: 1,
              maxLines: 1
            },
            {
              type: 'stack',
              width: 5,
              height: 5,
              borderRadius: 2.5,
              backgroundColor: item.info.available ? C.ok : C.fail
            }
          ]
        },
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          children: [
            {
              type: 'text',
              text: item.info.regionText,
              font: {
                size: 10,
                weight: 'semibold',
                design: 'monospaced'
              },
              textColor: C.dim,
              maxLines: 1
            },
            {
              type: 'spacer'
            },
            {
              type: 'text',
              text: `${item.info.ms}ms`,
              font: {
                size: 9,
                weight: 'medium',
                design: 'monospaced'
              },
              textColor: responseColor(item.info.ms, item.info.available)
            }
          ]
        }
      ]
    });

    return {
      type: 'widget',
      backgroundColor: C.bg,
      padding: [14, 14, 14, 14],
      gap: 10,
      children: [
        renderHeader(),
        {
          type: 'stack',
          direction: 'column',
          gap: 8,
          flex: 1,
          children: [
            {
              type: 'stack',
              direction: 'row',
              gap: 8,
              children: allServices.slice(0, 2).map(MediumServiceBlock)
            },
            {
              type: 'stack',
              direction: 'row',
              gap: 8,
              children: allServices.slice(2, 4).map(MediumServiceBlock)
            }
          ]
        }
      ]
    };
  };

  const renderLarge = () => {
    const LargeServiceBlock = (item) => ({
      type: 'stack',
      direction: 'column',
      backgroundColor: C.panel,
      borderRadius: 12,
      padding: [12, 14, 12, 14],
      flex: 1,
      gap: 6,
      children: [
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          children: [
            {
              type: 'text',
              text: item.name,
              font: {
                size: 13,
                weight: 'bold'
              },
              textColor: C.text,
              flex: 1
            },
            {
              type: 'stack',
              width: 7,
              height: 7,
              borderRadius: 3.5,
              backgroundColor: item.info.available ? C.ok : C.fail
            }
          ]
        },
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          children: [
            {
              type: 'text',
              text: item.info.regionText,
              font: {
                size: 11,
                weight: 'bold',
                design: 'monospaced'
              },
              textColor: C.dim,
              maxLines: 1
            },
            {
              type: 'spacer'
            },
            {
              type: 'text',
              text: `${item.info.ms}ms`,
              font: {
                size: 11,
                weight: 'medium',
                design: 'monospaced'
              },
              textColor: responseColor(item.info.ms, item.info.available)
            }
          ]
        }
      ]
    });

    return {
      type: 'widget',
      backgroundColor: C.bg,
      padding: [16, 16, 16, 16],
      gap: 10,
      children: [
        renderHeader(),
        {
          type: 'stack',
          direction: 'column',
          gap: 10,
          flex: 1,
          children: [
            {
              type: 'stack',
              direction: 'row',
              gap: 10,
              flex: 1,
              children: allServices.slice(0, 2).map(LargeServiceBlock)
            },
            {
              type: 'stack',
              direction: 'row',
              gap: 10,
              flex: 1,
              children: allServices.slice(2, 4).map(LargeServiceBlock)
            }
          ]
        }
      ]
    };
  };

  if (isSmall) return renderSmall();
  if (isLarge) return renderLarge();

  return renderMedium();
}