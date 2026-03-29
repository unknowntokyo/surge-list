if ($response.statusCode !== 200) $done(null);
let obj = JSON.parse($response.body);
let ip = obj.ip;
let city = obj.city_name || 'unknown';
let asn = 'AS' + obj.asn;
let asName = obj.as_desc;
// 一次正则遍历完成所有字符替换：移除括号内容，并将逗号替换为空格、删除点号
asName = asName.replace(/\([^\)]*\)|[,.]/g, match => {
    if (match === '(') return '';
    if (match === ',') return ' ';
    return '';
});
let subtitle = `${asn} ${asName}`;
if (subtitle.length > 30) {
    subtitle = subtitle.split(' ').slice(0, 4).join(' ');
    if (subtitle.length > 30) {
        subtitle = subtitle.split(' ').slice(0, 3).join(' ');
    }
}
const codeMap = { HK: 'HKG', TW: 'TPE', SG: 'SGP', JP: 'JPN', KR: 'KOR', US: 'USA', NL: 'NED', DE: 'GER' };
let countryCode = codeMap[obj.country_code] || obj.country_code;
let title = ` ${countryCode}`;
let description = `-------------------------------------\nIP: ${ip}\nOrg: ${asName}\nASN: ${asn}\nCity: ${city}\n-------------------------------------`;
$done({ title, subtitle, ip, description });
