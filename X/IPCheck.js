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
var ioc = new Map([["AD","AND"],["AE","UAE"],["AF","AFG"],["AG","ANT"],["AL","ALB"],["AM","ARM"],["AO","ANG"],["AR","ARG"],["AS","ASA"],["AT","AUT"],["AU","AUS"],["AW","ARU"],["AZ","AZE"],["BA","BIH"],["BB","BAR"],["BD","BAN"],["BE","BEL"],["BF","BUR"],["BG","BUL"],["BH","BRN"],["BI","BDI"],["BJ","BEN"],["BM","BER"],["BN","BRU"],["BO","BOL"],["BR","BRA"],["BS","BAH"],["BT","BHU"],["BW","BOT"],["BY","BLR"],["BZ","BIZ"],["CA","CAN"],["CD","COD"],["CF","CAF"],["CG","CGO"],["CH","SUI"],["CI","CIV"],["CK","COK"],["CL","CHI"],["CM","CMR"],["CN","CHN"],["CO","COL"],["CR","CRC"],["CU","CUB"],["CV","CPV"],["CY","CYP"],["CZ","CZE"],["DE","GER"],["DJ","DJI"],["DK","DEN"],["DM","DMA"],["DO","DOM"],["DZ","ALG"],["EC","ECU"],["EE","EST"],["EG","EGY"],["ER","ERI"],["ES","ESP"],["ET","ETH"],["FI","FIN"],["FJ","FIJ"],["FR","FRA"],["GA","GAB"],["GB","GBR"],["GD","GRN"],["GE","GEO"],["GH","GHA"],["GM","GAM"],["GN","GUI"],["GQ","GEQ"],["GR","GRE"],["GT","GUA"],["GU","GUM"],["GW","GBS"],["GY","GUY"],["HK","HKG"],["HN","HON"],["HR","CRO"],["HT","HAI"],["HU","HUN"],["ID","INA"],["IE","IRL"],["IL","ISR"],["IN","IND"],["IQ","IRQ"],["IR","IRI"],["IS","ISL"],["IT","ITA"],["JM","JAM"],["JO","JOR"],["JP","JPN"],["KE","KEN"],["KG","KGZ"],["KH","CAM"],["KI","KIR"],["KM","COM"],["KN","SKN"],["KR","KOR"],["KW","KUW"],["KY","CAY"],["KZ","KAZ"],["LA","LAO"],["LB","LBN"],["LC","LCA"],["LI","LIE"],["LK","SRI"],["LR","LBR"],["LS","LES"],["LT","LTU"],["LU","LUX"],["LV","LAT"],["LY","LBA"],["MA","MAR"],["MC","MON"],["MD","MDA"],["ME","MNE"],["MG","MAD"],["MH","MHL"],["MK","MKD"],["ML","MLI"],["MM","MYA"],["MN","MGL"],["MR","MTN"],["MT","MLT"],["MU","MRI"],["MV","MDV"],["MW","MAW"],["MX","MEX"],["MY","MAS"],["MZ","MOZ"],["NA","NAM"],["NE","NIG"],["NG","NGR"],["NI","NCA"],["NL","NED"],["NO","NOR"],["NR","NRU"],["NZ","NZL"],["OM","OMA"],["PA","PAN"],["PE","PER"],["PG","PNG"],["PH","PHI"],["PK","PAK"],["PL","POL"],["PR","PUR"],["PS","PLE"],["PT","POR"],["PW","PLW"],["PY","PAR"],["QA","QAT"],["RO","ROU"],["RS","SRB"],["RU","RUS"],["RW","RWA"],["SA","KSA"],["SB","SOL"],["SC","SEY"],["SD","SUD"],["SE","SWE"],["SG","SGP"],["SI","SLO"],["SK","SVK"],["SL","SLE"],["SM","SMR"],["SN","SEN"],["SO","SOM"],["SR","SUR"],["SS","SSD"],["ST","STP"],["SV","ESA"],["SY","SYR"],["SZ","SWZ"],["TD","CHA"],["TG","TOG"],["TH","THA"],["TJ","TJK"],["TL","TLS"],["TM","TKM"],["TN","TUN"],["TO","TGA"],["TR","TUR"],["TT","TTO"],["TV","TUV"],["TW","TPE"],["TZ","TAN"],["UA","UKR"],["UG","UGA"],["US","USA"],["UY","URU"],["UZ","UZB"],["VC","VIN"],["VE","VEN"],["VG","IVB"],["VN","VIE"],["VU","VAN"],["WS","SAM"],["YE","YEM"],["ZA","RSA"],["ZM","ZAM"],["ZW","ZIM"]]);
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