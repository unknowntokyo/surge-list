let url = $request.url;
let headers = $request.headers;
if (url.indexOf("ip138.com") !== -1) {
	if (headers["User-Agent"].indexOf("iPhone") !== -1)
		headers["User-Agent"] =
			"Mozilla/5.0 (Windows NT 6.3; Win64, x64; Trident/7.0; rv:11.0) like Gecko";
}
$done({ headers });