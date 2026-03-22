const STATUS = {
    FULL_AVAILABLE: 2,
    ORIGINAL_AVAILABLE: 1,
    NOT_AVAILABLE: 0,
    TIMEOUT: -1,
    ERROR: -2
};

const STATUS_ICON = {
    [STATUS.FULL_AVAILABLE]: '✅',
    [STATUS.ORIGINAL_AVAILABLE]: '📺',
    [STATUS.NOT_AVAILABLE]: '❌',
    [STATUS.TIMEOUT]: '⏱️',
    [STATUS.ERROR]: '⚠️'
};

const STATUS_TEXT = {
    [STATUS.FULL_AVAILABLE]: '完整支持',
    [STATUS.ORIGINAL_AVAILABLE]: '仅自制剧',
    [STATUS.NOT_AVAILABLE]: '不支持',
    [STATUS.TIMEOUT]: '超时',
    [STATUS.ERROR]: '异常'
};

const REQUEST_HEADERS = {
    'Accept-Language': 'en',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.71 Safari/537.36'
};

const $ = new Env('Netflix 解锁检测');

let policyName = $.getval('Helge_0x00.Netflix_Policy') || 'Netflix';
let debug = $.getval('Helge_0x00.Netflix_Debug') === 'true';
let retry = $.getval('Helge_0x00.Netflix_Retry') === 'true';
let timeoutMs = parseInt($.getval('Helge_0x00.Netflix_Timeout')) || 8000;
let sortByTime = $.getval('Helge_0x00.Netflix_Sort_By_Time') === 'true';
let concurrency = parseInt($.getval('Helge_0x00.Netflix_Concurrency')) || 10;
let simpleOutput = $.getval('Helge_0x00.Netflix_Simple_Output') === 'true';

