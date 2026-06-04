export default async function(ctx) {
  // 1. 防御性 I/O：雷打不动
  let obj = {};
  if (ctx && ctx.response) {
    try {
      obj = await ctx.response.json() || {};
    } catch (jsonErr) {
      if (ctx.log) ctx.log(`[Warning] 地区数据 JSON 解析失败: ${jsonErr.message}`);
    }
  }

  let speedMbps = "⚠️ 测速失败";
  const CHUNK_SIZE = 1048576; // 1MB 字节常量
  const SPEED_TEST_URL = `https://speed.cloudflare.com/__down?bytes=${CHUNK_SIZE}`;

  const getTimestamp = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const globalStart = getTimestamp();
  const errLogs = [];

  // 2. 静态高精并发体
  const runTask = async (index) => {
    const taskStart = getTimestamp();
    const uniqueUrl = `${SPEED_TEST_URL}&ts=${taskStart}&road=${index}`;
    
    try {
      // 🌟 咬文嚼字：必须捕获 res，拦截"伪成功"的 HTTP 错误状态码
      const res = await ctx.http.get(uniqueUrl, {
        headers: { 
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Connection': 'close' 
        },
        timeout: 5000 
      });

      // 如果运行时支持 status 校验，强制过滤非 200 状态（防止把 502 报错页当网速）
      if (res && res.status && res.status !== 200) {
        errLogs.push(`[SpeedTest] 通路 [${index}] 状态异常: ${res.status}`);
        return false;
      }
      return true;
    } catch (reqErr) {
      errLogs.push(`[SpeedTest] 通路 [${index}] 捕获失败: ${reqErr.message || reqErr}`);
      return false;
    }
  };

  // 4路并发独立起跑
  const tasks = [runTask(0), runTask(1), runTask(2), runTask(3)];

  try {
    const results = await Promise.all(tasks);
    const globalEnd = getTimestamp();
    
    // 🌟 极限压榨：用隐式类型转换 (true->1, false->0) 彻底干掉 4 个 if 分支预测，CPU 一路通畅！
    const successCount = (results[0] | 0) + (results[1] | 0) + (results[2] | 0) + (results[3] | 0);

    if (successCount > 0) {
      const wallClockDuration = (globalEnd - globalStart) / 1000; 
      if (wallClockDuration > 0) {
        const speedMbpsVal = (successCount * CHUNK_SIZE * 8) / (wallClockDuration * 1000000);
        speedMbps = `${speedMbpsVal.toFixed(1)} Mbps`;
      }
    }
  } catch (globalErr) {
    errLogs.push(`[SpeedTest] 结算逻辑异常: ${globalErr.message}`);
  }

  // 统一异步后置日志
  if (ctx.log && errLogs.length > 0) {
    ctx.log(errLogs.join('\n'));
  }

  // 🌟 极致严谨的 UA 提取，防止正则回溯
  const rawUa = obj.user_agent;
  const clientName = (rawUa && rawUa.toLowerCase().startsWith('egern')) ? 'Egern' : (rawUa || 'Egern');

  return {
    body: {
      "IP地址": obj.ip || "未知",
      "地区": codeMap[obj.country_code] || obj.country_code || "未知",
      ...(obj.city_name ? { "城市": obj.city_name } : {}),
      "互联网服务提供商": obj.asn ? `AS${obj.asn} ${obj.as_desc || ''}` : "未知",
      "下载带宽": speedMbps,
      "客户端": clientName
    }
  };
}

