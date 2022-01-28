// DoH网络白名单脚本 AutoDoH = type=event,event-name=network-changed,timeout=7,script-path=https://raw.githubusercontent.com/unknowntokyo/surge-list/master/Surge/AutoDoH.js,script-update-interval=86400

const Whitessid1 = "L";
const Whitessid2 = "Linksys";
const Whitessid3 = "Linksys_5G";
const Whitessid4 = "WhiteSSID4";
const Whitessid5 = "WhiteSSID5";
const name = "DNS over HTTPS";
let ExcludeArea = ($network.wifi.ssid === Whitessid1) || ($network.wifi.ssid === Whitessid2) || ($network.wifi.ssid === Whitessid3) || ($network.wifi.ssid === Whitessid4) || ($network.wifi.ssid === Whitessid5);

const getModuleStatus = new Promise((resolve) => {
  $httpAPI("GET", "v1/modules", null, (data) =>
	  resolve(data.enabled.includes(name))
  );
});

getModuleStatus.then((enabled) => {
  if (!ExcludeArea && !enabled) {
    //在非白名单网络环境下,开启DoH
	enableModule(true);
  } else if (ExcludeArea && enabled) {
    //在白名单网络环境下,关闭DoH
	enableModule(false);
  } else {
	//其他情況 => 重复触发 => 结束
	$done();
  }
});

function enableModule(status) {
  $httpAPI("POST", "v1/modules", { [name]: status }, () => $done());
}