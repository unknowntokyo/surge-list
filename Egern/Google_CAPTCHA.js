const s = { done: false, t: null };

const $ = {
  data: (k) => $persistentStore.read(k),
  done: (obj) => {
    if (!s.done) {
      s.done = true;
      clearTimeout(s.t);
      $done(obj || {});
    }
  }
};

!(async () => {
  // 1. 拦截预检：200状态或已带 Bypass 标记的请求直接放行
  const h = $request.headers;
  if (($response?.status || $response?.statusCode) == 200 || h['X-Bypass']) return $.done();

  // 2. 节点提取：适配 Egern 策略组 API
  const p = (typeof $egern?.allPolicies === "function" ? $egern.allPolicies() : $egern?.getPolicies?.()) || {};
  const n = Array.isArray(p) ? p : Object.keys(p);
  const r = new RegExp($.data('GOOGLE_CAPTCHA_REGEX') || $argument || '');
  const sel = n.filter(i => i && r.test(i)).sort(() => Math.random() - 0.5).slice(0, 3);
  
  if (!sel.length) return $.done();

  // 3. Header 清洗：移除旧 Cookie 并强制打上 Bypass 标记隔离递归
  const head = { ...h, 'X-Bypass': '1' };
  for (let k in head) if (k.toLowerCase() === 'cookie') delete head[k];
  head['Cookie'] = `NID=511=${Math.random().toString(36).slice(2, 12)}`;

  // 4. 并发竞争 (Race)：一次性发出 3 个，谁先成功用谁
  const m = ($request.method || 'GET').toLowerCase();
  sel.forEach(node => {
    let active = true;
    const tid = setTimeout(() => { active = false }, 3500); // 单路超时锁

    $httpClient[m]({
      url: $request.url.replace(/^http:/, "https:"),
      headers: head, 
      body: $request.bodyBytes || $request.body || undefined,
      policy: node, 
      opts: { policy: node }
    }, (err, res, body) => {
      clearTimeout(tid);
      // 只有在节点未超时且全局锁未开启时，才尝试访问 res 属性
      if (active && !s.done && !err && res && (res.status || res.statusCode) == 200) {
        $.done({ 
          status: 200, 
          headers: res.headers, 
          body: body, 
          bodyBytes: res.bodyBytes 
        });
      }
    });
  });

  // 5. 10秒脚本生存总阈值：兜底回收，防止引擎挂起
  s.t = setTimeout(() => $.done(), 10000);

})().catch(() => $.done());