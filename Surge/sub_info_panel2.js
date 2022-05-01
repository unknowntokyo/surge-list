(async () => {
  let args = getArgs();
  let info = await getDataInfo(args.url);
  if (!info) $done();
  let resetDayLeft = getRmainingDays(parseInt(args["reset_day"]));
  let used = info.download + info.upload;
  let total = info.total;
  let proportion = used / total;
  
  //YTOO已使用流量超过85GB, Proxy策略组自动切换至Texon's Lab策略；已使用流量不足85GB时, 默认使用Load-Balance策略。
  let usedTraffic = bytesToSize(used).replace("GB", "");
  let groupName = (await httpAPI("/v1/policy_groups/select?group_name="+encodeURIComponent("Proxy")+"")).policy; 
  switch (groupName){
    case "Load-Balance":
      if (usedTraffic >85) {
      $surge.setSelectGroupPolicy("Proxy", "Texon's Lab");
      }
      break; 
    case "Texon's Lab":
      if (usedTraffic <= 85) {
      $surge.setSelectGroupPolicy("Proxy", "Load-Balance");
      }
      break;
    case "AutoGroup":
      if (usedTraffic >85) {
      $surge.setSelectGroupPolicy("Proxy", "Texon's Lab");
      }
      break; 
    case "FallBack":
      if (usedTraffic >85) {
      $surge.setSelectGroupPolicy("Proxy", "Texon's Lab");
      }
      break; 
    default:
  }
  let expire = args.expire || info.expire;
  let content = [`用量: ${bytesToSize(used)} | ${bytesToSize(total)}`];
  if (resetDayLeft) {
    content.push(`重置: 剩余${resetDayLeft}天`);
  }
  if (expire && expire !== "false") {
    if (/^[\d.]+$/.test(expire)) expire *= 1000;
    content.push(`到期: ${formatTime(expire)}`);
  }

  $done({
    title: `${args.title} | ${toPercent(proportion)}`,
    content: content.join("\n"),
    icon: args.icon || "airplane.circle",
    "icon-color": args.color || "#007aff",
  });
})();

function getArgs() {
  return Object.fromEntries(
    $argument
      .split("&")
      .map((item) => item.split("="))
      .map(([k, v]) => [k, decodeURIComponent(v)])
  );
}

function getUserInfo(url) {
  let request = { headers: { "User-Agent": "Quantumult%20X" }, url };
  return new Promise((resolve, reject) =>
    $httpClient.get(request, (err, resp) => {
      if (err != null) {
        reject(err);
        return;
      }
      if (resp.status !== 200) {
        reject(resp.status);
        return;
      }
      let header = Object.keys(resp.headers).find(
        (key) => key.toLowerCase() === "subscription-userinfo"
      );
      if (header) {
        resolve(resp.headers[header]);
        return;
      }
      reject("链接响应头不带有流量信息");
    })
  );
}

async function getDataInfo(url) {
  const [err, data] = await getUserInfo(url)
    .then((data) => [null, data])
    .catch((err) => [err, null]);
  if (err) {
    console.log(err);
    return;
  }

  return Object.fromEntries(
    data
      .match(/\w+=[\d.eE+]+/g)
      .map((item) => item.split("="))
      .map(([k, v]) => [k, Number(v)])
  );
}

function getRmainingDays(resetDay) {
  if (!resetDay) return;

  let now = new Date();
  let today = now.getDate();
  let month = now.getMonth();
  let year = now.getFullYear();
  let daysInMonth;

  if (resetDay > today) {
    daysInMonth = 0;
  } else {
    daysInMonth = new Date(year, month + 1, 0).getDate();
  }

  return daysInMonth - today + resetDay;
}

function bytesToSize(bytes) {
  if (bytes === 0) return "0B";
  let k = 1024;
  sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  let i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
}

function formatTime(time) {
  let dateObj = new Date(time);
  let year = dateObj.getFullYear();
  let month = dateObj.getMonth() + 1;
  let day = dateObj.getDate();
  return year + "年" + month + "月" + day + "日";
};

function httpAPI(path = "", method = "GET", body = null) {
    return new Promise((resolve) => {
        $httpAPI(method, path, body, (result) => {
            resolve(result);
        });
    });
}

function toPercent(proportion) {
  const percent = Number(proportion*100).toFixed(0);
  return percent + "%";
}