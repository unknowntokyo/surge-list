;(async () => {

let params = getParams($argument)
//获取节点名
let group = params.group
let rootName = (await httpAPI("/v1/policy_groups/select?group_name="+encodeURIComponent(group)+"")).policy;

$httpClient.get('http://ip-api.com/json/?lang=en', function (error, response, data) {
    const jsonData = JSON.parse(data);
    $done({
      title:"节点信息："+rootName,
      content:
		`IP地址：${jsonData.query}\n`+
      `运营商：★ ${jsonData.isp}\n` +
		`数据中心：★ ${jsonData.org}`,
      icon: "checkmark.icloud.fill",
       "icon-color":"#369CF3",
    });
  });

})();

function httpAPI(path = "", method = "GET", body = null) {
    return new Promise((resolve) => {
        $httpAPI(method, path, body, (result) => {
            resolve(result);
        });
    });
};

function getParams(param) {
  return Object.fromEntries(
    $argument
      .split("&")
      .map((item) => item.split("="))
      .map(([k, v]) => [k, decodeURIComponent(v)])
  );
}