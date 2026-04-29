const PLATFORM = "douyin";
const COUNT = 5;
const URL = `https://api.zxki.cn/api/jhrs?type=${PLATFORM}`;

$httpClient.get(URL, (error, response, data) => {
  const json = JSON.parse(data);
  const list = (Array.isArray(json) ? json : (json.data || json.list)).slice(0, COUNT);
  
  const content = list.map((item, i) => {
    return `${item.title || item.keyword}`;
  }).join('\n');

  $done({
    title: `抖音热榜`,
    content: content,
    icon: "flame",
    "icon-color": "#FF3B30"
  });
});