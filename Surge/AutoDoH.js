// DoH SSID 黑名单脚本 AutoDoH = type=event,event-name=network-changed,timeout=7,script-path=https://raw.githubusercontent.com/unknowntokyo/surge-list/master/Surge/AutoDoH.js,script-update-interval=86400

const Banedssid1 = "Linksys_5G";
const Banedssid2 = "BanedSSID2";
const Banedssid3 = "BanedSSID3";
const Banedssid4 = "BanedSSID4";
const Banedssid5 = "BanedSSID5";
const Modulename = "DNS over HTTPS";
const Rulename = "https://raw.githubusercontent.com/unknowntokyo/GFWList/release/GFWList.txt";

// SSID 黑名单
let IncludeArea = ($network.wifi.ssid === Banedssid1) || ($network.wifi.ssid === Banedssid2) || ($network.wifi.ssid === Banedssid3) || ($network.wifi.ssid === Banedssid4) || ($network.wifi.ssid === Banedssid5);

const getModuleStatus = new Promise((resolve) => {
  $httpAPI("GET", "v1/modules", null, (data) =>
	  resolve(data.enabled.includes(Modulename))
  );
});

getModuleStatus.then((enabled) => {
  if (IncludeArea && !enabled) {
    //在 SSID 黑名单网络环境下,开启DoH
	enableModule(true);
	enableRule(false);
  } else if (!IncludeArea && enabled) {
    //在 SSID 白名单网络环境下,关闭DoH
	enableModule(false);
	enableRule(true);
  } else {
	//其他情況 => 重复触发 => 结束
	$done();
  }
});

function enableModule(status) {
  $httpAPI("POST", "v1/modules", { [Modulename]: status }, () => $done());
}

function enableRule(status) {
  $httpAPI("POST", "v1/rules", { [Rulename]: status }, () => $done());
}