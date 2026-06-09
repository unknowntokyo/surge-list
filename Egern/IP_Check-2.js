const CONFIG = {
  MIN_DURATION: 0.2,
  BITS_PER_BYTE: 8,
  MBPS_DIVISOR: 1_000_000,
};

const codeMap = { HK: '🇭🇰 香港', TW: '🇼🇸 台湾', SG: '🇸🇬 新加坡', JP: '🇯🇵 日本', KR: '🇰🇷 韩国', US: '🇺🇸 美国', NL: '🇳🇱 荷兰', DE: '🇩🇪 德国', GB: '🇬🇧 英国', TR: '🇹🇷 土耳其', FR: '🇫🇷 法国', AC: '🇦🇨 阿森松岛', AD: '🇦🇩 安道尔', AE: '🇦🇪 阿联酋', AF: '🇦🇫 阿富汗', AG: '🇦🇬 安提瓜和巴布达', AI: '🇦🇮 安圭拉', AL: '🇦🇱 阿尔巴尼亚', AM: '🇦🇲 亚美尼亚', AO: '🇦🇴 安哥拉', AQ: '🇦🇶 南极洲', AR: '🇦🇷 阿根廷', AS: '🇦🇸 美属萨摩亚', AT: '🇦🇹 奥地利', AU: '🇦🇺 澳大利亚', AW: '🇦🇼 阿鲁巴', AX: '🇦🇽 奥兰群岛', AZ: '🇦🇿 阿塞拜疆', BA: '🇧🇦 波黑', BB: '🇧🇧 巴巴多斯', BD: '🇧🇩 孟加拉国', BE: '🇧🇪 比利时', BF: '🇧🇫 布基纳法索', BG: '🇧🇬 保加利亚', BH: '🇧🇭 巴林', BI: '🇧🇮 布隆迪', BJ: '🇧🇯 贝宁', BM: '🇧🇲 百慕大', BN: '🇧🇳 文莱', BO: '🇧🇴 玻利维亚', BR: '🇧🇷 巴西', BS: '🇧🇸 巴哈马', BT: '🇧🇹 不丹', BV: '🇧🇻 布韦岛', BW: '🇧🇼 博茨瓦纳', BY: '🇧🇾 白俄罗斯', BZ: '🇧🇿 伯利兹', CA: '🇨🇦 加拿大', CD: '🇨🇩 刚果（金）', CF: '🇨🇫 中非', CG: '🇨🇬 刚果（布）', CH: '🇨🇭 瑞士', CI: '🇨🇮 科特迪瓦', CK: '🇨🇰 库克群岛', CL: '🇨🇱 智利', CM: '🇨🇲 喀麦隆', CN: '🇨🇳 中国', CO: '🇨🇴 哥伦比亚', CP: '🇨🇵 克利珀顿岛', CR: '🇨🇷 哥斯达黎加', CU: '🇨🇺 古巴', CV: '🇨🇻 佛得角', CW: '🇨🇼 库拉索', CX: '🇨🇽 圣诞岛', CY: '🇨🇾 塞浦路斯', CZ: '🇨🇿 捷克', DG: '🇩🇬 迪戈加西亚岛', DJ: '🇩🇯 吉布提', DK: '🇩🇰 丹麦', DM: '🇩🇲 多米尼克', DO: '🇩🇴 多米尼加', DZ: '🇩🇿 阿尔及利亚', EA: '🇪🇦 休达及梅利利亚', EC: '🇪🇨 厄瓜多尔', EE: '🇪🇪 爱沙尼亚', EG: '🇪🇬 埃及', EH: '🇪🇭 西撒哈拉', ER: '🇪🇷 厄立特里亚', ES: '🇪🇸 西班牙', ET: '🇪🇹 埃塞俄比亚', EU: '🇪🇺 欧盟', FI: '🇫🇮 芬兰', FJ: '🇫🇯 斐济', FK: '🇫🇰 福克兰群岛', FM: '🇫🇲 密克罗尼西亚', FO: '🇫🇴 法罗群岛', GA: '🇬🇦 加蓬', GD: '🇬🇩 格林纳达', GE: '🇬🇪 格鲁吉亚', GF: '🇬🇫 法属圭亚那', GH: '🇬🇭 加纳', GI: '🇬🇮 直布罗陀', GL: '🇬🇱 格陵兰', GM: '🇬🇲 冈比亚', GN: '🇬🇳 几内亚', GP: '🇬🇵 瓜德罗普', GR: '🇬🇷 希腊', GT: '🇬🇹 危地马拉', GU: '🇬🇺 关岛', GW: '🇬🇼 几内亚比绍', GY: '🇬🇾 圭亚那', HN: '🇭🇳 洪都拉斯', HR: '🇭🇷 克罗地亚', HT: '🇭🇹 海地', HU: '🇭🇺 匈牙利', ID: '🇮🇩 印度尼西亚', IE: '🇮🇪 爱尔兰', IL: '🇮🇱 以色列', IM: '🇮🇲 马恩岛', IN: '🇮🇳 印度', IR: '🇮🇷 伊朗', IS: '🇮🇸 冰岛', IT: '🇮🇹 意大利', JM: '🇯🇲 牙买加', JO: '🇯🇴 约旦', KE: '🇰🇪 肯尼亚', KG: '🇰🇬 吉尔吉斯斯坦', KH: '🇰🇭 柬埔寨', KI: '🇰🇮 基里巴斯', KM: '🇰🇲 科摩罗', KN: '🇰🇳 圣基茨和尼维斯', KP: '🇰🇵 朝鲜', KW: '🇰🇼 科威特', KY: '🇰🇾 开曼群岛', KZ: '🇰🇿 哈萨克斯坦', LA: '🇱🇦 老挝', LB: '🇱🇧 黎巴嫩', LC: '🇱🇨 圣卢西亚', LI: '🇱🇮 列支敦士登', LK: '🇱🇰 斯里兰卡', LR: '🇱🇷 利比里亚', LS: '🇱🇸 莱索托', LT: '🇱🇹 立陶宛', LU: '🇱🇺 卢森堡', LV: '🇱🇻 拉脱维亚', LY: '🇱🇾 利比亚', MA: '🇲🇦 摩洛哥', MC: '🇲🇨 摩纳哥', MD: '🇲🇩 摩尔多瓦', MG: '🇲🇬 马达加斯加', MH: '🇲🇭 马绍尔群岛', MK: '🇲🇰 北马其顿', ML: '🇲🇱 马里', MM: '🇲🇲 缅甸', MN: '🇲🇳 蒙古', MO: '🇲🇴 澳门', MP: '🇲🇵 北马里亚纳群岛', MQ: '🇲🇶 马提尼克', MR: '🇲🇷 毛里塔尼亚', MS: '🇲🇸 蒙特塞拉特', MT: '🇲🇹 马耳他', MU: '🇲🇺 毛里求斯', MV: '🇲🇻 马尔代夫', MW: '🇲🇼 马拉维', MX: '🇲🇽 墨西哥', MY: '🇲🇾 马来西亚', MZ: '🇲🇿 莫桑比克', NA: '🇳🇦 纳米比亚', NC: '🇳🇨 新喀里多尼亚', NE: '🇳🇪 尼日尔', NF: '🇳🇫 诺福克岛', NG: '🇳🇬 尼日利亚', NI: '🇳🇮 尼加拉瓜', NO: '🇳🇴 挪威', NP: '🇳🇵 尼泊尔', NR: '🇳🇷 瑙鲁', NZ: '🇳🇿 新西兰', OM: '🇴🇲 阿曼', PA: '🇵🇦 巴拿马', PE: '🇵🇪 秘鲁', PF: '🇵🇫 法属波利尼西亚', PG: '🇵🇬 巴布亚新几内亚', PH: '🇵🇭 菲律宾', PK: '🇵🇰 巴基斯坦', PL: '🇵🇱 波兰', PM: '🇵🇲 圣皮埃尔和密克隆', PR: '🇵🇷 波多黎各', PS: '🇵🇸 巴勒斯坦', PT: '🇵🇹 葡萄牙', PW: '🇵🇼 帕劳', PY: '🇵🇾 巴拉圭', QA: '🇶🇦 卡塔尔', RE: '🇷🇪 留尼汪', RO: '🇷🇴 罗马尼亚', RS: '🇷🇸 塞尔维亚', RU: '🇷🇺 俄罗斯', RW: '🇷🇼 卢旺达', SA: '🇸🇦 沙特阿拉伯', SB: '🇸🇧 所罗门群岛', SC: '🇸🇨 塞舌尔', SD: '🇸🇩 苏丹', SE: '🇸🇪 瑞典', SI: '🇸🇮 斯洛文尼亚', SK: '🇸🇰 斯洛伐克', SL: '🇸🇱 塞拉利昂', SM: '🇸🇲 圣马力诺', SN: '🇸🇳 塞内加尔', SR: '🇸🇷 苏里南', ST: '🇸🇹 圣多美和普林西比', SV: '🇸🇻 萨尔瓦多', SY: '🇸🇾 叙利亚', SZ: '🇸🇿 斯威士兰', TC: '🇹🇨 特克斯和凯科斯群岛', TD: '🇹🇩 乍得', TG: '🇹🇬 多哥', TH: '🇹🇭 泰国', TJ: '🇹🇯 塔吉克斯坦', TL: '🇹🇱 东帝汶', TM: '🇹🇲 土库曼斯坦', TN: '🇹🇳 突尼斯', TO: '🇹🇴 汤加', TT: '🇹🇹 特立尼达和多巴哥', TV: '🇹🇻 图瓦卢', TZ: '🇹🇿 坦桑尼亚', UA: '🇺🇦 乌克兰', UG: '🇺🇬 乌干达', UM: '🇺🇲 美属本土外岛', UY: '🇺🇾 乌拉圭', UZ: '🇺🇿 乌兹别克斯坦', VA: '🇻🇦 梵蒂冈', VC: '🇻🇨 圣文森特和格林纳丁斯', VE: '🇻🇪 委内瑞拉', VG: '🇻🇬 英属维尔京群岛', VI: '🇻🇮 美属维尔京群岛', VN: '🇻🇳 越南', VU: '🇻🇺 瓦努阿图', WS: '🇼🇸 萨摩亚', YE: '🇾🇪 也门', YT: '🇾🇹 马约特', ZA: '🇿🇦 南非', ZM: '🇿🇲 赞比亚', ZW: '🇿🇼 津巴布韦' };

