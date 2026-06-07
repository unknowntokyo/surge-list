// 使用延迟加载（Lazy Loading）和更高效的 Map 结构，降低沙箱启动开销
let cachedCityMap = null;
function getCityMap() {
  if (!cachedCityMap) {
    cachedCityMap = new Map([ /* 百行映射数据平铺 */ ]);
  }
  return cachedCityMap;
}

export default async function(ctx) {
  // 1. 架构级防御：对可能为流对象的响应体做幂等和流状态检查
  const obtainIpInfo = async () => {
    if (!ctx.response?.json) return {};
    try {
      // 若底层实现符合标准 Fetch，通过尝试 clone 保护原始流不被破坏
      const respClone = typeof ctx.response.clone === 'function' ? ctx.response.clone() : ctx.response;
      const data = typeof respClone.json === 'function' ? await respClone.json() : respClone.json;
      
      if (data?.city) {
        data.city_name_zh = getCityMap().get(data.city.toLowerCase().trim()) || data.city;
      }
      return data;
    } catch (streamError) {
      // 结构化日志观测
      ctx.log?.(`[Context Lookup Failed]: ${streamError.message}`);
      return {};
    }
  };

  // 2. 纯函数设计：通过显式 Promise 返回值消除闭包状态突变（Side Effects）
  const executeSpeedTest = async () => {
    try {
      const startTime = performance.now();
      const resp = await ctx.http.get(SPEED_TEST_URL, {
        headers: { 'Cache-Control': 'no-cache' },
        timeout: 4000 // 严格控制底层套接字生存周期
      });

      if (resp?.status === 200) {
        const duration = Math.max((performance.now() - startTime) / 1000, 0.001);
        return `${((BYTES * 8) / (duration * 1_000_000)).toFixed(1)} Mbps`;
      }
    } catch (networkError) {
      ctx.log?.(`[Speed Test Transport Error]: ${networkError.message}`);
    }
    return '⚠️ 测速失败';
  };

  // 3. 管道化并发：解耦轻重任务，彻底消除线头阻塞，保障时延敏感型数据的吞吐
  // 注：若在 Panel 面板等容忍时延场景下，依然可用解构接收；若在 Rewrite 拓扑下，测速应当改异步彻底脱离主请求生命周期。
  const [ipInfo, speedMbps] = await Promise.all([
    obtainIpInfo(),
    executeSpeedTest()
  ]);

  // 4. 数据实体组装（保持上层纯净）
  return {
    body: {
      'IP地址': ipInfo.ip || ipInfo.query || '未知',
      '地区': codeMap[ipInfo.country_code] || '未知',
      ...(ipInfo.city ? { '城市': ipInfo.city_name_zh } : {}),
      '互联网服务提供商': ipInfo.asn ? `AS${ipInfo.asn}` : '未知',
      '下载带宽': speedMbps
    }
  };
}
