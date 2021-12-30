let url = $request.url;
let headers = $request.headers;
if (url.indexOf("github.com") !== -1) {
	if (headers["User-Agent"].indexOf("iPhone") !== -1)
		headers["User-Agent"] =
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/604.3.5 (KHTML, like Gecko) Version/13.0 Safari/604.1";
}
$done({ headers });