// AutoDoH = type=event,event-name=network-changed,timeout=7,script-path=https://raw.githubusercontent.com/unknowntokyo/surge-list/master/Surge/AutoDoH.js,script-update-interval=86400

const ssid1 = "Linksys_Test";
const ssid2 = "Test2";
const name = "DNS over HTTPS";
let Workplace = ($network.wifi.ssid === ssid1) || ($network.wifi.ssid === ssid2);

const getModuleStatus = new Promise((resolve) => {
  $httpAPI("GET", "v1/modules", null, (data) =>
	  resolve(data.enabled.includes(name))
  );
});

getModuleStatus.then((enabled) => {
  if (Workplace && !enabled) {
    //在公司网络环境下,开启DoH
	enableModule(true);
  } else if (!Workplace && enabled) {
    //在移动网络/非公司网络环境下,关闭DoH
	enableModule(false);
  } else {
	//其他情況 => 重复触发 => 结束
	$done();
  }
});

function enableModule(status) {
  $httpAPI("POST", "v1/modules", { [name]: status }, () => $done());
}