const cityMap = {

  // 中国香港
  'hong kong': '香港',
  'kowloon': '九龙',
  'tseung kwan o': '将军澳',
  'chai wan': '柴湾',
  'kwai chung': '葵涌',
  'tsuen wan': '荃湾',
  'sha tin': '沙田',
  'shatin': '沙田',
  'kwun tong': '观塘',
  'san po kong': '新蒲岗',
  'tuen mun': '屯门',
  'yuen long': '元朗',
  'tai po': '大埔',
  'fo tan': '火炭',
  'cheung sha wan': '长沙湾',
  'lai chi kok': '荔枝角',
  'kwai tsing': '葵青',
  'ngau tau kok': '牛头角',
  'aberdeen': '香港仔',
  'central': '中环',
  'wan chai': '湾仔',
  'tsing yi': '青衣',
  'causeway bay': '铜锣湾',

  // 中国台湾
  'taipei': '台北',
  'new taipei': '新北',
  'banqiao': '板桥',
  'xizhi': '汐止',
  'taoyuan': '桃园',
  'changhua': '彰化',
  'kaohsiung': '高雄',
  'taichung': '台中',
  'zhubei': '竹北',

  // 中国澳门
  'macau': '澳门',
  'macao': '澳门',

  // 日本
  'tokyo': '东京',
  'osaka': '大阪',
  'chiba': '千叶',
  'inzai': '印西',
  'yokohama': '横滨',
  'kanagawa': '神奈川',
  'fukuoka': '福冈',
  'nagoya': '名古屋',
  'kobe': '神户',
  'kawasaki': '川崎',
  'saitama': '埼玉',
  'kyoto': '京都',
  'sapporo': '札幌',
  'hitachinaka': '常陆那珂',
  'sendai': '仙台',
  'akita': '秋田',
  'toyosu': '丰洲', 

  // 韩国
  'seoul': '首尔',
  'incheon': '仁川',
  'busan': '釜山',
  'daejeon': '大田',
  'suwon': '水原',
  'ulsan': '蔚山',
  'daegu': '大邱',
  'gwangju': '光州',
  'jeju': '济州',
  'seongnam': '城南',
  'chuncheon': '春川',
  'guro gu': '九老区',
  'yongsan gu': '龙山区',
  'geumcheon gu': '衿川区',
  'gangnam gu': '江南区',
  'mapo gu': '麻浦区',
  'seongdong gu': '城东区',
  'yeongdeungpo gu': '永登浦区',
  'gangseo gu': '江西区',
  'songpa gu': '松坡区',

  // 新加坡 & 马来西亚
  'singapore': '新加坡',
  'loyang': '洛阳', 
  'johor': '柔佛',
  'johor bahru': '柔佛新山',
  'cyberjaya': '赛城',
  'kuala lumpur': '吉隆坡',
  'penang': '槟城',
  'kota kinabalu': '哥打京那巴鲁',

  // 美国
  'fremont': '弗里蒙特',
  'ashburn': '阿什本',
  'reston': '雷斯顿',
  'herndon': '赫恩登',
  'mclean': '麦克林',
  'los angeles': '洛杉矶',
  'santa monica': '圣塔莫尼卡',
  'san jose': '圣何塞',
  'santa clara': '圣克拉拉',
  'sunnyvale': '桑尼维尔',
  'san francisco': '旧金山',
  'hillsboro': '希尔斯伯勒',
  'quincy': '昆西',
  'the dalles': '达尔斯',
  'portland': '波特兰',
  'seattle': '西雅图',
  'chicago': '芝加哥',
  'dallas': '达拉斯',
  'fort worth': '沃斯堡',
  'houston': '休斯顿',
  'kansas city': '堪萨斯城',
  'phoenix': '凤凰城',
  'las vegas': '拉斯维加斯',
  'denver': '丹佛',
  'buffalo': '布法罗',
  'council bluffs': '康索尔布拉夫斯',
  'new york': '纽约',
  'newark': '纽瓦克',
  'secaucus': '塞考克斯',
  'piscataway': '皮斯卡塔韦',
  'miami': '迈阿密',
  'atlanta': '亚特兰大',
  'minneapolis': '明尼阿波利斯',
  'detroit': '底特律',
  'boston': '波士顿',
  'charlotte': '夏洛特',
  'raleigh': '罗利',
  'durham': '达勒姆',
  'cary': '凯瑞',
  'tampa': '坦帕',
  'orlando': '奥兰多',
  'jacksonville': '杰克逊维尔',
  'philadelphia': '费城',
  'cleveland': '克利夫兰',
  'salt lake city': '盐湖城',
  'sandy': '桑迪',
  'provo': '普罗沃',
  'ogden': '奥格登',
  'prineville': '普林维尔',
  'north bergen': '北卑尔根',
  'clifton': '克利夫顿',
  'carteret': '卡特雷特',
  'weehawken': '威霍肯',
  'parsippany': '帕西帕尼',
  'somerset': '萨默塞特',
  'norwalk': '诺沃克',

  // 欧洲
  'london': '伦敦',
  'swindon': '斯温顿', 
  'slough': '斯劳',
  'manchester': '曼彻斯特',
  'brussels': '布鲁塞尔',
  'antwerp': '安特卫普',
  'rotterdam': '鹿特丹',
  'eindhoven': '埃因霍温',
  'amsterdam': '阿姆斯特丹',
  'haarlem': '哈勒姆',
  'schiphol': '史基浦',
  'geneva': '日内瓦',
  'lausanne': '洛桑',
  'paris': '巴黎',
  'marseille': '马赛',
  'lyon': '里昂',
  'strasbourg': '斯特拉斯堡',
  'berlin': '柏林',
  'munich': '慕尼黑',
  'dusseldorf': '杜塞尔多夫',
  'hamburg': '汉堡',
  'frankfurt': '法兰克福',
  'stuttgart': '斯图加特',
  'copenhagen': '哥本哈根',
  'oslo': '奥斯陆',
  'stockholm': '斯德哥尔摩',
  'helsinki': '赫尔辛基',
  'vienna': '维也纳',
  'warsaw': '华沙',
  'prague': '布拉格',
  'bucharest': '布加勒斯特',
  'sofia': '索非亚',
  'zurich': '苏黎世',
  'luxembourg': '卢森堡',
  'milan': '米兰',
  'madrid': '马德里',
  'valencia': '瓦伦西亚',
  'barcelona': '巴塞罗那',
  'dublin': '都柏林',
  'lisbon': '里斯本',
  'reading': '雷丁',
  'maidenhead': '梅登黑德',
  'woking': '沃金',
  'falkenstein': '法尔肯施泰因',
  'nuremberg': '纽伦堡',
  'chisinau': '基希讷乌',
  'budapest': '布达佩斯',
  'utrecht': '乌德勒支',

  // 中东 & 土耳其 & 阿塞拜疆
  'riyadh': '利雅得',
  'jeddah': '吉达',
  'dammam': '达曼',
  'dubai': '迪拜',
  'abu dhabi': '阿布扎比',
  'doha': '多哈',
  'manama': '麦纳麦',
  'muscat': '马斯喀特',
  'istanbul': '伊斯坦布尔',
  'ankara': '安卡拉',
  'izmir': '伊兹密尔',
  'tel aviv': '特拉维夫',
  'petah tikva': '佩塔提克瓦',
  'baku': '巴库',
  
  // 印度 & 巴基斯坦
  'mumbai': '孟买',
  'bengaluru': '班加罗尔',
  'bangalore': '班加罗尔',
  'chennai': '金奈',
  'pune': '浦那',
  'hyderabad': '海德拉巴',
  'rawalpindi': '拉瓦尔品第', 

  // 东南亚
  'jakarta': '雅加达',
  'surabaya': '泗水',
  'bangkok': '曼谷',
  'chiang mai': '清迈',
  'phuket': '普吉岛',
  'hanoi': '河内',
  'ho chi minh': '胡志明市',
  'danang': '岘港',
  'haiphong': '海防',
  'manila': '马尼拉',
  'cebu': '宿务',
  'yangon': '仰光',
  'phnom penh': '金边',
  'vientiane': '万象',
 
  // 巴西
  'sao paulo': '圣保罗',

  // 澳大利亚 & 新西兰
  'sydney': '悉尼',
  'melbourne': '墨尔本',
  'brisbane': '布里斯班',
  'perth': '珀斯',
  'auckland': '奥克兰',

  // 加拿大
  'toronto': '多伦多',
  'vancouver': '温哥华',
  'montreal': '蒙特利尔',
  'beauharnois': '博阿努瓦',

  // 南美洲 & 墨西哥
  'santiago': '圣地亚哥',
  'queretaro': '克雷塔罗',
  'buenos aires': '布宜诺斯艾利斯',

  // 俄罗斯
  'moscow': '莫斯科',
  'saint petersburg': '圣彼得堡',

  // 非洲
  'johannesburg': '约翰内斯堡',
  'lagos': '拉各斯',
  'cape town': '开普敦'
};

