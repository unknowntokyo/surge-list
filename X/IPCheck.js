var body = $response.body;
var obj = JSON.parse(body);
var title = '' + ' '+ obj['country'];
var subtitle = obj['org'];
var ip = obj['query'];
var description = obj['query'];

$done({title, subtitle, ip, description});