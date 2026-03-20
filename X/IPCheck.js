if ($response.statusCode !== 200) {
  $done(null);
}
var obj = JSON.parse($response.body);
var ip = obj['ip'];
var city = obj['city_name'] || 'unknown';
var asn = 'AS' + obj['asn'];
var datacenter = obj['as_desc'];
var subtitle = String(asn + ' ' + datacenter).replace(/,/g, ' ').replace(/\./g, '').replace(/\([^\)]*\)/g, "");
if (subtitle.length >= 50) {
    subtitle = subtitle.replace(/(?: Limited| LLC| LTD| GmbH|, Inc|, Inc\.| Corporation| Co\.,\s*Ltd\.| PTE LTD)/ig, "");
}

var CountryCode = new Map([
    ["HK", "HKG"],
    ["TW", "TPE"],
    ["SG", "SGP"],
    ["JP", "JPN"],
    ["KR", "KOR"],
    ["US", "USA"],
    ["NL", "NED"]
]);

var title = '' + ' ' + CountryCode.get(obj['country_code']);
var description = 
  '─────────────\n' +
  'IP: ' + ip + '\n' +
  '数据中心: ' + datacenter + '\n' +
  'ASN: ' + asn + '\n' +
  '城市: ' + city + '\n' +
  '─────────────';

$done({ title, subtitle, ip, description });
