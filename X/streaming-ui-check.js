	// 常量定义
	const BASE_URL = 'https://www.netflix.com/title/';
	const BASE_URL_YTB = "https://www.youtube.com/premium";
	const FILM_ID = 81280792;
	const ARROW = " ➟ ";
	// 优化：使用对象字面量替代 Map，初始化更快，查找性能稳定
	const CountryCode = {
	  "HK": "HKG", "JP": "JPN", "KR": "KOR",
	  "SG": "SGP", "TW": "TPE", "US": "USA",
	  "NL": "NED", "DE": "GER"
	};
	// 请求配置
	const opts = { policy: $environment.params };
	const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36';
	// 辅助函数：获取国家代码
	function getRegionCode(region) {
	  // 直接对象查找，避免函数调用开销
	  return CountryCode[region] || region;
	}
	// Netflix 检测
	function testNf(filmId) {
	  return new Promise(resolve => {
	    const option = {
	      url: BASE_URL + filmId,
	      opts: opts,
	      timeout: 4200, // 单个请求超时限制
	      headers: { 'User-Agent': UA }
	    };
	    $task.fetch(option).then(
	      response => {
	        // 优化：增加空值保护，防止脚本异常卡死
	        if (!response) return resolve("<b>Netflix: </b>响应异常");
	        const statusCode = response.statusCode;
	        console.log("nf:" + statusCode);
	        if (statusCode === 200) {
	          let region = 'US';
	          const originUrl = response.headers['X-Originating-URL'];
	          if (originUrl) {
	            // 优化：使用正则直接提取，减少split产生的数组操作开销
	            const match = originUrl.match(/title\/(\w{2})-/);
	            if (match) region = match[1];
	          }
	          console.log("nf:" + region);
	          const msg = `<b>Netflix: </b>完整支持${ARROW}${getRegionCode(region)}`;
	          console.log("nf:" + msg);
	          resolve(msg);
	        } else if (statusCode === 404) {
	          resolve("<b>Netflix: </b>支持自制剧集 ⚠️");
	        } else if (statusCode === 403) {
	          resolve("<b>Netflix: </b>未支持 🚫");
	        } else {
	          resolve("<b>Netflix: </b>检测异常");
	        }
	      },
	      () => {
	        const msg = "<b>Netflix: </b>检测超时 🚦";
	        console.log(msg);
	        resolve(msg);
	      }
	    );
	  });
	}
	// YouTube 检测
	function testYTB() {
	  return new Promise(resolve => {
	    const option = {
	      url: BASE_URL_YTB,
	      opts: opts,
	      timeout: 4200,
	      headers: {
	        'User-Agent': UA,
	        'Accept-Language': 'en-US,en;q=0.9'
	      }
	    };
	    $task.fetch(option).then(
	      response => {
	        if (!response) return resolve("<b>YouTube Premium: </b>响应异常");
	        const statusCode = response.statusCode;
	        const body = response.body;
	        console.log("ytb:" + statusCode);
	        if (statusCode !== 200) {
	          resolve("<b>YouTube Premium: </b>检测失败 ❗️");
	          return;
	        }
	        if (body.includes('Premium is not available in your country')) {
	          resolve("<b>YouTube Premium: </b>未支持 🚫");
	          return;
	        }
	        let region = 'US';
	        const match = body.match(/"GL":"([A-Z]{2})"/);
	        if (match) {
	          region = match[1];
	        } else if (body.includes('www.google.cn')) {
	          region = 'CN';
	        }
	        const msg = `<b>YouTube Premium: </b>支持 ${ARROW}${getRegionCode(region)}`;
	        console.log("ytb:" + region + msg);
	        resolve(msg);
	      },
	      () => {
	        const msg = "<b>YouTube Premium: </b>检测超时 🚦";
	        console.log(msg);
	        resolve(msg);
	      }
	    );
	  });
	}
	// 构建最终 HTML 内容
	function buildHtml(nfMsg, ytbMsg, nodeName) {
	  return `<p style="text-align: center; font-family: -apple-system; font-size: large; font-weight: thin">-------------------------------------</br>${nfMsg}</br></br>${ytbMsg}</br>-------------------------------------</br><font color=#007AFF><b>节点</b> ➟ ${nodeName}</font></p>`;
	}
	// 主流程 {
	  // 优化：全局超时保护，防止脚本长时间挂起阻塞UI
	  const TIMEOUT = 5000;
	  const timer = setTimeout(() => {
	    console.log("脚本执行总超时，强制结束");
	    $done({ title: '        流媒体服务查询', htmlMessage: "<p style='text-align: center;'>检测超时，请重试 🚦</p>" });
	  }, TIMEOUT);
	  try {
	    // 并行检测
	    const [nfMsg, ytbMsg] = await Promise.all([testNf(FILM_ID), testYTB()]);
	    // 获取策略组状态
	    const param = $environment.params;
	    const message = {
	      action: "get_policy_state",
	      content: param
	    };
	    $configuration.sendMessage(message).then(
	      resolve => {
	        clearTimeout(timer); // 成功获取数据，清除超时定时器
	        if (resolve.error) {
	          console.log(resolve.error);
	          return $done();
	        }
	        // 处理节点名称
	        let nodeName = param;
	        const ret = resolve.ret;
	        // 优化：直接判断类型处理
	        if (ret && ret[param]) {
	          const nodeData = ret[param];
	          if (Array.isArray(nodeData)) {
	            nodeName = nodeData.join(ARROW);
	          } else {
	            nodeName = String(nodeData);
	          }
	        }
	        // 构建最终 HTML 内容
	        const html = buildHtml(nfMsg, ytbMsg, nodeName);
	        console.log(nodeName);
	        $done({ title: '        流媒体服务查询', htmlMessage: html });
	      },
	      () => {
	        clearTimeout(timer);
	        $done();
	      }
	    );
	  } catch (e) {
	    clearTimeout(timer);
	    console.log("脚本执行异常: " + e);
	    $done();
	  }
	})();      opts: opts,
      timeout: 4200,
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

function testYTB() {
  return new Promise(resolve => {
    const option = {
      url: BASE_URL_YTB,
      opts: opts,
      timeout: 4200,
      headers: { 
        'User-Agent': UA,
        'Accept-Language': 'en-US,en;q=0.9'
      }
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
        // 提取地区
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

// 主流程
(async () => {
  // 并行检测
  await Promise.all([testNf(FILM_ID), testYTB()]);

  // 获取策略组状态
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
