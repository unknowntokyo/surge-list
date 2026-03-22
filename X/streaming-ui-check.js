// 常量定义
const BASE_URL = 'https://www.netflix.com/title/';
const BASE_URL_YTB = "https://www.youtube.com/premium";
const FILM_ID = 81280792;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const ARROW = " ➟ ";

// 国家代码映射
const CountryCode = {
  HK: "HKG", JP: "JPN", KR: "KOR", SG: "SGP",
  TW: "TPE", US: "USA", NL: "NED", DE: "GER"
};

// 结果存储
const result = {
  title: '        流媒体服务查询',
  Netflix: '<b>Netflix: </b>检测失败, 请重试 ❗️',
  YouTube: '<b>YouTube: </b>检测失败, 请重试 ❗️',
  netflixText: 'Netflix: 检测失败, 请重试 ❗️',
  youtubeText: 'YouTube Premium: 检测失败, 请重试 ❗️'
};

// 构建最终 HTML 内容
function buildHtml(netflixMsg, youtubeMsg, nodeName) {
  const items = [netflixMsg, youtubeMsg].join("</br></br>");
  const content = `-------------------------------------</br>${items}</br>-------------------------------------</br><font color=#007AFF><b>节点</b> ➟ ${nodeName}</font>`;
  return `<p style="text-align: center; font-family: -apple-system; font-size: large; font-weight: thin">${content}</p>`;
}

// Netflix 检测
function testNf(filmId) {
  return new Promise(resolve => {
    const option = {
      url: BASE_URL + filmId,
      opts: { policy: $environment.params },
      timeout: 4000,
      headers: { 'User-Agent': UA }
    };
    $task.fetch(option).then(
      response => {
        const status = response.statusCode;
        if (status === 404) {
          result.Netflix = "<b>Netflix: </b>支持自制剧集 ⚠️";
          result.netflixText = "Netflix: 支持自制剧集 ⚠️";
        } else if (status === 403) {
          result.Netflix = "<b>Netflix: </b>未支持 🚫";
          result.netflixText = "Netflix: 未支持 🚫";
        } else if (status === 200) {
          let region = 'us';
          const originUrl = response.headers['X-Originating-URL'] || '';
          if (originUrl) {
            const parts = originUrl.split('/');
            if (parts.length > 3) {
              region = parts[3].split('-')[0];
              if (region === 'title') region = 'us';
            }
          }
          const regionCode = CountryCode[region.toUpperCase()] || region.toUpperCase();
          result.Netflix = `<b>Netflix: </b>完整支持${ARROW}${regionCode}`;
          result.netflixText = `Netflix: 完整支持${ARROW}${regionCode}`;
        } else {
          result.Netflix = "<b>Netflix: </b>检测失败 ❗️";
          result.netflixText = "Netflix: 检测失败 ❗️";
        }
        resolve("done");
      },
      () => {
        result.Netflix = "<b>Netflix: </b>检测超时 🚦";
        result.netflixText = "Netflix: 检测超时 🚦";
        resolve("timeout");
      }
    );
  });
}

// YouTube Premium 检测
function testYTB() {
  return new Promise(resolve => {
    const option = {
      url: BASE_URL_YTB,
      opts: { policy: $environment.params },
      timeout: 4000,
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'en-US,en;q=0.9'
      }
    };
    $task.fetch(option).then(
      response => {
        const status = response.statusCode;
        if (status !== 200) {
          result.YouTube = "<b>YouTube Premium: </b>检测失败 ❗️";
          result.youtubeText = "YouTube Premium: 检测失败 ❗️";
          resolve("error");
          return;
        }
        const data = response.body;
        if (data.includes('Premium is not available in your country')) {
          result.YouTube = "<b>YouTube Premium: </b>未支持 🚫";
          result.youtubeText = "YouTube Premium: 未支持 🚫";
          resolve("not available");
          return;
        }
        let region = 'US';
        const match = data.match(/"GL":"(.*?)"/);
        if (match && match[1]) {
          region = match[1];
        } else if (data.includes('www.google.cn')) {
          region = 'CN';
        }
        const regionCode = CountryCode[region.toUpperCase()] || region.toUpperCase();
        result.YouTube = `<b>YouTube Premium: </b>支持 ${ARROW}${regionCode}`;
        result.youtubeText = `YouTube Premium: 支持 ${ARROW}${regionCode}`;
        resolve(region);
      },
      () => {
        result.YouTube = "<b>YouTube Premium: </b>检测超时 🚦";
        result.youtubeText = "YouTube Premium: 检测超时 🚦";
        resolve("timeout");
      }
    );
  });
}

// 主流程
(async () => {
  // 并行检测
  await Promise.all([testNf(FILM_ID), testYTB()]);

  // 获取策略组状态
  const message = { action: "get_policy_state", content: $environment.params };
  $configuration.sendMessage(message).then(
    resolve => {
      if (resolve.error) {
        console.log(resolve.error);
        $done();
        return;
      }

      let isGroup = false;
      let groupName = '';
      let actualNode = '';

      // 判断是策略组还是单节点
      if (resolve.ret && resolve.ret[message.content] && Array.isArray(resolve.ret[message.content])) {
        const nodeList = resolve.ret[message.content];
        if (nodeList.length > 1) {
          isGroup = true;
          groupName = message.content;
          actualNode = nodeList[0];   // 取第一个节点作为代表
        } else if (nodeList.length === 1) {
          // 仅有一个节点，按单节点处理
          actualNode = nodeList[0];
        } else {
          actualNode = $environment.params;
        }
      } else {
        actualNode = $environment.params;
      }

      // 构建控制台输出
      if (isGroup) {
        //（含策略组）多节点样式
        console.log(`策略组: ${groupName}`);
        console.log(`${result.netflixText} (节点: ${actualNode})`);
        console.log(`${result.youtubeText} (节点: ${actualNode})`);
      } else {
        // 单节点样式
        console.log(`单节点: ${actualNode}`);
        console.log(result.netflixText);
        console.log(result.youtubeText);
      }

      // 用于弹窗的节点名
      let nodeName = $environment.params;
      if (resolve.ret && resolve.ret[message.content]) {
        nodeName = resolve.ret[message.content].join(" ➟ ");
      }

      const html = buildHtml(result.Netflix, result.YouTube, nodeName);
      $done({ title: result.title, htmlMessage: html });
    },
    () => $done()
  );
})();
