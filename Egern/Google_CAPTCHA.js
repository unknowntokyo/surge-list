const s = { done: false, t: null };
const $ = {
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

  // 1. 白名单逻辑：只有 URL 包含 "search?" 或者是主域名的主请求，才进入重试
  // 排除掉所有包含 gen_204, complete, xjs, client, log, static, icon 的杂碎
  const isCoreSearch = u.includes('google.com/search?') || (u.includes('google.com/') && u.length < 30);
  const isNoise = /gen_204|complete|xjs|client|log|static|favicon|preview|collect|analytics/.test(u);

  // 2. 核心拦截：如果是杂碎请求且状态不是 200，直接"喂"一个假的 200 给浏览器，物理闭嘴
  if (!isCoreSearch || isNoise) {
    if (st != 200) {
      return $.done({ status: 200, headers: { 'Content-Type': 'text/plain' }, body: '' });
    }
    return $.done(); // 已是 200 的直接放行，不处理
  }

  // 3. 正常拦截：主搜索请求已经是 200 或带有重试标记的直接放行
  if (st == 200 || h['X-Bypass']) return $.done();

  // 4. 节点筛选：仅针对"主搜索"开启 2 路并发
  const ps = (typeof $egern?.allPolicies === 'function' ? $egern.allPolicies() : $egern?.getPolicies?.()) || {};
  const ns = Array.isArray(ps) ? ps : Object.keys(ps);
  const rx = new RegExp($persistentStore.read('GOOGLE_CAPTCHA_REGEX') || $argument || '');
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
      url: targetUrl, headers: head, body: pay, policy: node, opts: { policy: node }
    }, (err, res, data) => {
      if (active && !s.done && !err && res && (res.status || res.statusCode) == 200) {
        $.done({ status: 200, headers: res.headers, body: data, bodyBytes: res.bodyBytes });
      }
    });
  });

  // 7. 总锁
  s.t = setTimeout(() => $.done(), 8000);
})().catch(() => $.done());
