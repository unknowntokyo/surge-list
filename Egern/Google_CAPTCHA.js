const $ = {
  data: (k) => $persistentStore.read(k),
  done: (obj) => {
    if (!globalThis.isDone) {
      globalThis.isDone = true;
      $done(obj || {});
    }
  }
};

globalThis.isDone = false;

!(async () => {
  // 1. 拦截预检：200状态或标记请求直接跳过
  if (($response?.status || $response?.statusCode) == 200 || $request.headers['X-Bypass']) return $.done();

  // 2. 节点获取：适配 Egern 数组/对象两种可能的返回格式
  let nodes = [];
  try {
    const p = typeof $egern?.allPolicies === "function" ? $egern.allPolicies() : ($egern?.getPolicies?.() || {});
    nodes = Array.isArray(p) ? p : Object.keys(p);
  } catch (e) {
    const p = await new Promise(r => $httpAPI("GET", "v1/policies", null, r)).catch(() => ({}));
    nodes = [...(p.proxies || []), ...(p['policy-groups'] || [])];
  }

  const regex = new RegExp($.data('GOOGLE_CAPTCHA_REGEX') || $argument || '');
  const selected = nodes.filter(n => n && regex.test(n)).sort(() => Math.random() - 0.5).slice(0, 15);
  if (!selected.length) return $.done();

  // 3. 构造请求：强制 HTTPS 并移除 Cookie
  const headers = { ...$request.headers, 'X-Bypass': '1', 'Cache-Control': 'no-cache' };
  for (let k in headers) if (k.toLowerCase() === 'cookie') delete headers[k];
  headers['Cookie'] = `NID=511=${Math.random().toString(36).substring(2, 12)}`;

  let index = 0;

  // 4. 并发 Worker：在 globalThis.isDone 为 true 时立即停止所有新请求
  const worker = async () => {
    while (index < selected.length && !globalThis.isDone) {
      const node = selected[index++];
      let tid;
      try {
        const res = await Promise.race([
          new Promise((r, j) => {
            $httpClient[$request.method.toLowerCase()]({
              url: $request.url.replace(/^http:/, "https:"),
              headers, body: $request.body, bodyBytes: $request.bodyBytes,
              policy: node, opts: { policy: node }
            }, (e, rs, b) => e ? j(e) : r(rs))
          }),
          new Promise((_, j) => tid = setTimeout(() => j('timeout'), 3000))
        ]);
        clearTimeout(tid);
        if ((res?.status || res?.statusCode) == 200) return $.done({ 
          status: 200, headers: res.headers, body: res.body, bodyBytes: res.bodyBytes 
        });
      } catch (e) {
        clearTimeout(tid);
      }
    }
  };

  // 5. 启动 3 路并发并设置总安全退出
  for (let i = 0; i < Math.min(3, selected.length); i++) worker();
  setTimeout(() => $.done(), 10000);

})().catch(() => $.done());