const REGIONS_MAP = new Map(Object.entries({
    AF: { chinese: '阿富汗', english: 'Afghanistan' },
    AL: { chinese: '阿尔巴尼亚', english: 'Albania' },
    DZ: { chinese: '阿尔及利亚', english: 'Algeria' },
    AO: { chinese: '安哥拉', english: 'Angola' },
    AR: { chinese: '阿根廷', english: 'Argentina' },
    AM: { chinese: '亚美尼亚', english: 'Armenia' },
    AU: { chinese: '澳大利亚', english: 'Australia' },
    AT: { chinese: '奥地利', english: 'Austria' },
    AZ: { chinese: '阿塞拜疆', english: 'Azerbaijan' },
    BH: { chinese: '巴林', english: 'Bahrain' },
    BD: { chinese: '孟加拉国', english: 'Bangladesh' },
    BY: { chinese: '白俄罗斯', english: 'Belarus' },
    BE: { chinese: '比利时', english: 'Belgium' },
    BZ: { chinese: '伯利兹', english: 'Belize' },
    BJ: { chinese: '贝宁', english: 'Benin' },
    BT: { chinese: '不丹', english: 'Bhutan' },
    BO: { chinese: '玻利维亚', english: 'Bolivia' },
    BA: { chinese: '波黑', english: 'Bosnia and Herzegovina' },
    BW: { chinese: '博茨瓦纳', english: 'Botswana' },
    BR: { chinese: '巴西', english: 'Brazil' },
    VG: { chinese: '英属维京群岛', english: 'British Virgin Islands' },
    BN: { chinese: '文莱', english: 'Brunei' },
    BG: { chinese: '保加利亚', english: 'Bulgaria' },
    BF: { chinese: '布基纳法索', english: 'Burkina-faso' },
    BI: { chinese: '布隆迪', english: 'Burundi' },
    KH: { chinese: '柬埔寨', english: 'Cambodia' },
    CM: { chinese: '喀麦隆', english: 'Cameroon' },
    CA: { chinese: '加拿大', english: 'Canada' },
    CV: { chinese: '佛得角', english: 'Cape Verde' },
    KY: { chinese: '开曼群岛', english: 'Cayman Islands' },
    CF: { chinese: '中非', english: 'Central African Republic' },
    TD: { chinese: '乍得', english: 'Chad' },
    CL: { chinese: '智利', english: 'Chile' },
    CN: { chinese: '中国', english: 'China' },
    CO: { chinese: '哥伦比亚', english: 'Colombia' },
    KM: { chinese: '科摩罗', english: 'Comoros' },
    CG: { chinese: '刚果(布)', english: 'Congo - Brazzaville' },
    CD: { chinese: '刚果(金)', english: 'Congo - Kinshasa' },
    CR: { chinese: '哥斯达黎加', english: 'Costa Rica' },
    HR: { chinese: '克罗地亚', english: 'Croatia' },
    CY: { chinese: '塞浦路斯', english: 'Cyprus' },
    CZ: { chinese: '捷克', english: 'Czech Republic' },
    DK: { chinese: '丹麦', english: 'Denmark' },
    DJ: { chinese: '吉布提', english: 'Djibouti' },
    DO: { chinese: '多米尼加', english: 'Dominican Republic' },
    EC: { chinese: '厄瓜多尔', english: 'Ecuador' },
    EG: { chinese: '埃及', english: 'Egypt' },
    SV: { chinese: '萨尔瓦多', english: 'EI Salvador' },
    GQ: { chinese: '赤道几内亚', english: 'Equatorial Guinea' },
    ER: { chinese: '厄立特里亚', english: 'Eritrea' },
    EE: { chinese: '爱沙尼亚', english: 'Estonia' },
    ET: { chinese: '埃塞俄比亚', english: 'Ethiopia' },
    FJ: { chinese: '斐济', english: 'Fiji' },
    FI: { chinese: '芬兰', english: 'Finland' },
    FR: { chinese: '法国', english: 'France' },
    GA: { chinese: '加蓬', english: 'Gabon' },
    GM: { chinese: '冈比亚', english: 'Gambia' },
    GE: { chinese: '格鲁吉亚', english: 'Georgia' },
    DE: { chinese: '德国', english: 'Germany' },
    GH: { chinese: '加纳', english: 'Ghana' },
    GR: { chinese: '希腊', english: 'Greece' },
    GL: { chinese: '格陵兰', english: 'Greenland' },
    GT: { chinese: '危地马拉', english: 'Guatemala' },
    GN: { chinese: '几内亚', english: 'Guinea' },
    GY: { chinese: '圭亚那', english: 'Guyana' },
    HT: { chinese: '海地', english: 'Haiti' },
    HN: { chinese: '洪都拉斯', english: 'Honduras' },
    HK: { chinese: '香港', english: 'Hong Kong' },
    HU: { chinese: '匈牙利', english: 'Hungary' },
    IS: { chinese: '冰岛', english: 'Iceland' },
    IN: { chinese: '印度', english: 'India' },
    ID: { chinese: '印度尼西亚', english: 'Indonesia' },
    IR: { chinese: '伊朗', english: 'Iran' },
    IQ: { chinese: '伊拉克', english: 'Iraq' },
    IE: { chinese: '爱尔兰', english: 'Ireland' },
    IM: { chinese: '马恩岛', english: 'Isle of Man' },
    IL: { chinese: '以色列', english: 'Israel' },
    IT: { chinese: '意大利', english: 'Italy' },
    CI: { chinese: '科特迪瓦', english: 'Ivory Coast' },
    JM: { chinese: '牙买加', english: 'Jamaica' },
    JP: { chinese: '日本', english: 'Japan' },
    JO: { chinese: '约旦', english: 'Jordan' },
    KZ: { chinese: '哈萨克斯坦', english: 'Kazakstan' },
    KE: { chinese: '肯尼亚', english: 'Kenya' },
    KR: { chinese: '韩国', english: 'Korea' },
    KW: { chinese: '科威特', english: 'Kuwait' },
    KG: { chinese: '吉尔吉斯斯坦', english: 'Kyrgyzstan' },
    LA: { chinese: '老挝', english: 'Laos' },
    LV: { chinese: '拉脱维亚', english: 'Latvia' },
    LB: { chinese: '黎巴嫩', english: 'Lebanon' },
    LS: { chinese: '莱索托', english: 'Lesotho' },
    LR: { chinese: '利比里亚', english: 'Liberia' },
    LY: { chinese: '利比亚', english: 'Libya' },
    LT: { chinese: '立陶宛', english: 'Lithuania' },
    LU: { chinese: '卢森堡', english: 'Luxembourg' },
    MO: { chinese: '澳门', english: 'Macao' },
    MK: { chinese: '马其顿', english: 'Macedonia' },
    MG: { chinese: '马达加斯加', english: 'Madagascar' },
    MW: { chinese: '马拉维', english: 'Malawi' },
    MY: { chinese: '马来西亚', english: 'Malaysia' },
    MV: { chinese: '马尔代夫', english: 'Maldives' },
    ML: { chinese: '马里', english: 'Mali' },
    MT: { chinese: '马耳他', english: 'Malta' },
    MR: { chinese: '毛利塔尼亚', english: 'Mauritania' },
    MU: { chinese: '毛里求斯', english: 'Mauritius' },
    MX: { chinese: '墨西哥', english: 'Mexico' },
    MD: { chinese: '摩尔多瓦', english: 'Moldova' },
    MC: { chinese: '摩纳哥', english: 'Monaco' },
    MN: { chinese: '蒙古', english: 'Mongolia' },
    ME: { chinese: '黑山', english: 'Montenegro' },
    MA: { chinese: '摩洛哥', english: 'Morocco' },
    MZ: { chinese: '莫桑比克', english: 'Mozambique' },
    MM: { chinese: '缅甸', english: 'Myanmar' },
    NA: { chinese: '纳米比亚', english: 'Namibia' },
    NP: { chinese: '尼泊尔', english: 'Nepal' },
    NL: { chinese: '荷兰', english: 'Netherlands' },
    NZ: { chinese: '新西兰', english: 'New Zealand' },
    NI: { chinese: '尼加拉瓜', english: 'Nicaragua' },
    NE: { chinese: '尼日尔', english: 'Niger' },
    NG: { chinese: '尼日利亚', english: 'Nigeria' },
    KP: { chinese: '朝鲜', english: 'North Korea' },
    NO: { chinese: '挪威', english: 'Norway' },
    OM: { chinese: '阿曼', english: 'Oman' },
    PK: { chinese: '巴基斯坦', english: 'Pakistan' },
    PA: { chinese: '巴拿马', english: 'Panama' },
    PY: { chinese: '巴拉圭', english: 'Paraguay' },
    PE: { chinese: '秘鲁', english: 'Peru' },
    PH: { chinese: '菲律宾', english: 'Philippines' },
    PL: { chinese: '波兰', english: 'Poland' },
    PT: { chinese: '葡萄牙', english: 'Portugal' },
    PR: { chinese: '波多黎各', english: 'Puerto Rico' },
    QA: { chinese: '卡塔尔', english: 'Qatar' },
    RE: { chinese: '留尼旺', english: 'Reunion' },
    RO: { chinese: '罗马尼亚', english: 'Romania' },
    RU: { chinese: '俄罗斯', english: 'Russia' },
    RW: { chinese: '卢旺达', english: 'Rwanda' },
    SM: { chinese: '圣马力诺', english: 'San Marino' },
    SA: { chinese: '沙特阿拉伯', english: 'Saudi Arabia' },
    SN: { chinese: '塞内加尔', english: 'Senegal' },
    RS: { chinese: '塞尔维亚', english: 'Serbia' },
    SL: { chinese: '塞拉利昂', english: 'Sierra Leone' },
    SG: { chinese: '新加坡', english: 'Singapore' },
    SK: { chinese: '斯洛伐克', english: 'Slovakia' },
    SI: { chinese: '斯洛文尼亚', english: 'Slovenia' },
    SO: { chinese: '索马里', english: 'Somalia' },
    ZA: { chinese: '南非', english: 'South Africa' },
    ES: { chinese: '西班牙', english: 'Spain' },
    LK: { chinese: '斯里兰卡', english: 'Sri Lanka' },
    SD: { chinese: '苏丹', english: 'Sudan' },
    SR: { chinese: '苏里南', english: 'Suriname' },
    SZ: { chinese: '斯威士兰', english: 'Swaziland' },
    SE: { chinese: '瑞典', english: 'Sweden' },
    CH: { chinese: '瑞士', english: 'Switzerland' },
    SY: { chinese: '叙利亚', english: 'Syria' },
    TW: { chinese: '台湾', english: 'Taiwan' },
    TJ: { chinese: '塔吉克斯坦', english: 'Tajikstan' },
    TZ: { chinese: '坦桑尼亚', english: 'Tanzania' },
    TH: { chinese: '泰国', english: 'Thailand' },
    TG: { chinese: '多哥', english: 'Togo' },
    TO: { chinese: '汤加', english: 'Tonga' },
    TT: { chinese: '特立尼达和多巴哥', english: 'Trinidad and Tobago' },
    TN: { chinese: '突尼斯', english: 'Tunisia' },
    TR: { chinese: '土耳其', english: 'Turkey' },
    TM: { chinese: '土库曼斯坦', english: 'Turkmenistan' },
    VI: { chinese: '美属维尔京群岛', english: 'U.S. Virgin Islands' },
    UG: { chinese: '乌干达', english: 'Uganda' },
    UA: { chinese: '乌克兰', english: 'Ukraine' },
    AE: { chinese: '阿联酋', english: 'United Arab Emirates' },
    GB: { chinese: '英国', english: 'United Kiongdom' },
    US: { chinese: '美国', english: 'USA' },
    UY: { chinese: '乌拉圭', english: 'Uruguay' },
    UZ: { chinese: '乌兹别克斯坦', english: 'Uzbekistan' },
    VA: { chinese: '梵蒂冈', english: 'Vatican City' },
    VE: { chinese: '委内瑞拉', english: 'Venezuela' },
    VN: { chinese: '越南', english: 'Vietnam' },
    YE: { chinese: '也门', english: 'Yemen' },
    YU: { chinese: '南斯拉夫', english: 'Yugoslavia' },
    ZR: { chinese: '扎伊尔', english: 'Zaire' },
    ZM: { chinese: '赞比亚', english: 'Zambia' },
    ZW: { chinese: '津巴布韦', english: 'Zimbabwe' }
}));