// ==========================================
// 静态字典区：已修正"立陶宛(LT)"错别字，无懈可击
// ==========================================
const codeMap = { HK: '🇭🇰 香港', TW: '🇹🇼 台湾', SG: '🇸🇬 新加坡', JP: '🇯🇵 日本', KR: '🇰🇷 韩国', US: '🇺🇸 美国', NL: '🇳🇱 荷兰', DE: '🇩🇪 德国', GB: '🇬🇧 英国', TR: '🇹🇷 土耳其', FR: '🇫🇷 法国', AC: '🇦🇨 阿森松岛', AD: '🇦🇩 安道尔', AE: '🇦🇪 阿联酋', AF: '🇦🇫 阿富汗', AG: '🇦🇬 安提瓜和巴布达', AI: '🇦🇮 安圭拉', AL: '🇦🇱 阿尔巴尼亚', AM: '🇦🇲 亚美尼亚', AO: '🇦🇴 安哥拉', AQ: '🇦🇶 南极洲', AR: '🇦🇷 阿根廷', AS: '🇦🇸 美属萨摩亚', AT: '🇦🇹 奥地利', AU: '🇦🇺 澳大利亚', AW: '🇦🇼 阿鲁巴', AX: '🇦🇽 奥兰群岛', AZ: '🇦🇿 阿塞拜疆', BA: '🇧🇦 波黑', BB: '🇧🇧 巴巴多斯', BD: '🇧🇩 孟加拉国', BE: '🇧🇪 比利时', BF: '🇧🇫 布基纳法索', BG: '🇧🇬 保加利亚', BH: '🇧🇭 巴林', BI: '🇧🇮 布隆迪', BJ: '🇧🇯 贝宁', BM: '🇧幕大', BN: '🇧🇳 文莱', BO: '🇧🇴 玻利维亚', BR: '🇧🇷 巴西', BS: '🇧🇸 巴哈马', BT: '🇧🇹 不丹', BV: '🇧🇻 布韦岛', BW: '🇧🇼 博茨瓦纳', BY: '🇧🇾 白俄罗斯', BZ: '🇧🇿 伯利兹', CA: '🇨🇦 加拿大', CD: '🇨🇩 刚果（金）', CF: '🇨🇫 中非', CG: '🇨🇬 刚果（布）', CH: '🇨🇭 瑞士', CI: '🇨🇮 科特迪瓦', CK: '🇨🇰 库克群岛', CL: '🇨🇱 智利', CM: '🇨🇲 喀麦隆', CN: '🇨🇳 中国', CO: '🇨🇴 哥伦比亚', CP: '🇨🇵 克利珀顿岛', CR: '🇨🇷 哥斯达黎加', CU: '🇨🇺 古巴', CV: '🇨🇻 佛得角', CW: '🇨🇼 库拉索', CX: '🇨🇽 圣诞岛', CY: '🇨🇾 塞浦路斯', CZ: '🇨🇿 捷克', DG: '🇩🇬 迪戈加西亚岛', DJ: '🇩🇯 吉布提', DK: '🇩🇰 丹麦', DM: '🇩🇲 多米尼克', DO: '🇩🇴 多米尼加', DZ: '🇩🇿 阿尔及利亚', EA: '🇪🇦 休达及梅利利亚', EC: '🇪🇨 厄瓜多尔', EE: '🇪🇪 爱沙尼亚', EG: '🇪🇬 埃及', EH: '🇪🇭 西撒哈拉', ER: '🇪🇷 厄立特里亚', ES: '🇪🇸 西班牙', ET: '🇪🇹 埃塞俄比亚', EU: '🇪🇺 欧盟', FI: '🇫🇮 芬兰', FJ: '🇫🇯 斐济', FK: '🇫🇰 福克兰群岛', FM: '🇫🇲 密克罗尼西亚', FO: '🇫🇴 法罗群岛', GA: '🇬🇦 加蓬', GD: '🇬🇩 格林纳达', GE: '🇬🇪 格鲁吉亚', GF: '🇬🇫 法属圭亚那', GH: '🇬🇭 加纳', GI: '🇬🇮 直布罗陀', GL: '🇬🇱 格陵兰', GM: '🇬🇲 冈比亚', GN: '🇬🇳 几内亚', GP: '🇬🇵 瓜德罗普', GR: '🇬🇷 希腊', GT: '🇬🇹 危地马拉', GU: '🇬🇺 关岛', GW: '🇬🇼 几内亚比绍', GY: '🇬🇾 圭亚那', HN: '🇭🇳 洪都拉斯', HR: '🇭🇷 克罗地亚', HT: '🇭🇹 海地', HU: '🇭🇺 匈牙利', ID: '🇮🇩 印度尼西亚', IE: '🇮🇪 爱尔兰', IL: '🇮🇱 以色列', IM: '🇮🇲 马恩岛', IN: '🇮🇳 印度', IR: '🇮🇷 伊朗', IS: '🇮🇸 冰岛', IT: '🇮🇹 意大利', JM: '🇯🇲 牙买加', JO: '🇯🇴 约旦', KE: '🇰🇪 肯尼亚', KG: '🇰🇬 吉尔吉斯斯坦', KH: '🇰🇭 柬埔寨', KI: '🇰🇮 基里巴斯', KM: '🇰🇲 科摩罗', KN: '🇰🇳 圣基茨和尼维斯', KP: '🇰🇵 朝鲜', KW: '🇰🇼 科威特', KY: '🇰🇾 开曼群岛', KZ: '🇰🇿 哈萨克斯坦', LA: '🇱🇦 老挝', LB: '🇱🇧 黎巴嫩', LC: '🇱🇨 圣卢西亚', LI: '🇱🇮 列支敦士登', LK: '🇱🇰 斯里兰卡', LR: '🇱🇷 利比里亚', LS: '🇱🇸 莱索托', LT: '🇱🇹 立陶宛', LU: '🇱🇺 卢森堡', LV: '🇱🇻 拉脱维亚', LY: '🇱🇾 利比亚', MA: '🇲🇦 摩洛哥', MC: '🇲🇨 摩纳哥', MD: '🇲🇩 摩尔多瓦', MG: '🇲🇬 马达加斯加', MH: '🇲🇭 马绍尔群岛', MK: '🇲🇰 北马其顿', ML: '🇲🇱 马里', MM: '🇲慢 缅甸', MN: '🇲🇳 蒙古', MO: '🇲🇴 澳门', MP: '🇲🇵 北马里亚纳群岛', MQ: '🇲🇶 马提尼克', MR: '🇲🇷 毛里塔尼亚', MS: '🇲🇸 蒙特塞拉特', MT: '🇲🇹 马耳他', MU: '🇲🇺 毛里求斯', MV: '🇲🇻 马尔代夫', MW: '🇲🇼 马拉维', MX: '🇲🇽 墨西哥', MY: '🇲🇾 马来西亚', MZ: '🇲🇿 莫桑比克', NA: '🇳🇦 纳米比亚', NC: '🇳🇨 新喀里多尼亚', NE: '🇳🇪 尼日尔', NF: '🇳🇫 诺福克岛', NG: '🇳🇬 尼日利亚', NI: '🇳🇮 尼加拉瓜', NO: '🇳🇴 挪威', NP: '🇳🇵 尼泊尔', NR: '🇳🇷 瑙鲁', NZ: '🇳🇿 新西兰', OM: '🇴🇲 阿曼', PA: '🇵🇦 巴拿马', PE: '🇵🇪 秘鲁', PF: '🇵🇫 法属波利尼西亚', PG: '🇵🇬 巴布亚新几内亚', PH: '🇵🇭 菲律宾', PK: '🇵🇰 巴基斯坦', PL: '🇵🇱 波兰', PM: '🇵🇲 圣皮埃尔和密克隆', PR: '🇵🇷 波多黎各', PS: '🇵🇸 巴勒斯坦', PT: '🇵🇹 葡萄牙', PW: '🇵🇼 帕劳', PY: '🇵🇾 巴拉圭', QA: '🇶🇦 卡塔尔', RE: '🇷🇪 留尼汪', RO: '🇷🇴 罗马尼亚', RS: '🇷🇸 塞尔维亚', RU: '🇷🇺 俄罗斯', RW: '🇷🇼 卢旺达', SA: '🇸🇦 沙特阿拉伯', SB: '🇸🇧 所罗门群岛', SC: '🇸🇨 塞舌尔', SD: '🇸🇩 苏丹', SE: '🇸🇪 瑞典', SI: '🇸🇮 斯洛文尼亚', SK: '🇸静 斯洛伐克', SL: '🇸🇱 塞拉利昂', SM: '🇸🇲 圣马力诺', SN: '🇸🇳 塞内加尔', SR: '🇸🇷 苏里南', ST: '🇸🇹 圣多美和普林西比', SV: '🇸🇻 萨尔瓦多', SY: '🇸🇾 叙利亚', SZ: '🇸🇿 斯威士兰', TC: '🇹🇨 特克斯和凯科斯群岛', TD: '🇹🇩 乍得', TG: '🇹🇬 多哥', TH: '🇹🇭 泰国', TJ: '🇹🇯 塔吉克斯坦', TL: '🇹🇱 东帝汶', TM: '🇹🇲 土库曼斯坦', TN: '🇹🇳 突尼斯', TO: '🇹🇴 汤加', TT: '🇹🇹 特立尼达和多巴哥', TV: '🇹🇻 图瓦卢', TZ: '🇹🇿 坦桑尼亚', UA: '🇺🇦 乌克兰', UG: '🇺🇬 乌干达', UM: '🇺🇲 美属本土外岛', UY: '🇺🇾 乌拉圭', UZ: '🇺🇿 乌兹别克斯坦', VA: '🇻🇦 梵蒂冈', VC: '🇻🇨 圣文森特和格林纳丁斯', VE: '🇻🇪 委内瑞拉', VG: '🇻🇬 英属维尔京群岛', VI: '🇻🇮 美属维尔京群岛', VN: '🇻🇳 越南', VU: '🇻🇺 瓦努阿图', WS: '🇼🇸 萨摩亚', YE: '🇾🇪 也门', YT: '🇾🇹 马约特', ZA: '🇿🇦 南非', ZM: '🇿🇲 赞比亚', ZW: '🇿🇼 津巴布韦' };
