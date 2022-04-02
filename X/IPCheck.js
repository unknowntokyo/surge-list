var body = $response.body;
var obj = JSON.parse(body);
var subtitle = obj['org'];
var ip = obj['query'];
var carrier = obj['isp'];
var city = obj['city'];
var datacenter = obj['org'];
var title = '' + ' '+ obj['country'];
switch (datacenter){
    case "":
      if (carrier != "") {
      var description = 'IP地址：' + ip + '\n运营商：' + carrier + '\n城市：' +city;
      subtitle = carrier
      } else {
      var description = 'IP地址：' + ip + '\n城市：' +city;
      subtitle = ip;
      }
      break;
    default:
      if (carrier != "" && carrier != datacenter) {
      var description = 'IP地址：' + ip + '\n运营商：' + carrier + '\n数据中心：' + datacenter;
      } else {
      var description = 'IP地址：' + ip + '\n数据中心：' + datacenter + '\n城市：' +city;
      }
  }
  $done({title, subtitle, ip, description});