// AutoDoH = type=event,event-name=network-changed,script-path=https://raw.githubusercontent.com/unknowntokyo/surge-list/master/Surge/AutoDoH.js,script-update-interval=86400

const ssid1 = "Linksys_5G";
const ssid2 = "ZEEKR";
const name = "DNS over HTTPS";
let Workplace = ($network.wifi.ssid === ssid1) || ($network.wifi.ssid === ssid2);

const getModuleStatus = new Promise((resolve) => {
  $httpAPI("GET", "v1/modules", null, (data) =>
	  resolve(data.enabled.includes(name))
  );
});

getModuleStatus.then((enabled) => {
  if (Workplace && !enabled) {
    //在公司WIFI下,开启模块
	enableModule(true);
  } else if (!Workplace && enabled) {
    //非公司WIFI下,关闭模块
	enableModule(false);
  } else {
	//其他情況 => 重复触发 => 结束
	$done();
  }
});

function enableModule(status) {
  $httpAPI("POST", "v1/modules", { [name]: status }, () => $done());
}