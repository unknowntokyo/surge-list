/**
 * ==========================================================================
 * 📌 网络服务解锁监测 (NetStatus) 小组件
 *
 * ✨ 主要功能：
 * • 实时检测：支持 YouTube、Netflix、ChatGPT、Gemini 4 项主流服务。
 * • 智能布局：适配 iOS 系统 Small、Medium、Large 三种组件尺寸。
 * • 出口检测：通过 ipwho.de 检测当前代理出口 IP 地区。
 * • 状态展示：显示各服务连通状态、预设地区标识、出口地区及响应延迟。
 * • 防缓存机制：通过请求头和时间戳尽量避免缓存影响。
 *
 * 🔗 原始引用链接: https://raw.githubusercontent.com/jnlaoshu/MySelf/master/Egern/Widget/NetStatus.js
 * ==========================================================================
 */

export default async function(ctx) {
  const envSize = ctx.widgetFamily || 'systemMedium';
  const sizeStr = String(envSize).toLowerCase();

  const isSmall = sizeStr.includes('small');
  const isLarge = sizeStr.includes('large');

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

  const commonHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache'
  };

  const getFlagEmoji = (cc) => {
    if (!cc || cc === 'XX' || cc === '--') return '🌐';

    return String(cc)
      .toUpperCase()
      .replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397));
  };

  const POLICY_REGION = {
    YouTube: 'HK',
    Netflix: 'SG',
    ChatGPT: 'US',
    Gemini: 'US'
  };

  async function timed(fn, timeoutMs = 3000) {
    const start = Date.now();

    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), timeoutMs);
        })
      ]);

      return {
        ...result,
        ms: Date.now() - start
      };
    } catch {
      return {
        code: 'ERR',
        ms: Date.now() - start
      };
    }
  }

  async function fetchProxy() {
    const ts = Date.now();

    const res = await ctx.http
      .get(`http://ipwho.de/json?_t=${ts}`, {
        timeout: 2500,
        headers: commonHeaders
      })
      .catch(() => null);

    if (!res || res.status < 200 || res.status >= 300) {
      return {
        code: 'ERR',
        cc: 'XX'
      };
    }

    try {
      const data = JSON.parse(await res.text());

      const cc = String(
        data.country_code ||
        data.countryCode ||
        data.countryCode2 ||
        data.country ||
        ''
      )
        .trim()
        .toUpperCase();

      const normalizedCc = /^[A-Z]{2}$/.test(cc) ? cc : 'XX';

      return {
        code: normalizedCc === 'XX' ? 'ERR' : 'OK',
        cc: normalizedCc
      };
    } catch {
      return {
        code: 'ERR',
        cc: 'XX'
      };
    }
  }

  async function checkYouTube() {
    const res = await ctx.http
      .get(`https://www.youtube.com/generate_204?_t=${Date.now()}`, {
        timeout: 3000,
        headers: commonHeaders
      })
      .catch(() => null);

    return {
      code: res?.status === 204 ? 'OK' : 'ERR'
    };
  }

  async function checkNetflix() {
    const res = await ctx.http
      .get(`https://www.netflix.com/title/81280792?_t=${Date.now()}`, {
        timeout: 5000,
        headers: commonHeaders,
        followRedirect: true
      })
      .catch(() => null);

    return {
      code: res?.status === 200 ? 'OK' : 'ERR'
    };
  }

  async function checkChatGPT() {
    const res = await ctx.http
      .get(`https://chatgpt.com/?_t=${Date.now()}`, {
        timeout: 3000,
        headers: commonHeaders,
        followRedirect: false
      })
      .catch(() => null);

    return {
      code: res && res.status !== 403 && res.status !== 429 ? 'OK' : 'ERR'
    };
  }

  async function checkGemini() {
    const res = await ctx.http
      .get(`https://gemini.google.com/app?_t=${Date.now()}`, {
        timeout: 3000,
        headers: commonHeaders,
        followRedirect: false
      })
      .catch(() => null);

    return {
      code: res && res.status === 200 ? 'OK' : 'ERR'
    };
  }

  const [proxy, youtube, netflix, chatgpt, gemini] = await Promise.all([
    timed(fetchProxy, 2500),
    timed(checkYouTube),
    timed(checkNetflix, 5000),
    timed(checkChatGPT),
    timed(checkGemini)
  ]);

  const resultInfo = (result, name) => {
    const available = result.code !== 'ERR';
    const region = POLICY_REGION[name] || 'XX';

    return {
      available,
      region: available ? region : '--',
      ms: result.ms || 0
    };
  };

  const allServices = [
    {
      name: 'YouTube',
      info: resultInfo(youtube, 'YouTube')
    },
    {
      name: 'Netflix',
      info: resultInfo(netflix, 'Netflix')
    },
    {
      name: 'ChatGPT',
      info: resultInfo(chatgpt, 'ChatGPT')
    },
    {
      name: 'Gemini',
      info: resultInfo(gemini, 'Gemini')
    }
  ];

  const totalCount = allServices.length;
  const okCount = allServices.filter(s => s.info.available).length;
  const lockedCount = totalCount - okCount;

  const proxyRegion = proxy.code === 'OK' ? proxy.cc : 'XX';
  const proxyText = `${getFlagEmoji(proxyRegion)} ${proxyRegion}`;

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

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
        width: 6
      },
      {
        type: 'text',
        text: proxyText,
        font: {
          size: 11,
          weight: 'medium',
          design: 'monospaced'
        },
        textColor: C.dim
      },
      {
        type: 'stack',
        width: 6
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
            }
          ]
        },
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          padding: [0, 0, 4, 0],
          children: [
            {
              type: 'text',
              text: `出口 ${proxyText}`,
              font: {
                size: 10,
                weight: 'medium',
                design: 'monospaced'
              },
              textColor: C.dim
            },
            {
              type: 'spacer'
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
                text: `${getFlagEmoji(item.info.region)} ${item.info.region}`,
                font: {
                  size: 10,
                  weight: 'bold',
                  design: 'monospaced'
                },
                textColor: C.dim
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
      padding: [8, 6, 8, 6],
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
              text: item.info.region,
              font: {
                size: 10,
                weight: 'semibold',
                design: 'monospaced'
              },
              textColor: C.dim
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
          direction: 'row',
          gap: 6,
          flex: 1,
          children: allServices.map(MediumServiceBlock)
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
              text: `${getFlagEmoji(item.info.region)} ${item.info.region}`,
              font: {
                size: 11,
                weight: 'bold',
                design: 'monospaced'
              },
              textColor: C.dim
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

    const rows = [];

    for (let i = 0; i < allServices.length; i += 2) {
      rows.push({
        type: 'stack',
        direction: 'row',
        gap: 10,
        flex: 1,
        children: allServices.slice(i, i + 2).map(LargeServiceBlock)
      });
    }

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
          children: rows
        }
      ]
    };
  };

  if (isSmall) return renderSmall();
  if (isLarge) return renderLarge();

  return renderMedium();
}