const timeoutPromise = (ms) => new Promise((_, reject) => setTimeout(() => reject('Timeout'), ms));

function getCountryFlagEmoji(countryCode) {
    if (!countryCode) return '';
    let code = countryCode.toUpperCase();
    if (code === 'TW') code = 'CN';
    const codePoints = [...code].map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
}

function formatRegionInfo(region) {
    const flag = getCountryFlagEmoji(region);
    const regionName = REGIONS_MAP.get(region?.toUpperCase())?.chinese ?? '';
    return `${flag} ${regionName}`.trim();
}

// 计算字符串显示宽度（中文字符占2）
function getDisplayWidth(str) {
    let width = 0;
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if ((code >= 0x4e00 && code <= 0x9fff) ||
            (code >= 0x3400 && code <= 0x4dbf) ||
            (code >= 0xf900 && code <= 0xfaff) ||
            (code >= 0xff00 && code <= 0xffef) ||
            (code >= 0x20000 && code <= 0x2ffff)) {
            width += 2;
        } else {
            width += 1;
        }
    }
    return width;
}

// 按显示宽度填充字符串（左对齐，右侧填充空格）
function padDisplay(str, targetWidth) {
    const currentWidth = getDisplayWidth(str);
    if (currentWidth >= targetWidth) return str;
    const padCount = targetWidth - currentWidth;
    return str + ' '.repeat(padCount);
}

