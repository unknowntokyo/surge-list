export default async function(ctx) {
  const POLICY = ctx.env.policy || 'DIRECT';

  let d = {};
  try {
    const res = await ctx.http.get('https://my.ippure.com/v1/info', {
        timeout: 4000,
        policy: POLICY
    });      
    d = typeof res.body === 'object' ? res.body : JSON.parse(await res.text());
  } catch (e) {}

  const risk = d.fraudScore;
  let riskTxt = "获取失败", riskIc = "questionmark.shield.fill";
  if (risk !== undefined) {
    if (risk >= 80) {
      riskTxt = `极高风险 (${risk})`;
      riskIc = "xmark.shield.fill";
    }
    else if (risk >= 70) {
      riskTxt = `高风险 (${risk})`;
      riskIc = "exclamationmark.shield.fill";
    }
    else if (risk >= 40) {
      riskTxt = `中等风险 (${risk})`;
      riskIc = "exclamationmark.shield.fill";
    }
    else {
      riskTxt = `纯净低危 (${risk})`;
      riskIc = "checkmark.shield.fill";
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
        "风险评级": riskIc + " " + riskTxt,
        "组织": "AS" + obj.asn + " " + (obj.as_desc || "")
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