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
      var description = 'IP地址：' + ip + '\n运营商：' + carrier;
      } else {
      var description = 'IP地址：' + ip;
      }
      break;
    default:
      if (carrier != "" && carrier != datacenter) {
      var description = 'IP地址：' + ip + '\n运营商：' + carrier + '\n数据中心：' + datacenter;
      } else {
      var description = 'IP地址：' + ip + '\n数据中心：' + datacenter;
      }
  }
  switch (subtitle){
    case "":
        $done({title, ip, description});
      break;
    default:
        $done({title, subtitle, ip, description});
  }