const SORTED_CITY_KEYS = Object.keys(cityMap)
  .filter(k => k.length > 2)
  .sort((a, b) => b.length - a.length);

const CITY_REGEX = new RegExp('\\b(' + SORTED_CITY_KEYS.join('|') + ')\\b');

function translateCity(text) {

  if (typeof text !== 'string') return '';

  const key = text.trim().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f.,]/g, '')
    .replace(/-+/g, ' ')
    .replace(/\s+/g, ' ');

  const exactMatch = cityMap[key];
  if (exactMatch) return exactMatch;

  const match = CITY_REGEX.exec(key);
  if (match) return cityMap[match[1]];
  
  return text;
}

async function getIPInfo(ctx) {
  try {

    const resp = ctx.response;
    let data = typeof resp.json === 'function' ? await resp.json() : resp.body;

    if (typeof data === 'string') data = JSON.parse(data);

    if (!data) {
      console.log("IP信息为空，脚本终止");
      return null;
    }

    if (data?.city_name) {
      data.city_name_zh = translateCity(data.city_name);
    }
    
    return data;
  } catch (e) {
    console.log("IP信息错误，脚本终止"); 
    return null;
  }
}

async function getSpeedTest(ctx) {
  // 从环境变量获取超时时间，默认 4 秒
  const TIMEOUT = (parseFloat(ctx.env.SPEED_TEST_TIMEOUT) || 4) * 1000;
  const TARGET_BYTES = 2 * 1024 * 1024;  // 目标下载 2MB 即可
  // 修正：补全了 https:// 协议头
  const TEST_URL = 'https://speed.cloudflare.com/__down?bytes=10485760';  
  
  // 设置超时控制器
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    // 改用标准 fetch API，确保 ReadableStream 正常工作
    const response = await fetch(TEST_URL, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId); // 成功建立连接后清除超时
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const reader = response.body.getReader();
    let bytesRead = 0;
    let downloadStartTime = null;
    
    try {
      while (bytesRead < TARGET_BYTES) {
        const { done, value } = await reader.read();
        
        // 首次收到数据块时开始计时（排除 DNS + TCP 握手耗时）
        if (!downloadStartTime) {
          downloadStartTime = performance.now();
        }
        
        if (done) {
          console.log('流提前结束');
          break;
        }
        
        bytesRead += value.byteLength;
        // console.log(`下载进度: ${(bytesRead / 1024 / 1024).toFixed(2)}MB`);
      }
      
      // 达到目标后，主动取消读取，断开连接省流量
      await reader.cancel('已获得足够数据');
      
    } catch (err) {
      try { await reader.cancel(); } catch (e) {}
      throw err;
    }
    
    // 计算耗时
    const duration = Math.max(
      (performance.now() - downloadStartTime) / 1000,
      0.1
    );
    
    // 计算 Mbps (比特率)
    const mbps = ((bytesRead * 8) / (duration * 1_000_000)).toFixed(1);
    console.log(`测速成功: ${mbps} Mbps (${(bytesRead / 1024 / 1024).toFixed(2)} MB 耗时 ${duration.toFixed(2)}s)`);
    
    return `${mbps} Mbps`;
    
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.warn('Speed test timeout');
      return '⚠ 测速超时';
    }
    console.warn('Speed test error:', error.message);
    return '⚠ 测速失败';
  }
}



function modResponseBody(ipInfo, speedMbps) {
  return {
    'IP地址': ipInfo.ip,
    '地区': codeMap[ipInfo.country_code] || ipInfo.country_code || '未知',
    ...(ipInfo.city_name_zh && { '城市': ipInfo.city_name_zh }),
    '互联网服务提供商': ipInfo.asn ? `AS${ipInfo.asn} ${ipInfo.as_desc || ''}` : '未知',
    ...(speedMbps && { '下行带宽': speedMbps }),
    '客户端': ipInfo.user_agent ? ipInfo.user_agent.replace(/^egern/i, 'Egern') : 'Egern'
  };
}

export default async function(ctx) {
  if (!ctx.response) return;

  const showSpeedtest = ctx.env.SHOW_SPEED_TEST === '开启';
  const [ipInfo, speedMbps] = await Promise.all([
    getIPInfo(ctx),
    showSpeedtest ? getSpeedTest(ctx) : Promise.resolve(null),
  ]);

  if (!ipInfo) {
    return {};
  }
 
  return { body: modResponseBody(ipInfo, speedMbps) };
}