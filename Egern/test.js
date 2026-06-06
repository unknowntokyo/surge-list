// IP_Check.js - Egern 官方API 精准优化版
// 1. 修复 getSpeed 空置 setTimeout 导致的超时失效与内存泄露
// 2. 修复 getIPInfo 无法正确捕获公网 IP 的逻辑断层
// 3. 彻底移除未使用的 getCachedTranslation 僵尸代码

// ============ 1. 性能常量定义 ============
const TIMEOUT = 4000;          // 4秒超时限制
const BYTES = 1 * 1024 * 1024; // 测速包降至 1MB，兼顾准确度与加载速度
const SPEED_TEST_URL = `https://speed.cloudflare.com/__down?bytes=${BYTES}`;

const LABELS = Object.freeze({
  IP: '📍IP地址',
  REGION: '🌍地区',
  ISP: '🔗ISP',
  SPEED: '⚡速度',
  CLIENT: '💻客户端'
});

// 常用国家/地区映射
const codeMapData = new Map([
  ['HK', '🇭🇰 香港'], ['TW', '🇹🇼 台湾'], ['US', '🇺🇸 美国'], 
  ['JP', '🇯🇵 日本'], ['SG', '🇸🇬 新加坡'], ['CN', '🇨🇳 中国']
]);

// ============ 2. 核心逻辑函数 ============

/**
 * 优化点 2：修复 IP 获取。同时支持 Egern 本地解析与外部 API 兜底
 */
function getIPInfo(ctx) {
  // 如果 ctx.request.ip 拿到的是目标网站 IP，此处先置为 null，后续靠 Response 修正
  const targetIp = ctx.request?.ip === '0.0.0.0' ? null : ctx.request?.ip;
  const lookup = targetIp ? ctx.lookupIP(targetIp) : null;
  
  return {
    ip: targetIp,
    country: lookup?.country || 'UN',
    asn: lookup?.asn || null,
    organization: lookup?.organization || 'Unknown'
  };
}

/**
 * 优化点 1：移除错误的 setTimeout 异步地狱，纯粹依赖底层 timeout 属性
 */
async function getSpeed(ctx) {
  try {
    const startTime = performance.now();
    // 依靠 Egern 原生 http.get 的 timeout 控制
    const resp = await ctx.http.get(SPEED_TEST_URL, {
      headers: { 'Cache-Control': 'no-cache' },
      timeout: TIMEOUT
    });

    if (resp?.status === 200) {
      const duration = Math.max((performance.now() - startTime) / 1000, 0.01);
      const mbps = ((BYTES * 8) / (duration * 1_000_000)).toFixed(1);
      return `${mbps} Mbps`;
    }
  } catch (error) {
    console.error('[SPEED_ERROR]', error?.message);
  }
  return '⚠ 测速超时';
}

/**
 * 组装美化响应体
 */
function buildResponse(ipInfo, speedMbps, ua) {
  const clientName = ua ? String(ua).replace(/^egern/i, 'Egern') : 'Egern';
  
  return {
    [LABELS.IP]: ipInfo.ip || '未知',
    [LABELS.REGION]: codeMapData.get(ipInfo.country) || ipInfo.country || '未知',
    [LABELS.SPEED]: speedMbps,
    [LABELS.CLIENT]: clientName,
    [LABELS.ISP]: ipInfo.asn ? `AS${ipInfo.asn} ${ipInfo.organization}`.trim() : '未知'
  };
}

// ============ 3. 主入口流量调度 ============
export default async function(ctx) {
  // 兼容不同的 Headers 读取方式（防止 .get() 报错崩溃）
  const headers = ctx.request?.headers || {};
  const ua = headers['User-Agent'] || headers['user-agent'] || (typeof headers.get === 'function' ? headers.get('User-Agent') : '');

  try {
    const ipInfo = getIPInfo(ctx);
    
    // 优化点 2 延续：如果是 Response 阶段，从第三方 API 的返回体中精准纠正公网 IP
    if (ctx.response?.json) {
      try {
        const origData = typeof ctx.response.json === 'function' ? await ctx.response.json() : ctx.response.json;
        if (origData) {
          // 捕获真正的节点公网 IP
          if (origData.ip || origData.query) {
            ipInfo.ip = origData.ip || origData.query;
          }
          // 如果本地 lookup 没查到，用 API 返回的外部国家代码兜底
          if (ipInfo.country === 'UN' && (origData.country_code || origData.country)) {
            ipInfo.country = origData.country_code || origData.country;
          }
        }
      } catch (e) {
        // 规避 JSON 解析失败阻断主线程
      }
    }

    // 并行执行测速
    const speedMbps = await getSpeed(ctx);

    return { 
      body: buildResponse(ipInfo, speedMbps, ua) 
    };
  } catch (error) {
    return {
      body: {
        [LABELS.IP]: '未知',
        [LABELS.REGION]: '未知',
        [LABELS.SPEED]: '⚠ 脚本错误',
        [LABELS.CLIENT]: 'Egern',
        [LABELS.ISP]: '未知'
      }
    };
  }
}
