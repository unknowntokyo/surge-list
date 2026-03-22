// 常量定义
const BASE_URL = 'https://www.netflix.com/title/';
const BASE_URL_YTB = "https://www.youtube.com/premium";
const FILM_ID = 81280792;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36';
const ARROW = " ➟ ";

// 国家代码映射（普通对象，查找更快）
const CountryCode = {
    HK: "HKG", JP: "JPN", KR: "KOR", SG: "SGP",
    TW: "TPE", US: "USA", NL: "NED", DE: "GER"
};

// 结果存储（默认值）
const result = {
    title: '        流媒体服务查询',
    YouTube: '<b>YouTube: </b>检测失败, 请重试 ❗️',
    Netflix: '<b>Netflix: </b>检测失败, 请重试 ❗️'
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
                console.log("NF:" + status);
                if (status === 404) {
                    result.Netflix = "<b>Netflix: </b>支持自制剧集 ⚠️";
                } else if (status === 403) {
                    result.Netflix = "<b>Netflix: </b>未支持 🚫";
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
                    console.log("NF:" + region);
                    const regionCode = CountryCode[region.toUpperCase()] || region.toUpperCase();
                    result.Netflix = `<b>Netflix: </b>完整支持${ARROW}${regionCode}`;
                } else {
                    resolve("Netflix Test Error");
                    return;
                }
                console.log("NF:" + result.Netflix);
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
                console.log("YTB:" + status);
                if (status !== 200) {
                    result.YouTube = "<b>YouTube Premium: </b>检测失败 ❗️";
                    resolve("error");
                    return;
                }

                const data = response.body;
                if (data.includes('Premium is not available in your country')) {
                    result.YouTube = "<b>YouTube Premium: </b>未支持 🚫";
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
                console.log("YTB:" + region + result.YouTube);
                resolve(region);
            },
            () => {
                result.YouTube = "<b>YouTube Premium: </b>检测超时 🚦";
                console.log(result.YouTube);
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

            let nodeName = $environment.params;
            if (resolve.ret && resolve.ret[message.content]) {
                nodeName = resolve.ret[message.content].join(" ➟ ");
            }
            console.log(nodeName);

            const html = buildHtml(result.Netflix, result.YouTube, nodeName);
            $done({ title: result.title, htmlMessage: html });
        },
        () => $done()
    );
})();
