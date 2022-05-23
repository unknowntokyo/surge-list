var body = $response.body;
var obj = JSON.parse(body);
if (String(obj['org']).length < 35) {
var subtitle = obj['org'];
} else {
var subtitle = String(obj['org']).replace( /\([^\)]*\)/g,"");
  if (subtitle.length >= 35) {
   subtitle = subtitle.replace(" Limited","");
  }
}
var ip = obj['query'];
var carrier = obj['isp'];
var city = obj['city'];
var datacenter = subtitle;
var ioc = new Map([["AE","UAE"],["AR","ARG"],["AU","AUS"],["BR","BRA"],["CA","CAN"],["CN","CHN"],["CZ","CZE"],["DE","DER"],["ES","ESP"],["FR","FRA"],["GB","GBR"],["HK","HKG"],["HU","HUN"],["ID","INA"],["IL","ISR"],["IN","IND"],["IT","ITA"],["JP","JPN"],["KR","KOR"],["MY","MAS"],["NL","NED"],["PH","PHI"],["RU","RUS"],["SG","SGP"],["TH","THA"],["TR","TUR"],["TW","TPE"],["UA","UKR"],["US","USA"],["VN","VIE"]]);
var title = '' + ' '+ ioc.get(obj['countryCode']);
switch (datacenter){
    case "":
      if (carrier != "") {
      var description = 'IP地址:  ' + ip + '\n运营商:  ' + carrier + '\n城市:  ' + city;
      subtitle = carrier;
      } else {
      var description = 'IP地址:  ' + ip + '\n城市:  ' + city;
      subtitle = ip;
      }
      break;
    default:
      if (carrier != "" && carrier != datacenter) {
      var description = 'IP地址:  ' + ip + '\n运营商:  ' + carrier + '\n数据中心:  ' + datacenter;
      } else {
      var description = 'IP地址:  ' + ip + '\n数据中心:  ' + datacenter + '\n城市:  ' + city;
      }
  }
  $done({title, subtitle, ip, description});