function printGroup(title, items) {
    if (!items.length) return;
    console.log(`\n${title} (${items.length})：`);
    // 动态计算列宽
    let maxPolicy = 0;
    let maxStatus = 0;
    let maxRegion = 0;
    let maxTime = 0;
    for (const { policy, region, time } of items) {
        maxPolicy = Math.max(maxPolicy, getDisplayWidth(policy));
        const statusText = STATUS_TEXT[items[0].status]; // 统一用当前组的状态
        maxStatus = Math.max(maxStatus, getDisplayWidth(statusText) + 2); // 加图标宽度
        maxRegion = Math.max(maxRegion, getDisplayWidth(region ? formatRegionInfo(region) : '-'));
        maxTime = Math.max(maxTime, getDisplayWidth(`${time}ms`));
    }
    // 增加固定间距
    const col1Width = maxPolicy + 2;
    const col2Width = maxStatus + 4;
    const col3Width = maxRegion + 4;
    const col4Width = maxTime + 2;

    for (const { policy, status, region, time } of items) {
        const icon = STATUS_ICON[status];
        const statusText = STATUS_TEXT[status];
        const regionDisplay = region ? formatRegionInfo(region) : '-';
        const timeStr = `${time}ms`;
        const line = padDisplay(policy, col1Width) +
                     padDisplay(`${icon} ${statusText}`, col2Width) +
                     padDisplay(regionDisplay, col3Width) +
                     timeStr.padStart(col4Width);
        console.log(`  ${line}`);
    }
}

function printOtherNodes(nodes) {
    if (!nodes.length) return;
    console.log(`\n其他节点：`);
    const lineChunks = [];
    let current = '';
    for (const node of nodes) {
        if ((current + node).length > 80) {
            lineChunks.push(current);
            current = node;
        } else {
            current = current ? `${current}  ${node}` : node;
        }
    }
    if (current) lineChunks.push(current);
    for (const chunk of lineChunks) {
        console.log(`  ${chunk}`);
    }
}

function printSummary(stats, totalTime) {
    const { total, full, original, notAvailable, timeout, error } = stats;
    console.log(`\n📊 检测统计`);
    console.log(`  总节点数: ${total}`);
    console.log(`  ✅ 完整解锁: ${full}`);
    console.log(`  📺 仅自制剧: ${original}`);
    console.log(`  ❌ 不支持  : ${notAvailable}`);
    console.log(`  ⏱️ 超时    : ${timeout}`);
    console.log(`  ⚠️ 异常    : ${error}`);
    console.log(`  ⏱️ 总耗时  : ${totalTime.toFixed(2)} 秒`);
}

