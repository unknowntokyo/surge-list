// 1. 静态常量预置 (减少堆栈分配开销)
const IGNORE_RE = /gen_204|complete|ogb|client_204|log|play|searchhistory|favicon|static/;
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
  // 2. 局部变量解构：减少对 $request 对象的高频属性访问
  const { headers: h, url: u, method: m, bodyBytes: bB, body: b } = $request;
  const st = $response?.status || $response?.statusCode;

  // 3. 快速熔断：性能最高优先 (状态码判断比正则快)
  if (st == 200 || h['X-Bypass'] || IGNORE_RE.test(u)) return $.done();

  // 4. 节点筛选：获取策略并锁定 2 个并发 (请求数与成功率的最佳平衡点)
  const ps = (typeof $egern?.allPolicies === 'function' ? $egern.allPolicies() : $egern?.getPolicies?.()) || {};
  const ns = Array.isArray(ps) ? ps : Object.keys(ps);
  const rx = new RegExp($.data('GOOGLE_CAPTCHA_REGEX') || $argument || '');
  const sel = ns.filter(i => i && rx.test(i)).sort(() => Math.random() - 0.5).slice(0, 2);

  if (!sel.length) return $.done();

  // 5. Header 与 Payload 准备：避免在循环内重复操作
  const head = { ...h, 'X-Bypass': '1' };
  delete head['Cookie']; delete head['cookie'];
  head['Cookie'] = `NID=511=${Math.random().toString(36).slice(2, 10)}`;
  const pay = bB || b || undefined;
  const targetUrl = u.replace(/^http:/, 'https:');

  // 6. 并发竞争执行 (Race)
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
        // 关键防护：确保 res 存在且状态为 200
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

  // 7. 总锁回收：防止脚本长驻内存
  s.t = setTimeout(() => $.done(), 7000);
})().catch(() => $.done());
