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
  const { headers: h, url: u, method: m } = $request;
  const st = $response?.status || $response?.statusCode;

  // 1. 极致静默拦截：匹配所有干扰项
  const isNoise = /gen_204|complete|xjs|client_204|log|play|searchhistory|favicon|static|collect|analytics|compress/.test(u);

  // 2. 核心逻辑：如果是干扰项且返回 429，直接伪造 200 响应还给浏览器，彻底阻止其重试
  if (isNoise) {
    return $.done({ status: 200, headers: { 'Content-Type': 'text/plain' }, body: '' });
  }

  // 3. 正常放行：已经是 200 或者带 Bypass 标记的正常搜索请求
  if (st == 200 || h['X-Bypass']) return $.done();

  // 4. 节点筛选：仅针对真正的搜索请求开启 2 路并发
  const ps = (typeof $egern?.allPolicies === 'function' ? $egern.allPolicies() : $egern?.getPolicies?.()) || {};
  const ns = Array.isArray(ps) ? ps : Object.keys(ps);
  const rx = new RegExp($.data('GOOGLE_CAPTCHA_REGEX') || $argument || '');
  const sel = ns.filter(i => i && rx.test(i)).sort(() => Math.random() - 0.5).slice(0, 2);

  if (!sel.length) return $.done();

  // 5. 变量准备
  const head = { ...h, 'X-Bypass': '1' };
  delete head['Cookie']; delete head['cookie'];
  head['Cookie'] = `NID=511=${Math.random().toString(36).slice(2, 10)}`;
  const pay = $request.bodyBytes || $request.body || undefined;
  const targetUrl = u.replace(/^http:/, 'https:');

  // 6. 并发竞争
  sel.forEach(node => {
    let active = true;
    const tid = setTimeout(() => { active = false }, 3500); 

    $httpClient[m.toLowerCase()]({
      url: targetUrl,
      headers: head,
      body: pay,
      policy: node, 
      opts: { policy: node }
    }, (err, res, data) => {
      if (active && !s.done) {
        clearTimeout(tid);
        if (!err && res && (res.status || res.statusCode) == 200) {
          $.done({
            status: 200,
            headers: res.headers,
            body: data,
            bodyBytes: res.bodyBytes
          });
        }
      }
    });
  });

  // 7. 总锁
  s.t = setTimeout(() => $.done(), 8000);
})().catch(() => $.done());