async function testPolicies(groupName, policies = []) {
    const fullAvailable = [];
    const originalAvailable = [];
    const cache = new Map();
    const allResults = new Map();

    let processedCount = 0;
    const total = policies.length;

    const processResults = (resultsMap) => {
        fullAvailable.length = 0;
        originalAvailable.length = 0;
        let notAvailableCount = 0;
        let timeoutCount = 0;
        let errorCount = 0;
        const otherNodes = [];

        for (const [policy, result] of resultsMap) {
            const { status, region, time } = result;
            if (status === STATUS.FULL_AVAILABLE) {
                fullAvailable.push({ policy, region, status, time });
            } else if (status === STATUS.ORIGINAL_AVAILABLE) {
                originalAvailable.push({ policy, region, status, time });
            } else if (status === STATUS.NOT_AVAILABLE) {
                notAvailableCount++;
                otherNodes.push(`${policy} ❌`);
            } else if (status === STATUS.TIMEOUT) {
                timeoutCount++;
                otherNodes.push(`${policy} ⏱️`);
            } else if (status === STATUS.ERROR) {
                errorCount++;
                otherNodes.push(`${policy} ⚠️`);
            }
        }

        if (!simpleOutput) {
            printGroup('完整支持', fullAvailable);
            printGroup('仅自制剧', originalAvailable);
            printOtherNodes(otherNodes);
        }

        const failed = [];
        for (const [policy, result] of resultsMap) {
            if (result.status === STATUS.TIMEOUT || result.status === STATUS.ERROR) {
                failed.push(policy);
            }
        }
        return { failed, notAvailableCount, timeoutCount, errorCount };
    };

    const testWithCache = async (policy) => {
        if (cache.has(policy)) {
            const cached = cache.get(policy);
            if (cached.status !== STATUS.TIMEOUT && cached.status !== STATUS.ERROR) {
                if (debug) console.log(`[缓存命中] ${policy} -> ${cached.status}`);
                return cached;
            }
        }
        const result = await test(policy);
        cache.set(policy, result);
        return result;
    };

    const resultsArray = await Promise.map(policies, async (policy) => {
        const result = await testWithCache(policy);
        processedCount++;
        if (!debug && !simpleOutput && processedCount % 10 === 0) {
            console.log(`进度: ${processedCount}/${total}`);
        }
        return result;
    }, { concurrency });

    for (const res of resultsArray) allResults.set(res.policy, res);

    let { failed, notAvailableCount, timeoutCount, errorCount } = processResults(allResults);

    if (retry && failed.length > 0) {
        const timeoutPolicies = failed.filter(p => allResults.get(p)?.status === STATUS.TIMEOUT);
        const errorPolicies = failed.filter(p => allResults.get(p)?.status === STATUS.ERROR);

        if (timeoutPolicies.length > 0) {
            console.log(`\n⏱️ 重试超时节点 (${timeoutPolicies.length}个)...`);
            let remainingTimeout = [...timeoutPolicies];
            for (let attempt = 1; attempt <= 2 && remainingTimeout.length > 0; attempt++) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                await $.wait(delay);
                for (const p of remainingTimeout) cache.delete(p);
                const retryResults = await Promise.map(remainingTimeout, testWithCache, { concurrency });
                for (const ret of retryResults) allResults.set(ret.policy, ret);
                remainingTimeout = remainingTimeout.filter(p => allResults.get(p)?.status === STATUS.TIMEOUT);
            }
        }

        if (errorPolicies.length > 0) {
            console.log(`\n⚠️ 重试异常节点 (${errorPolicies.length}个)...`);
            await $.wait(1000);
            for (const p of errorPolicies) cache.delete(p);
            const retryResults = await Promise.map(errorPolicies, testWithCache, { concurrency });
            for (const ret of retryResults) allResults.set(ret.policy, ret);
        }

        const updated = processResults(allResults);
        notAvailableCount = updated.notAvailableCount;
        timeoutCount = updated.timeoutCount;
        errorCount = updated.errorCount;
    }

    return {
        fullAvailablePolicies: fullAvailable,
        originalAvailablePolicies: originalAvailable,
        stats: { total: policies.length, full: fullAvailable.length, original: originalAvailable.length, notAvailable: notAvailableCount, timeout: timeoutCount, error: errorCount }
    };
}

function getFilmPage(filmId, policy) {
    return new Promise((resolve, reject) => {
        const request = {
            url: `https://www.netflix.com/title/${filmId}`,
            opts: { redirection: false, policy },
            headers: REQUEST_HEADERS
        };
        $task.fetch(request).then(
            response => {
                const { statusCode, headers: { Location: location, 'X-Originating-URL': originatingUrl } } = response;
                if (statusCode === 403 || statusCode === 404) {
                    reject(statusCode === 403 ? 'Not Available' : 'Not Found');
                    return;
                }
                if (statusCode === 302 || statusCode === 301 || statusCode === 200) {
                    if (debug) {
                        if (statusCode === 200) {
                            console.log(`${policy} filmId: ${filmId}, statusCode: ${statusCode}, X-Originating-URL: ${originatingUrl}`);
                        } else {
                            console.log(`${policy} filmId: ${filmId}, statusCode: ${statusCode}, Location: ${location}`);
                        }
                    }
                    const url = location ?? originatingUrl;
                    let region = url.split('/')[3]?.split('-')[0];
                    if (region === 'title') region = 'US';
                    resolve(region?.toUpperCase() || 'US');
                    return;
                }
                if (debug) console.log(`${policy} filmId: ${filmId}, statusCode: ${statusCode}, response: ${JSON.stringify(response)}`);
                reject('Not Available');
            },
            reason => {
                if (debug) console.log(`${policy} getFilmPage Error: ${reason.error}`);
                reject('Error');
            }
        );
    });
}

async function test(policy) {
    if (debug) console.log(`开始测试 ${policy}`);
    const startTime = Date.now();
    let result;
    try {
        const region = await Promise.race([getFilmPage(81280792, policy), timeoutPromise(timeoutMs)]);
        result = { region, policy, status: STATUS.FULL_AVAILABLE };
    } catch (error) {
        if (error !== 'Not Found') {
            result = { policy, status: error === 'Timeout' ? STATUS.TIMEOUT : STATUS.ERROR };
        } else {
            try {
                const region = await Promise.race([getFilmPage(80018499, policy), timeoutPromise(timeoutMs)]);
                result = { region, policy, status: STATUS.ORIGINAL_AVAILABLE };
            } catch (err) {
                result = { policy, status: err === 'Timeout' ? STATUS.TIMEOUT : STATUS.ERROR };
            }
        }
    }
    return { ...result, time: Date.now() - startTime };
}

