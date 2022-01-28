// AutoDoH = type=event,event-name=network-changed,script-path=https://raw.githubusercontent.com/unknowntokyo/surge-list/master/Surge/AutoDoH.js,script-update-interval=86400
!(async () => {
let ssid1;
    ssid2;
const name = "DNS over HTTPS";
    if (typeof $argument != "undefined") {
        let arg = Object.fromEntries($argument.split("&").map((item) => item.split("=")));
        if (arg.ssid1) ssid1 = arg.ssid1;
        if (arg.ssid2) ssid2 = arg.ssid2;
    }
let Workplace = ($network.wifi.ssid === ssid1) || ($network.wifi.ssid === ssid2);

const getModuleStatus = new Promise((resolve) => {
  $httpAPI("GET", "v1/modules", null, (data) =>
	  resolve(data.enabled.includes(name))
  );
});

getModuleStatus.then((enabled) => {
  if (Workplace && !enabled) {
    //在公司无线网络下,开启模块
	enableModule(true);
  } else if (!Workplace && enabled) {
    //在家里,关闭模块
	enableModule(false);
  } else {
	//其他情況 => 重复触发 => 结束
	$done();
  }
});

function enableModule(status) {
  $httpAPI("POST", "v1/modules", { [name]: status }, () => $done());
}
}