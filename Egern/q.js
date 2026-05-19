async function fetchInfo(ctx, slot, currentTimestamp) {
  const cacheKey = `sub_cache_${slot.url}`;
  let cacheData = null;

  // 使用绝对安全的 try...catch 块包裹，完全无视宿主环境 Promise 的残缺问题
  try {
    const cache = await ctx.storage.get(cacheKey);
    if (cache) {
      const parsed = JSON.parse(cache);
      if (currentTimestamp - parsed.time < CACHE_TIME) {
        return { ...parsed.data, name: slot.name, remainDays: slot.resetDay ? getRemainingDays(slot.resetDay, currentTimestamp) : null };
      }
      cacheData = parsed.data;
    }
  } catch (_) {
    // 即使底层 storage.get 报错，也能安全降级
  }

  try {
    const resp = await ctx.http.get(slot.url, { headers: { "User-Agent": "clash-verge-rev/2.3.1" }, timeout: 4 });
    const raw = resp.headers.get("subscription-userinfo") || resp.headers.get("Subscription-UserInfo") || "";
    
    const obj = { upload: 0, download: 0, total: 0, expire: 0 };
    let hasTotal = false;
    
    const pairs = raw.split(/[;&]/);
    for (let i = 0; i < pairs.length; i++) {
      const eqIdx = pairs[i].indexOf('=');
      if (eqIdx === -1) continue;
      const key = pairs[i].substring(0, eqIdx).trim().toLowerCase();
      if (key in obj) {
        obj[key] = parseFloat(pairs[i].substring(eqIdx + 1));
        if (key === 'total') hasTotal = true;
      }
    }

    if (hasTotal) {
      const used = obj.upload + obj.download;
      const result = { error: null, used, totalBytes: obj.total, percent: obj.total > 0 ? (used / obj.total) * 100 : 0, expire: obj.expire || null, remainDays: slot.resetDay ? getRemainingDays(slot.resetDay, currentTimestamp) : null };
      
      // 写入缓存也用 try...catch 保护，防止 ctx.storage.set 同样缺少 catch 方法
      try {
        await ctx.storage.set(cacheKey, JSON.stringify({ time: currentTimestamp, data: result }));
      } catch (_) {}
      
      return { ...result, name: slot.name };
    }
  } catch (_) {}

  if (cacheData) return { ...cacheData, name: slot.name };
  return { name: slot.name, error: true };
}