const ssid1 = "Linksys_5G";
const ssid2 = "SSID2";
const name = "DNS over HTTPS";
let home = ($network.wifi.ssid === ssid1) || ($network.wifi.ssid === ssid2);

const getModuleStatus = new Promise((resolve) => {
  $httpAPI("GET", "v1/modules", null, (data) =>
	  resolve(data.enabled.includes(name))
  );
});

getModuleStatus.then((enabled) => {
  if (home && enabled) {
    //家里,关闭模块
	enableModule(false);
  } else if (!home && !enabled) {
    //不在家里,开启模块
	enableModule(true);
  } else {
	//其他情況 => 重复触发 => 结束
	$done();
  }
});

function enableModule(status) {
  $httpAPI("POST", "v1/modules", { [name]: status }, () => $done());
}