function sendMessage(message) {
    return new Promise((resolve, reject) => {
        $configuration.sendMessage(message).then(
            response => {
                if (response.error) {
                    if (debug) console.log(`${message?.action} error: ${response.error}`);
                    reject(response.error);
                } else resolve(response.ret);
            },
            error => reject(error)
        );
    });
}

function lookupChildrenNode(policies = {}, targetPolicyName) {
    const targetPolicy = policies[targetPolicyName];
    if (!isValidPolicy(targetPolicy)) throw '策略组名未填写或填写有误，请在 BoxJS 中填写正确的策略组名称';
    if (targetPolicy.type !== 'static') throw `${targetPolicyName} 不是 static 类型的策略组`;
    if (!targetPolicy.candidates.length) throw `${targetPolicyName} 策略组为空`;

    const candidates = new Set();
    const looked = new Set();
    const looking = [targetPolicyName];

    while (looking.length) {
        const cur = looking.shift();
        looked.add(cur);
        for (const policy of policies[cur].candidates) {
            if (policy === 'proxy' || policy === 'reject') continue;
            if (!policies[policy]) {
                candidates.add(policy);
                continue;
            }
            if (!looked.has(policy) && !looking.includes(policy) && policies[policy]?.type === 'static') {
                looking.push(policy);
            }
        }
    }
    return [...candidates];
}

function lookupTargetPolicy(policies = {}) {
    const matches = Object.keys(policies).filter(key => /Netflix|奈飞|网飞/i.test(key));
    if (matches.length === 1) return matches[0];
    if (matches.length === 0) throw '没有找到 Netflix 策略组，请在 BoxJS 中填写正确的策略组名称';
    throw '找到多个 Netflix 策略组，请在 BoxJS 中填写正确的策略组名称';
}

function isValidPolicy(policy) {
    return policy && policy.type !== undefined && Array.isArray(policy.candidates);
}

(async () => {
    const overallStart = Date.now();
    if (!$.isQuanX()) throw '该脚本仅支持在 Quantumult X 中运行';

    const policies = await sendMessage({ action: 'get_customized_policy' });
    if (!isValidPolicy(policies[policyName])) {
        policyName = lookupTargetPolicy(policies);
        console.log(`自动选择策略组: ${policyName}`);
        $.setval(policyName, 'Helge_0x00.Netflix_Policy');
    }

    const candidatePolicies = lookupChildrenNode(policies, policyName);
    console.log(`策略组: ${policyName}，节点数: ${candidatePolicies.length}\n`);

    const { fullAvailablePolicies, originalAvailablePolicies, stats } = await testPolicies(policyName, candidatePolicies);

    if (sortByTime) {
        fullAvailablePolicies.sort((a, b) => a.time - b.time);
        originalAvailablePolicies.sort((a, b) => a.time - b.time);
    }

    $.setval(JSON.stringify(fullAvailablePolicies), 'Helge_0x00.Netflix_Full_Available_Policies');
    $.setval(JSON.stringify(originalAvailablePolicies), 'Helge_0x00.Netflix_Original_Available_Policies');

    const totalTime = (Date.now() - overallStart) / 1000;
    printSummary(stats, totalTime);
})().catch(error => {
    console.log(`\n❌ 错误: ${error}`);
    if (typeof error === 'string') $.msg($.name, '', `${error} ⚠️`);
}).finally(() => $.done());

Promise.map = function (arr, mapper, { concurrency } = {}) {
    const limit = concurrency ?? Infinity;
    class Queue {
        constructor(limit) {
            this.limit = limit;
            this.count = 0;
            this.queue = [];
        }
        enqueue(fn) {
            return new Promise((resolve, reject) => {
                this.queue.push({ fn, resolve, reject });
            });
        }
        dequeue() {
            if (this.count < this.limit && this.queue.length) {
                const { fn, resolve, reject } = this.queue.shift();
                this.run(fn).then(resolve).catch(reject);
            }
        }
        async run(fn) {
            this.count++;
            const result = await fn();
            this.count--;
            this.dequeue();
            return result;
        }
        build(fn) {
            return this.count < this.limit ? this.run(fn) : this.enqueue(fn);
        }
    }
    const q = new Queue(limit);
    return Promise.all(arr.map(item => q.build(() => mapper(item))));
};

