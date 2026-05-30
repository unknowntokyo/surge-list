export default async function(ctx) {
  const POLICY = ctx.env.policy || 'DIRECT';

  const getFraudScore = () => {
    return new Promise((resolve) => {
      $httpClient.get({
        url: 'https://my.ippure.com/v1/info',
        timeout: 4000,
        policy: POLICY
      }, (error, response, data) => {
        if (error) {
          resolve(null);
          return;
        }
        
        try {
          const resObj = typeof data === 'object' ? data : JSON.parse(data);
          if (resObj && resObj.fraudScore !== undefined) {
            resolve(resObj.fraudScore);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });
  };

  const risk = await getFraudScore();
  
  let riskTxt = "获取失败";
  if (risk !== undefined && risk !== null) {
    if (risk >= 80) {
      riskTxt = `极高风险 (${risk})`;
    } else if (risk >= 70) {
      riskTxt = `高风险 (${risk})`;
    } else if (risk >= 40) {
      riskTxt = `中等风险 (${risk})`;
    } else {
      riskTxt = `纯净低危 (${risk})`;
    }
  }
  
  try {
    const obj = JSON.parse($response.body);
    const codeMap = { HK: 'HKG', TW: 'TWN', SG: 'SGP', JP: 'JPN', KR: 'KOR', US: 'USA', NL: 'NED', DE: 'GER' };
    let countryCode = codeMap[obj.country_code] || obj.country_code || "未知";
    
    const myObj = {
        "IP": obj.ip,
        "地区": countryCode,
        "城市": obj.city_name,
        "组织": "AS" + obj.asn + " " + (obj.as_desc || ""),
        "风险评级": riskTxt
    };

    if (!obj.city_name || obj.city_name.trim() === "") {
        delete myObj["城市"];
    }
    
    $done({
        body: JSON.stringify(myObj) 
    });
  } catch (e) {
    $done({ body: $response.body });
  }
}