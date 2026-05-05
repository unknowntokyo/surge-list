/*
作者：@xream @keywos @wuhu_zzz @ TEXAS @整点猫咪 技术指导：整点薯条 
*/

const $ = new Env('network-speed');

let arg;
if (typeof $argument != 'undefined') {
  arg = Object.fromEntries($argument.split('&').map(item => item.split('=')));
}

let title = '';
let content = '';
let icon, color;

!(async () => {
  try {
    const mb = $.lodash_get(arg, 'mb') || 3;
    const bytes = mb * 1024 * 1024;

    const pingstart = Date.now();
    const ping = await $.http.get({ url: `http://cp.cloudflare.com/generate_204` });
    if (ping.status !== 204 && ping.status !== 200) throw new Error('Ping失败');
    const pingt = Date.now() - pingstart;

    const start = Date.now();
    const res = await $.http.get({ url: `https://speed.cloudflare.com/__down?bytes=${bytes}` });
    if (res.status !== 200) throw new Error(`下载失败:${res.status}`);
    
    const duration = Math.max((Date.now() - start) / 1000, 0.001);
    const speed = mb / duration;
    const speedMbpsInt = Math.round(speed * 8);
    const a = Diydecide(0, 80, 120, speedMbpsInt);
    const b = Diydecide(0, 150, 300, pingt) + 3;

    let shifts = {
      '1': arg?.iconslow,
      '2': arg?.iconmid,
      '3': arg?.iconfast,
      '4': arg?.colorlow,
      '5': arg?.colormid,
      '6': arg?.colorhigh
    };

    icon = shifts[a];
    color = shifts[b];

    title = `NetSpeed`;
    content = `下行速率: ${speedMbpsInt} Mbps [${speed.toFixed(1)} MB/s]\n测试耗时: ${duration.toFixed(2)}s\n网络延迟: ${pingt} ms`;

  } catch (e) {
    $.logErr(e);
    title = `❌`;
    content = e.message || '测速异常';
  } finally {

    const result = { 
      ...arg, 
      title: arg?.title || title,
      content, 
      icon: icon || arg?.icon, 
      'icon-color': color || arg?.['icon-color'] 
    };
    $.done(result);
  }
})();

function Diydecide(x, y, z, item) {
  let array = [x, y, z];
  array.push(item);
  return array.sort((a, b) => a - b).findIndex(i => i === item);
}

function Env(t) {
  this.name = t;
  this.logErr = (e) => console.log(`[${this.name}] ${e}`);
  this.lodash_get = (t, s, e) => {
    const i = s.replace(/\[(\d+)\]/g, ".$1").split(".");
    let r = t;
    for (const t of i) if (r = Object(r)[t], void 0 === r) return e;
    return r;
  };
  this.http = {
    get: (opt) => new Promise((res, rej) => {
      $httpClient.get(opt, (err, resp, data) => (err ? rej(err) : res(resp)));
    })
  };
  this.done = (obj) => $done(obj);
}