function Env(name, opts) {
    class s {
        constructor(t) {
            this.env = t;
        }
        send(t, e = "GET") {
            t = "string" == typeof t ? { url: t } : t;
            let s = this.get;
            return "POST" === e && (s = this.post), new Promise((e, i) => {
                s.call(this, t, (t, s, r) => {
                    t ? i(t) : e(s);
                });
            });
        }
        get(t) {
            return this.send.call(this.env, t);
        }
        post(t) {
            return this.send.call(this.env, t, "POST");
        }
    }
    return new class {
        constructor(t, e) {
            this.name = t, this.http = new s(this), this.data = null, this.dataFile = "box.dat", this.logs = [], this.isMute = !1, this.isNeedRewrite = !1, this.logSeparator = "\n", this.encoding = "utf-8", this.startTime = (new Date).getTime(), Object.assign(this, e);
        }
        isNode() {
            return "undefined" != typeof module && !!module.exports;
        }
        isQuanX() {
            return "undefined" != typeof $task;
        }
        isSurge() {
            return "undefined" != typeof $httpClient && "undefined" == typeof $loon;
        }
        isLoon() {
            return "undefined" != typeof $loon;
        }
        isShadowrocket() {
            return "undefined" != typeof $rocket;
        }
        toObj(t, e = null) {
            try {
                return JSON.parse(t);
            } catch {
                return e;
            }
        }
        toStr(t, e = null) {
            try {
                return JSON.stringify(t);
            } catch {
                return e;
            }
        }
        getjson(t, e) {
            let s = e;
            const i = this.getdata(t);
            if (i) try {
                s = JSON.parse(this.getdata(t));
            } catch { }
            return s;
        }
        setjson(t, e) {
            try {
                return this.setdata(JSON.stringify(t), e);
            } catch {
                return !1;
            }
        }
        getScript(t) {
            return new Promise(e => {
                this.get({ url: t }, (t, s, i) => e(i));
            });
        }
        runScript(t, e) {
            return new Promise(s => {
                let i = this.getdata("@chavy_boxjs_userCfgs.httpapi");
                i = i ? i.replace(/\n/g, "").trim() : i;
                let r = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");
                r = r ? 1 * r : 20, r = e && e.timeout ? e.timeout : r;
                const [o, h] = i.split("@"), n = { url: `http://${h}/v1/scripting/evaluate`, body: { script_text: t, mock_type: "cron", timeout: r }, headers: { "X-Key": o, Accept: "*/*" } };
                this.post(n, (t, e, i) => s(i));
            }).catch(t => this.logErr(t));
        }
        loaddata() {
            if (!this.isNode()) return {};
            {
                this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path");
                const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e);
                if (!s && !i) return {};
                {
                    const i = s ? t : e;
                    try {
                        return JSON.parse(this.fs.readFileSync(i));
                    } catch (t) {
                        return {};
                    }
                }
            }
        }
        writedata() {
            if (this.isNode()) {
                this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path");
                const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e), r = JSON.stringify(this.data);
                s ? this.fs.writeFileSync(t, r) : i ? this.fs.writeFileSync(e, r) : this.fs.writeFileSync(t, r);
            }
        }
        lodash_get(t, e, s) {
            const i = e.replace(/\[(\d+)\]/g, ".$1").split(".");
            let r = t;
            for (const t of i) if (r = Object(r)[t], void 0 === r) return s;
            return r;
        }
        lodash_set(t, e, s) {
            return Object(t) !== t ? t : (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), e.slice(0, -1).reduce((t, s, i) => Object(t[s]) === t[s] ? t[s] : t[s] = Math.abs(e[i + 1]) >> 0 == +e[i + 1] ? [] : {}, t)[e[e.length - 1]] = s, t);
        }
        getdata(t) {
            let e = this.getval(t);
            if (/^@/.test(t)) {
                const [, s, i] = /^@(.*?)\.(.*?)$/.exec(t), r = s ? this.getval(s) : "";
                if (r) try {
                    const t = JSON.parse(r);
                    e = t ? this.lodash_get(t, i, "") : e;
                } catch (t) {
                    e = "";
                }
            }
            return e;
        }
        setdata(t, e) {
            let s = !1;
            if (/^@/.test(e)) {
                const [, i, r] = /^@(.*?)\.(.*?)$/.exec(e), o = this.getval(i), h = i ? "null" === o ? null : o || "{}" : "{}";
                try {
                    const e = JSON.parse(h);
                    this.lodash_set(e, r, t), s = this.setval(JSON.stringify(e), i);
                } catch (e) {
                    const o = {};
                    this.lodash_set(o, r, t), s = this.setval(JSON.stringify(o), i);
                }
            } else s = this.setval(t, e);
            return s;
        }
        getval(t) {
            return this.isSurge() || this.isLoon() ? $persistentStore.read(t) : this.isQuanX() ? $prefs.valueForKey(t) : this.isNode() ? (this.data = this.loaddata(), this.data[t]) : this.data && this.data[t] || null;
        }
        setval(t, e) {
            return this.isSurge() || this.isLoon() ? $persistentStore.write(t, e) : this.isQuanX() ? $prefs.setValueForKey(t, e) : this.isNode() ? (this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0) : this.data && this.data[e] || null;
        }
        initGotEnv(t) {
            this.got = this.got ? this.got : require("got"), this.cktough = this.cktough ? this.cktough : require("tough-cookie"), this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar, t && (t.headers = t.headers ? t.headers : {}, void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar));
        }
        get(t, e = (() => { })) {
            if (t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"]), this.isSurge() || this.isLoon()) this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient.get(t, (t, s, i) => {
                !t && s && (s.body = i, s.statusCode = s.status), e(t, s, i);
            }); else if (this.isQuanX()) this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => {
                const { statusCode: s, statusCode: i, headers: r, body: o } = t;
                e(null, { status: s, statusCode: i, headers: r, body: o }, o);
            }, t => e(t)); else if (this.isNode()) {
                let s = require("iconv-lite");
                this.initGotEnv(t), this.got(t).on("redirect", (t, e) => {
                    try {
                        if (t.headers["set-cookie"]) {
                            const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();
                            s && this.ckjar.setCookieSync(s, null), e.cookieJar = this.ckjar;
                        }
                    } catch (t) {
                        this.logErr(t);
                    }
                }).then(t => {
                    const { statusCode: i, statusCode: r, headers: o, rawBody: h } = t;
                    e(null, { status: i, statusCode: r, headers: o, rawBody: h }, s.decode(h, this.encoding));
                }, t => {
                    const { message: i, response: r } = t;
                    e(i, r, r && s.decode(r.rawBody, this.encoding));
                });
            }
        }
        post(t, e = (() => { })) {
            const s = t.method ? t.method.toLocaleLowerCase() : "post";
            if (t.body && t.headers && !t.headers["Content-Type"] && (t.headers["Content-Type"] = "application/x-www-form-urlencoded"), t.headers && delete t.headers["Content-Length"], this.isSurge() || this.isLoon()) this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient[s](t, (t, s, i) => {
                !t && s && (s.body = i, s.statusCode = s.status), e(t, s, i);
            }); else if (this.isQuanX()) t.method = s, this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => {
                const { statusCode: s, statusCode: i, headers: r, body: o } = t;
                e(null, { status: s, statusCode: i, headers: r, body: o }, o);
            }, t => e(t)); else if (this.isNode()) {
                let i = require("iconv-lite");
                this.initGotEnv(t);
                const { url: r, ...o } = t;
                this.got[s](r, o).then(t => {
                    const { statusCode: s, statusCode: r, headers: o, rawBody: h } = t;
                    e(null, { status: s, statusCode: r, headers: o, rawBody: h }, i.decode(h, this.encoding));
                }, t => {
                    const { message: s, response: r } = t;
                    e(s, r, r && i.decode(r.rawBody, this.encoding));
                });
            }
        }
        time(t, e = null) {
            const s = e ? new Date(e) : new Date;
            let i = { "M+": s.getMonth() + 1, "d+": s.getDate(), "H+": s.getHours(), "m+": s.getMinutes(), "s+": s.getSeconds(), "q+": Math.floor((s.getMonth() + 3) / 3), S: s.getMilliseconds() };
            /(y+)/.test(t) && (t = t.replace(RegExp.$1, (s.getFullYear() + "").substr(4 - RegExp.$1.length)));
            for (let e in i) new RegExp("(" + e + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? i[e] : ("00" + i[e]).substr(("" + i[e]).length)));
            return t;
        }
        msg(e = name, s = "", i = "", r) {
            const o = t => {
                if (!t) return t;
                if ("string" == typeof t) return this.isLoon() ? t : this.isQuanX() ? { "open-url": t } : this.isSurge() ? { url: t } : void 0;
                if ("object" == typeof t) {
                    if (this.isLoon()) {
                        let e = t.openUrl || t.url || t["open-url"], s = t.mediaUrl || t["media-url"];
                        return { openUrl: e, mediaUrl: s };
                    }
                    if (this.isQuanX()) {
                        let e = t["open-url"] || t.url || t.openUrl, s = t["media-url"] || t.mediaUrl;
                        return { "open-url": e, "media-url": s };
                    }
                    if (this.isSurge()) {
                        let e = t.url || t.openUrl || t["open-url"];
                        return { url: e };
                    }
                }
            };
            if (this.isMute || (this.isSurge() || this.isLoon() ? $notification.post(e, s, i, o(r)) : this.isQuanX() && $notify(e, s, i, o(r))), !this.isMuteLog) {
                let t = ["", "==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============="];
                t.push(e), s && t.push(s), i && t.push(i), console.log(t.join("\n")), this.logs = this.logs.concat(t);
            }
        }
        log(...t) {
            t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator));
        }
        logErr(t, e) {
            const s = !this.isSurge() && !this.isQuanX() && !this.isLoon();
            s ? this.log("", `\u2757\ufe0f${this.name}, \u9519\u8bef!`, t.stack) : this.log("", `\u2757\ufe0f${this.name}, \u9519\u8bef!`, t);
        }
        wait(t) {
            return new Promise(e => setTimeout(e, t));
        }
        done(t = {}) {
            (this.isSurge() || this.isQuanX() || this.isLoon()) && $done(t);
        }
    }(name, opts);
}
