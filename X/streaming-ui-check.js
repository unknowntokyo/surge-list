// ==================== 常量定义 ====================
const BASE_URL = 'https://www.netflix.com/title/';
const BASE_URL_YTB = "https://www.youtube.com/premium";
const FILM_ID = 81280792;

// 国家代码映射
const CountryCode = new Map([
  ["HK", "HKG"], ["JP", "JPN"], ["KR", "KOR"],
  ["SG", "SGP"], ["TW", "TPE"], ["US", "USA"]
]);

// 请求选项（共享）
const opts = { policy: $environment.params };
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36';

// 结果存储
let result = {
  title: '        流媒体服务查询',
  YouTube: '<b>YouTube:  </b>检测失败, 请重试 ❗️',
  Netflix: '<b>Netflix:  </b>检测失败, 请重试 ❗️'
};

const arrow = " ➟ ";

// ==================== 辅助函数 ====================
// 构建最终 HTML 内容（避免重复代码）
function buildHtml(netflixMsg, youtubeMsg, nodeName) {
  const items = [netflixMsg, youtubeMsg].join("</br></br>");
  const content = `-------------------------------------</br>${items}</br>-------------------------------------</br><font color=#007AFF><b>节点</b> ➟ ${nodeName}</font>`;
  return `<p style="text-align: center; font-family: -apple-system; font-size: large; font-weight: thin">${content}</p>`;
}

// ==================== 检测 Netflix ====================
function testNf(filmId) {
  return new Promise(resolve => {
    const option = {
      url: BASE_URL + filmId,
      opts: opts,
      timeout: 2800,
      headers: { 'User-Agent': UA }
    };
    $task.fetch(option).then(
      response => {
        console.log("nf:" + response.statusCode);
        switch (response.statusCode) {
          case 404:
            result.Netflix = "<b>Netflix: </b>支持自制剧集 ⚠️";
            break;
          case 403:
            result.Netflix = "<b>Netflix: </b>未支持 🚫";
            break;
          case 200:
            // 安全解析 region
            let region = 'us';
            const originUrl = response.headers['X-Originating-URL'];
            if (originUrl) {
              const parts = originUrl.split('/');
              if (parts.length > 3) {
                region = parts[3].split('-')[0];
                if (region === 'title') region = 'us';
              }
            }
            console.log("nf:" + region);
            const regionCode = CountryCode.get(region.toUpperCase()) || region.toUpperCase();
            result.Netflix = `<b>Netflix: </b>完整支持${arrow}${regionCode}`;
            break;
          default:
            resolve("Netflix Test Error");
            return;
        }
        console.log("nf:" + result.Netflix);
        resolve("done");
      },
      () => {
        result.Netflix = "<b>Netflix: </b>检测超时 🚦";
        console.log(result.Netflix);
        resolve("timeout");
      }
    );
  });
}

// ==================== 检测 YouTube Premium ====================
function testYTB() {
  return new Promise(resolve => {
    const option = {
      url: BASE_URL_YTB,
      opts: opts,
      timeout: 2800,
      headers: { 'User-Agent': UA }
    };
    $task.fetch(option).then(
      response => {
        const data = response.body;
        console.log("ytb:" + response.statusCode);
        if (response.statusCode !== 200) {
          result.YouTube = "<b>YouTube Premium: </b>检测失败 ❗️";
          resolve("error");
          return;
        }
        if (data.indexOf('Premium is not available in your country') !== -1) {
          result.YouTube = "<b>YouTube Premium: </b>未支持 🚫";
          resolve("not available");
          return;
        }
        // 提取地区（使用 match 代替 exec，避免 lastIndex 残留）
        let region = 'US';
        const match = data.match(/"GL":"(.*?)"/);
        if (match && match.length === 2) {
          region = match[1];
        } else if (data.indexOf('www.google.cn') !== -1) {
          region = 'CN';
        }
        const regionCode = CountryCode.get(region.toUpperCase()) || region.toUpperCase();
        result.YouTube = `<b>YouTube Premium: </b>支持 ${arrow}${regionCode}`;
        console.log("ytb:" + region + result.YouTube);
        resolve(region);
      },
      () => {
        result.YouTube = "<b>YouTube Premium: </b>检测超时 🚦";
        resolve("timeout");
      }
    );
  });
}

// ==================== 主流程 ====================
(async () => {
  // 并行检测
  await Promise.all([testNf(FILM_ID), testYTB()]);

  // 获取策略组状态（用于节点名称）
  const message = {
    action: "get_policy_state",
    content: $environment.params
  };

  $configuration.sendMessage(message).then(
    resolve => {
      if (resolve.error) {
        console.log(resolve.error);
        $done();
        return;
      }
      // 处理节点名称
      let nodeName = $environment.params;
      if (resolve.ret && resolve.ret[message.content]) {
        nodeName = JSON.stringify(resolve.ret[message.content])
          .replace(/\"|\[|\]/g, "")
          .replace(/\,/g, " ➟ ");
      }

      // 构建最终 HTML 内容
      const html = buildHtml(result.Netflix, result.YouTube, nodeName);
      console.log(nodeName);
      $done({ title: result.title, htmlMessage: html });
    },
    () => $done()
  );
})();
