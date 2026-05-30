export default async function(ctx) {
  const POLICY = ctx.env.policy || 'DIRECT';

  // 1. 封装一个绝对可控的 Promise，确保拿到数据才往下走
  const getFraudScore = () => {
    return new Promise((resolve) => {
      $httpClient.get({
        url: 'https://my.ippure.com/v1/info',
        timeout: 4000,
        policy: POLICY
      }, (error, response, data) => {
        if (error) {
          console.log("IPPure 请求发生网络错误: " + error);
          resolve(null);
          return;
        }
        
        try {
          const resObj = typeof data === 'object' ? data : JSON.parse(data);
          if (resObj && resObj.fraudScore !== undefined) {
            resolve(resObj.fraudScore);
          } else {
            console.log("IPPure 返回数据中未找到 fraudScore 字段");
            resolve(null);
          }
        } catch (e) {
          console.log("解析 IPPure 返回体 JSON 失败: " + e);
          resolve(null);
        }
      });
    });
  };

  // 2. 严格等待异步结果
  const risk = await getFraudScore();
  
  let riskTxt = "获取失败", riskIc = "questionmark.shield.fill", icColor = "#8E8E93";
  if (risk !== undefined && risk !== null) {
    if (risk >= 80) {
      riskTxt = `极高风险 (${risk})`;
      riskIc = "xmark.shield.fill";
      icColor = "#FF3B30"; // 红色
    }
    else if (risk >= 70) {
      riskTxt = `高风险 (${risk})`;
      riskIc = "exclamationmark.shield.fill";
      icColor = "#FF9500"; // 橙色
    }
    else if (risk >= 40) {
      riskTxt = `中等风险 (${risk})`;
      riskIc = "exclamationmark.shield.fill";
      icColor = "#FFCC00"; // 黄色
    }
    else {
      riskTxt = `纯净低危 (${risk})`;
      riskIc = "checkmark.shield.fill";
      icColor = "#34C759"; // 绿色
    }
  }
  
  // 3. 处理原本的响应体
  try {
    const obj = JSON.parse($response.body);
    const codeMap = { HK: 'HKG', TW: 'TWN', SG: 'SGP', JP: 'JPN', KR: 'KOR', US: 'USA', NL: 'NED', DE: 'GER' };
    let countryCode = codeMap[obj.country_code] || obj.country_code || "未知";
    
    const myObj = {
        "IP": obj.ip,
        "地区": countryCode,
        "城市": obj.city_name,
        // 💡 关键修改：将风险评级包装为包含 icon 属性的对象，并附带颜色
        "风险评级": {
            "text": riskTxt,
            "icon": riskIc,
            "icon-color": icColor
        },
        "组织": "AS" + obj.asn + " " + (obj.as_desc || "")
    };

    if (!obj.city_name || obj.city_name.trim() === "") {
        delete myObj["城市"];
    }
    
    $done({
        body: JSON.stringify(myObj) 
    });
  } catch (e) {
    console.log("解析原始响应体失败: " + e);
    $done({ body: $response.body });
  }
}
