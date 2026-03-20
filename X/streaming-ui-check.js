// ==================== 常量定义 ====================
const BASE_URL_NF = 'https://www.netflix.com/title/';
const BASE_URL_YTB = 'https://www.youtube.com/premium';
const FILM_ID = 81280792;

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36';
const arrow = " ➟ ";

// 国家代码映射
const countryCodeMap = new Map([
  ["HK", "HKG"], ["JP", "JPN"], ["KR", "KOR"], ["SG", "SGP"],
  ["TW", "TPE"], ["US", "USA"]
]);

// 请求配置
const requestOpts = {
  policy: $environment.params,
  redirection: false
};

// 结果存储
let result = {
  title: '流媒体服务查询',
  netflix: '<b>Netflix:  </b>检测失败, 请重试 ❗️',
  youtube: '<b>YouTube:  </b>检测失败, 请重试 ❗️'
};

// ==================== 辅助函数 ====================
function timeoutPromise(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms));
}

function fetchWithTimeout(url, options, timeout = 3000) {
  const fetchPromise = $task.fetch({
    url,
    opts: requestOpts,
    timeout: timeout - 200, // 保留一点余量用于内部处理
    headers: { 'User-Agent': UA },
    ...options
  });
  return Promise.race([fetchPromise, timeoutPromise(timeout)]);
}

// Netflix 检测
async function testNetflix() {
  try {
    const response = await fetchWithTimeout(BASE_URL_NF + FILM_ID, {}, 3000);
    const status = response.statusCode;

    if (status === 404) {
      result.netflix = "<b>Netflix: </b>支持自制剧集 ⚠️";
      return { region: null, status: 404 };
    } else if (status === 403) {
      result.netflix = "<b>Netflix: </b>未支持 🚫";
      return { region: null, status: 403 };
    } else if (status === 200) {
      const url = response.headers['X-Originating-URL'];
      let region = url.split('/')[3]?.split('-')[0];
      if (region === 'title') region = 'us';
      const country = countryCodeMap.get(region.toUpperCase());
      result.netflix = `<b>Netflix: </b>完整支持${arrow}${country}`;
      return { region, status: 200 };
    } else {
      result.netflix = `<b>Netflix: </b>未知状态码 ${status} ❓`;
      return { region: null, status };
    }
  } catch (err) {
    result.netflix = "<b>Netflix: </b>检测超时 🚦";
    return { region: null, status: -1, error: err };
  }
}

// YouTube Premium 检测
async function testYouTube() {
  try {
    const response = await fetchWithTimeout(BASE_URL_YTB, {}, 3000);
    const data = response.body;
    const status = response.statusCode;

    if (status !== 200) {
      result.youtube = "<b>YouTube Premium: </b>检测失败 ❗️";
      return;
    }

    if (data.includes('Premium is not available in your country')) {
      result.youtube = "<b>YouTube Premium: </b>未支持 🚫";
      return;
    }

    // 提取地区代码
    let region = 'US';
    const match = data.match(/"GL":"(.*?)"/);
    if (match && match[1]) {
      region = match[1];
    } else if (data.includes('www.google.cn')) {
      region = 'CN';
    }
    const country = countryCodeMap.get(region.toUpperCase());
    result.youtube = `<b>YouTube Premium: </b>支持${arrow}${country}`;
  } catch (err) {
    result.youtube = "<b>YouTube Premium: </b>检测超时 🚦";
  }
}

// 发送最终结果
function sendResult() {
  // 构建 HTML 内容
  const items = [result.netflix, result.youtube].join('</br></br>');
  let content = `-------------------------------------</br>${items}</br>-------------------------------------</br>`;
  const policy = $environment.params;
  content += `<font color=#007AFF><b>节点</b> ➟ ${policy}</font>`;
  content = `<p style="text-align: center; font-family: -apple-system; font-size: large; font-weight: thin">${content}</p>`;

  // 发送消息到面板（如果存在）
  const msg = {
    action: "get_policy_state",
    content: $environment.params
  };
  $configuration.sendMessage(msg).then(resolve => {
    if (resolve.error) {
      console.log(resolve.error);
    }
    if (resolve.ret) {
      const output = JSON.stringify(resolve.ret[msg.content])?.replace(/\"|\[|\]/g, "").replace(/\,/g, " ➟ ") || $environment.params;
      let contentWithPolicy = `-------------------------------------</br>${items}</br>-------------------------------------</br>`;
      contentWithPolicy += `<font color=#007AFF><b>节点</b> ➟ ${output}</font>`;
      contentWithPolicy = `<p style="text-align: center; font-family: -apple-system; font-size: large; font-weight: thin">${contentWithPolicy}</p>`;
      $done({ title: result.title, htmlMessage: contentWithPolicy });
    } else {
      $done({ title: result.title, htmlMessage: content });
    }
  }, reject => {
    console.log(reject);
    $done({ title: result.title, htmlMessage: content });
  });
}

// ==================== 主流程 ====================
(async () => {
  try {
    // 并行检测 Netflix 和 YouTube
    await Promise.all([testNetflix(), testYouTube()]);
  } catch (err) {
    console.log(`Unexpected error: ${err}`);
    // 若有未捕获的异常，仍尝试展示已有结果
  } finally {
    sendResult();
  }
})();
