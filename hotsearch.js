const PLATFORM = "douyin";
const COUNT = 5;
const URL = `https://api.zxki.cn/api/jhrs?type=${PLATFORM}`;

$httpClient.get(URL, (error, response, data) => {
  const json = JSON.parse(data);
  const list = (Array.isArray(json) ? json : (json.data || json.list)).slice(0, COUNT);
  
  const content = list.map((item, i) => {
    return `${i + 1}. ${item.title || item.keyword} (${item.hot || "火"})`;
  }).join('\n');

  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });

  $done({
    title: `${"抖音热搜"}`,
    content: content,
    icon: "flame.fill",
    "icon-color": "#FF3B30"
  });
});