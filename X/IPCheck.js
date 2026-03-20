if ($response.statusCode !== 200) {
  $done(null);
}
var obj = JSON.parse($response.body);
var ip = obj['ip'];
var city = obj['city_name'] || 'unknown';
var asn = 'AS' + obj['asn'];
var datacenter = obj['as_desc'];
datacenter = datacenter.replace(/,/g, ' ').replace(/\./g, '').replace(/\([^\)]*\)/g, "");
if (datacenter.length >= 35) {
    datacenter = datacenter.replace(/(?: Limited| LLC| LTD| GmbH|, Inc|, Inc\.| Corporation| Co\.,\s*Ltd\.| PTE LTD)/ig, "");
}
var subtitle = asn + ' ' + datacenter;

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
  'IDC: ' + datacenter + '\n' +
  'ASN: ' + asn + '\n' +
  'City: ' + city + '\n' +
  '─────────────';

$done({ title, subtitle, ip, description });
