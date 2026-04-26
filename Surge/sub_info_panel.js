(async () => {
  let args = getArgs();

  if (!args.url || args.url === "请填写订阅链接") {
    $done({
      title: args.title || "流量信息获取",
      content: "请在参数设置中填写订阅链接(URL Encode)！",
      icon: "exclamationmark.triangle",
      "icon-color": "#FF3B30",
    });
    return;
  }

  let info = await getDataInfo(args.url);

  if (!info) {
    $done({
      title: args.title || "流量信息获取",
      content: "获取失败！",
      icon: "exclamationmark.triangle",
      "icon-color": "#FF3B30",
    });
    return;
  }

  let resetDayLeft = getRemainingDays(parseInt(args["reset_day"]));

  let used = info.download + info.upload;
  let total = info.total;
  let proportion = used / total;
  let expire = args.expire || info.expire;
  let content = [`用量:  ${bytesToSize(used)} | ${bytesToSize(total)}`];
  if (resetDayLeft) {
    content.push(`重置:  剩余${resetDayLeft}天`);
  }
  if (expire && expire !== "false") {
    if (/^[\d.]+$/.test(expire)) expire *= 1000;
    content.push(`到期:  ${formatTime(expire)}`);
  }

  $done({
    title: `${args.title} | ${toPercent(proportion)}`,
    content: content.join("\n"),
    icon: args.icon || "airplane.circle",
    "icon-color": args.color || "#007aff",
  });
})();

function getArgs() {
  if (typeof $argument === "undefined") return {};
  return Object.fromEntries(
    $argument
      .split("&")
      .map((item) => item.split("="))
      .map(([k, v]) => [k, decodeURIComponent(v)])
  );
        if (arg.title) panel.title = arg.title;
        if (arg.icon) panel.icon = arg.icon;
        if (arg.icon-color) panel.icon-color = arg.icon-color;
        if (arg.reset_day) panel.reset_day = arg.reset_day;
        if (arg.url) panel.url = arg.url;
}

function getUserInfo(url) {
  let request = { headers: { "User-Agent": "Surge" }, url };
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
      .match(/\w+=[\d.eE+-]+/g)
      .map((item) => item.split("="))
      .map(([k, v]) => [k, Number(v)])
  );
}

function getRemainingDays(resetDay) {
  if (!resetDay || isNaN(resetDay)) return;

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
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  let i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
}

function formatTime(time) {
  let dateObj = new Date(time);
  let year = dateObj.getFullYear();
  let month = dateObj.getMonth() + 1;
  let day = dateObj.getDate();
  return year + "年" + month + "月" + day + "日";
}

function toPercent(proportion) {
  const percent = Number(proportion*100).toFixed(0);
  return percent + "%";
}