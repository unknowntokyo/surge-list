if ($response.statusCode !== 200) {
  $done(null);
}
var obj = JSON.parse($response.body);
var ip = obj['ip'];
var city = obj['city_name'] || 'unknown';
var asn = 'AS' + obj['asn'];
var datacenter = obj['as_desc'];
datacenter = datacenter.replace(/,/g, ' ').replace(/\./g, '').replace(/\([^\)]*\)/g, "");
var subtitle = asn + ' ' + datacenter;
if (subtitle.length >= 50) {
    subtitle = subtitle.replace(/(?: Limited| LLC| LTD| GmbH|, Inc|, Inc\.| Corporation| Co\.,\s*Ltd\.| PTE LTD)/ig, "");
}

var CountryCodeMap = new Map([
    ["HK", "HKG"],
    ["TW", "TPE"],
    ["SG", "SGP"],
    ["JP", "JPN"],
    ["KR", "KOR"],
    ["US", "USA"],
    ["NL", "NED"]
]);

var CountryCode = CountryCodeMap.get(obj['country_code']) || obj['country_code'];
var title = '' + ' ' + CountryCode;
var description = 
  '─────────────\n' +
  'IP: ' + ip + '\n' +
  '数据中心: ' + datacenter + '\n' +
  'ASN: ' + asn + '\n' +
  '城市: ' + city + '\n' +
  '─────────────';

$done({ title, subtitle, ip, description });
