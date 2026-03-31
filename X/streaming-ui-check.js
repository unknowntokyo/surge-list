// 常量定义
const BASE_URL = 'https://www.netflix.com/title/';
const BASE_URL_YTB = "https://www.youtube.com/premium";
const FILM_ID = 81280792;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const ARROW = " ➟ ";

// 国家代码映射
const CountryCode = {
  HK: "HKG", JP: "JPN", KR: "KOR", SG: "SGP", TW: "TPE",
  US: "USA", NL: "NED", DE: "GER"
};

// 结果存储
const result = {
  title: '               流媒体服务查询',
  YouTube: '<strong>YouTube: </strong>检测失败 ❗️',
  Netflix: '<strong>Netflix: </strong>检测失败 ❗️'
};

// 常用字符串常量
const NETFLIX_PREFIX = '<strong>Netflix: </strong>';
const YT_PREFIX = '<strong>YouTube Premium: </strong>';
const SEP = "<br><br>";
const SEP_LINE = "-------------------------------------<br>";

// 构建最终 HTML 内容
function buildHtml(netflixMsg, youtubeMsg, nodeName) {
  const items = [netflixMsg, youtubeMsg].join(SEP);
  const content = [
    SEP_LINE,
    items,
    SEP_LINE,
    `<font color=#007AFF><strong>节点</strong> ➟ ${nodeName}</font>`
  ].join("<br>");
  return `<p style="text-align: center; font-family: -apple-system; font-size: large; font-weight: thin">${content}</p>`;
}

// Netflix 检测
function testNf(filmId) {
  return new Promise(resolve => {
    const option = {
      url: BASE_URL + filmId,
      policy: $environment.params,
      timeout: 4000,
      headers: { 'User-Agent': UA }
    };
    $task.fetch(option).then(response => {
      const status = response.statusCode;
      if (status === 404) {
        result.Netflix = NETFLIX_PREFIX + "支持自制剧集 ⚠️";
        console.log("Netflix: 支持自制剧集 ⚠️");
        resolve();
        return;
      }
      if (status === 403) {
        result.Netflix = NETFLIX_PREFIX + "未支持 🚫";
        console.log("Netflix: 未支持 🚫");
        resolve();
        return;
      }
      if (status === 200) {
        let region = 'us';
        const originUrl = response.headers['X-Originating-URL'];
        if (originUrl) {
          const parts = originUrl.split('/');
          if (parts.length > 3) {
            region = parts[3].split('-')[0];
            if (region === 'title') region = 'us';
          }
        }
        const regionUpper = region.toUpperCase();
        const regionCode = CountryCode[regionUpper] || regionUpper;
        result.Netflix = NETFLIX_PREFIX + `完整支持${ARROW}${regionCode}`;
        console.log(`Netflix: 完整支持${ARROW}${regionCode}`);
      } else {
        result.Netflix = NETFLIX_PREFIX + "检测失败 ❗️";
        console.log("Netflix: 检测失败 ❗️");
      }
      resolve();
    }, () => {
      result.Netflix = NETFLIX_PREFIX + "检测超时 🚦";
      console.log("Netflix: 检测超时 🚦");
      resolve();
    });
  });
}

// YouTube Premium 检测
function testYTB() {
  return new Promise(resolve => {
    const option = {
      url: BASE_URL_YTB,
      policy: $environment.params,
      timeout: 4000,
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'en-US,en;q=0.9'
      }
    };
    $task.fetch(option).then(response => {
      const status = response.statusCode;
      if (status !== 200) {
        result.YouTube = YT_PREFIX + "检测失败 ❗️";
        console.log("YouTube Premium: 检测失败 ❗️");
        resolve();
        return;
      }

      const data = response.body;
      if (data.includes('Premium is not available in your country')) {
        result.YouTube = YT_PREFIX + "未支持 🚫";
        console.log("YouTube Premium: 未支持 🚫");
        resolve();
        return;
      }

      const match = data.match(/("GL":"(.*?)")|www\.google\.cn/);
      let region = 'US';
      if (match) {
        if (match[2]) region = match[2];
        else if (match[0].includes('google.cn')) region = 'CN';
      }
      const regionUpper = region.toUpperCase();
      const regionCode = CountryCode[regionUpper] || regionUpper;
      result.YouTube = YT_PREFIX + `支持${ARROW}${regionCode}`;
      console.log(`YouTube Premium: 支持${ARROW}${regionCode}`);
      resolve();
    }, () => {
      result.YouTube = YT_PREFIX + "检测超时 🚦";
      console.log("YouTube Premium: 检测超时 🚦");
      resolve();
    });
  });
}

// 主流程
(async () => {
  let finished = false;
  const TIMEOUT_MS = 6000;

  // 超时定时器：如果脚本未在超时前完成，强制输出结果
  const timeoutId = setTimeout(() => {
    if (finished) return;
    finished = true;
    console.log("脚本执行超时，强制输出当前结果");
    // 使用当前已有结果
    const html = buildHtml(result.Netflix, result.YouTube, $environment.params);
    $done({ title: result.title, htmlMessage: html });
  }, TIMEOUT_MS);

  // 等待两个检测完成
  await Promise.all([testNf(FILM_ID), testYTB()]);

  // 检测完成后，清除超时定时器
  clearTimeout(timeoutId);
  if (finished) return; // 如果超时已触发，不再执行后续

  // 获取策略组状态
  const message = {
    action: "get_policy_state",
    content: $environment.params
  };
  const finalHtml = (nodeName) => buildHtml(result.Netflix, result.YouTube, nodeName);

  $configuration.sendMessage(message).then(res => {
    if (finished) return;
    finished = true;
    let nodeName = $environment.params;
    if (res && !res.error && res.ret && res.ret[message.content]) {
      nodeName = res.ret[message.content].join(" ➟ ");
    }
    $done({ title: result.title, htmlMessage: finalHtml(nodeName) });
  }).catch(() => {
    if (finished) return;
    finished = true;
    $done({ title: result.title, htmlMessage: finalHtml($environment.params) });
  });
})();
