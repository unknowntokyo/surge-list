// ==================== 常量定义 ====================
const BASE_URL_NF = 'https://www.netflix.com/title/';
const BASE_URL_YTB = 'https://www.youtube.com/premium';
const FILM_ID = 81280792;

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36';
const arrow = " ➟ ";

// 请求选项（不重定向，便于获取原始状态码）
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

async function fetchWithTimeout(url, timeout = 3000) {
  const fetchPromise = $task.fetch({
    url,
    opts: requestOpts,
    timeout: timeout - 200,
    headers: { 'User-Agent': UA }
  });
  return Promise.race([fetchPromise, timeoutPromise(timeout)]);
}

// 从重定向 URL 中提取地区代码
function extractRegionFromUrl(url) {
  const match = url.match(/\/\/(?:www\.)?netflix\.com\/([a-z]{2})(?:-|$|\/)/i);
  return match ? match[1].toUpperCase() : null;
}

// Netflix 检测
async function testNetflix() {
  try {
    const response = await fetchWithTimeout(BASE_URL_NF + FILM_ID, 3000);
    const status = response.statusCode;

    // 处理重定向 (301, 302, 307, 308)
    if (status >= 300 && status < 400) {
      const location = response.headers['Location'] || response.headers['location'];
      if (location) {
        const region = extractRegionFromUrl(location);
        if (region) {
          result.netflix = `<b>Netflix: </b>重定向至${arrow}${region}`;
          return { region, status };
        }
      }
      result.netflix = `<b>Netflix: </b>重定向 ${status} ❓`;
      return { region: null, status };
    }

    if (status === 404) {
      result.netflix = "<b>Netflix: </b>支持自制剧集 ⚠️";
      return { region: null, status };
    }
    if (status === 403) {
      result.netflix = "<b>Netflix: </b>未支持 🚫";
      return { region: null, status };
    }
    if (status === 200) {
      const url = response.headers['X-Originating-URL'];
      let region = url?.split('/')[3]?.split('-')[0];
      if (region === 'title') region = 'us';
      const country = region?.toUpperCase() || 'UNKNOWN';
      result.netflix = `<b>Netflix: </b>完整支持${arrow}${country}`;
      return { region, status };
    }

    result.netflix = `<b>Netflix: </b>未知状态码 ${status} ❓`;
    return { region: null, status };
  } catch (err) {
    result.netflix = "<b>Netflix: </b>检测超时 🚦";
    return { region: null, status: -1, error: err };
  }
}

// YouTube Premium 检测
async function testYouTube() {
  try {
    const response = await fetchWithTimeout(BASE_URL_YTB, 3000);
    const status = response.statusCode;

    if (status !== 200) {
      result.youtube = "<b>YouTube Premium: </b>检测失败 ❗️";
      return;
    }

    const data = response.body;
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
    result.youtube = `<b>YouTube Premium: </b>支持${arrow}${region.toUpperCase()}`;
  } catch (err) {
    result.youtube = "<b>YouTube Premium: </b>检测超时 🚦";
  }
}

// 发送最终结果（集成面板策略组显示）
function sendResult() {
  const items = [result.netflix, result.youtube].join('</br></br>');
  let baseContent = `-------------------------------------</br>${items}</br>-------------------------------------</br>`;
  
  // 尝试获取策略组详情（如果面板支持）
  const msg = {
    action: "get_policy_state",
    content: $environment.params
  };
  
  $configuration.sendMessage(msg).then(resolve => {
    if (resolve.error) {
      console.log(resolve.error);
    }
    let policyDisplay = $environment.params;
    if (resolve.ret && resolve.ret[msg.content]) {
      const raw = resolve.ret[msg.content];
      policyDisplay = Array.isArray(raw) ? raw.join(" ➟ ") : String(raw);
    }
    const finalContent = baseContent + `<font color=#007AFF><b>节点</b> ➟ ${policyDisplay}</font>`;
    const html = `<p style="text-align: center; font-family: -apple-system; font-size: large; font-weight: thin">${finalContent}</p>`;
    $done({ title: result.title, htmlMessage: html });
  }, () => {
    // 如果消息发送失败，仍以节点名称显示
    const fallbackHtml = `<p style="text-align: center; font-family: -apple-system; font-size: large; font-weight: thin">${baseContent}<font color=#007AFF><b>节点</b> ➟ ${$environment.params}</font></p>`;
    $done({ title: result.title, htmlMessage: fallbackHtml });
  });
}

// ==================== 主流程 ====================
(async () => {
  try {
    await Promise.all([testNetflix(), testYouTube()]);
  } catch (err) {
    console.log(`Unexpected error: ${err}`);
  } finally {
    sendResult();
  }
})();
