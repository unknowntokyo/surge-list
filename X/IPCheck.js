var body = $response.body;
var obj = JSON.parse(body);
var title = '' + ' '+ obj['country'];
var subtitle = obj['org'];
var ip = obj['query'];
var carrier = obj['isp'];
var datacenter = obj['org'];
switch (datacenter){
    case "":
      if (carrier != "") {
      var description = ip + '\n' + carrier;
      } else {
      var description = ip;
      }
      break
    default:
      if (carrier != "") {
      var description = 'IP地址：' + ip + '\n' + '运营商：' + carrier + '\n' + '数据中心：' + datacenter;
      } else {
      var description = ip + '\n' + datacenter;
      }
      break
  }
  $done({title, subtitle, ip, description});