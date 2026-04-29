/**
 * 极简硬核版 - Surge 热搜面板
 * 逻辑：直接执行，异常即崩溃
 */

const params = Object.fromEntries(
  ($argument || "").split("&").map(i => i.split("=").map(s => decodeURIComponent(s.trim())))
);

const PLATFORM = params.platform || "weibo";
const COUNT = parseInt(params.count) || 8;
const URL = `https://api.zxki.cn/api/jhrs?type=${PLATFORM}`;

$httpClient.get(URL, (error, response, data) => {
  // 不处理 error，直接解析
  const json = JSON.parse(data);
  const list = (Array.isArray(json) ? json : (json.data || json.list)).slice(0, COUNT);
  
  const content = list.map((item, i) => {
    return `${i + 1}. ${item.title || item.keyword} (${item.hot || "火"})`;
  }).join('\n');

  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });

  $done({
    title: `${params.title || "热搜"} (${time})`,
    content: content,
    icon: "flame.fill",
    "icon-color": "#FF3B30"
  });
});
