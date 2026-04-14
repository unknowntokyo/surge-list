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

  // 1. 极致拦截 (核心优化)：
  // 只要 URL 包含这些关键词，或者是 200 状态，或者是已经重试过的请求，全部一秒都不耽误，立刻退出。
  const isNoise = /gen_204|complete|xjs|client_204|log|play|searchhistory|favicon|static|collect|analytics/.test(u);
  if (st == 200 || h['X-Bypass'] || isNoise) return $.done();

  // 2. 策略筛选：仅取 2 个节点并发，极致平衡成功率与请求数
  const ps = (typeof $egern?.allPolicies === 'function' ? $egern.allPolicies() : $egern?.getPolicies?.()) || {};
  const ns = Array.isArray(ps) ? ps : Object.keys(ps);
  const rx = new RegExp($.data('GOOGLE_CAPTCHA_REGEX') || $argument || '');
  const sel = ns.filter(i => i && rx.test(i)).sort(() => Math.random() - 0.5).slice(0, 2);

  if (!sel.length) return $.done();

  // 3. 构造 Header 与变量预处理 (减少循环内计算)
  const head = { ...h, 'X-Bypass': '1' };
  delete head['Cookie']; delete head['cookie'];
  head['Cookie'] = `NID=511=${Math.random().toString(36).slice(2, 10)}`;
  const pay = $request.bodyBytes || $request.body || undefined;
  const targetUrl = u.replace(/^http:/, 'https:');

  // 4. 并发竞争执行
  sel.forEach(node => {
    let active = true;
    const tid = setTimeout(() => { active = false }, 3000); 

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

  // 5. 生存期总锁
  s.t = setTimeout(() => $.done(), 7000);
})().catch(() => $.done());
