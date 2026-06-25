/*
\ 
\ 网上国网 SGCC 用电小组件 for Egern
\
\ 依赖数据接口：
\ https://api.wsgw-rewrite.com/electricity/bill/all
\
\ 环境变量：
\ API_URL: 可选，默认 https://api.wsgw-rewrite.com/electricity/bill/all
\ ACCOUNT_INDEX: 可选，多户号时选择第几个，默认 0
\ REFRESH_MINUTES: 可选，刷新间隔分钟，默认 60
\ SHOW_NAME: 可选，是否显示户名/户号信息，默认 true
\
\ 注意：
\ 需要先让原 95598 脚本的服务接口可用，否则 Widget 无法拿到数据。
\
*/

export default async function (ctx) {
  const env = ctx.env || {};

  const apiUrl = (
    env.API_URL || "https://api.wsgw-rewrite.com/electricity/bill/all"
  ).trim();

  const accountIndex = Math.max(0, parseInt(env.ACCOUNT_INDEX || "0", 10) || 0);
  const refreshMinutes = Math.max(
    10,
    parseInt(env.REFRESH_MINUTES || "60", 10) || 60
  );
  const showName = String(env.SHOW_NAME ?? "true").toLowerCase() !== "false";

  const colors = {
    bg: { light: "#FFFFFF", dark: "#2C2C2E" },
    border: { light: "#E5E5EA", dark: "#3A3A3C" },
    title: { light: "#666666", dark: "#8E8E93" },
    value: { light: "#1C1C1E", dark: "#FFFFFF" },
    time: { light: "#999999", dark: "#666666" },
    error: { light: "#FF3B30", dark: "#FF453A" },
    capsuleBg: { light: "#F5F5F7", dark: "#3A3A3C" },
    accent: { light: "#00A870", dark: "#30D158" },
    blue: { light: "#007AFF", dark: "#0A84FF" },
    orange: { light: "#FF9500", dark: "#FF9F0A" },
  };

  const data = {
    name: "网上国网",
    yst: { title: "昨日用电", value: "--", unit: "度" },
    total: { title: "本月累计", value: "--", unit: "度" },
    bal: { title: "账户余额", value: "--", unit: "元" },
    lastFee: { title: "上期电费", value: "--", unit: "元" },
    yearPower: { title: "年度电量", value: "--", unit: "度" },
    yearCost: { title: "年度电费", value: "--", unit: "元" },
    updateTime: "--:--",
    error: null,
    debugInfo: [],
  };

  if (!apiUrl) {
    data.error = "配置缺失";
    data.debugInfo.push("❌ 未配置 API_URL");
  } else {
    try {
      const url = withQuery(apiUrl, {
        eleBill: "1",
        dayElecQuantity: "1",
        dayElecQuantity31: "1",
        monthElecQuantity: "1",
        lastYearElecQuantity: "1",
      });

      const resp = await ctx.http.get(url, {
        headers: {
          Accept: "application/json",
        },
      });

      const json = await resp.json();
      const list = normalizeResponse(json);
      const item = list[accountIndex] || list[0];

      if (!item) {
        throw new Error("接口未返回户号数据");
      }

      fillData(data, item);
    } catch (e) {
      data.error = "请求失败";
      data.debugInfo.push(`错误: ${e?.message || String(e)}`);
    }
  }

  const family = ctx.widgetFamily;
  const isSmall = family === "systemSmall";
  const isMedium = family === "systemMedium";
  const isLarge = family === "systemLarge" || family === "systemExtraLarge";
  const isAccessory =
    family === "accessoryInline" ||
    family === "accessoryCircular" ||
    family === "accessoryRectangular";

  if (isAccessory) {
    return makeAccessoryWidget(family);
  }

  return {
    type: "widget",
    backgroundColor: colors.bg,
    padding: isSmall ? [10, 12, 10, 12] : [10, 14, 10, 14],
    gap: isSmall ? 6 : 12,
    refreshAfter: new Date(Date.now() + refreshMinutes * 60 * 1000).toISOString(),
    children: [
      makeHeader(),
      makeMainCards(),
      ...(isLarge ? [makeExtraCards()] : []),
      makeBottomIndicator(),
    ],
  };

  function makeHeader() {
    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: isSmall ? 5 : 7,
          children: [
            {
              type: "image",
              src: "sf-symbol:bolt.square.fill",
              color: data.error ? colors.error : colors.accent,
              width: isSmall ? 14 : 18,
              height: isSmall ? 14 : 18,
            },
            {
              type: "text",
              text: isSmall ? "网上国网" : data.name || "网上国网",
              font: {
                size: isSmall ? "subheadline" : "headline",
                weight: "semibold",
              },
              textColor: colors.value,
              maxLines: 1,
              minScale: 0.7,
            },
          ],
        },
        { type: "spacer" },
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 5,
          children: [
            {
              type: "image",
              src: data.error
                ? "sf-symbol:exclamationmark.triangle.fill"
                : "sf-symbol:arrow.clockwise",
              color: data.error ? colors.error : colors.time,
              width: 12,
              height: 12,
            },
            {
              type: "text",
              text: data.error || data.updateTime,
              font: { size: "caption2" },
              textColor: data.error ? colors.error : colors.time,
              maxLines: 1,
            },
          ],
        },
      ],
    };
  }

  function makeMainCards() {
    if (isSmall) {
      return {
        type: "stack",
        direction: "column",
        alignItems: "center",
        gap: 6,
        children: [
          wrapCenter(makeSmallCapsule("昨日", data.yst.value, "度")),
          wrapCenter(makeSmallCapsule("本月", data.total.value, "度")),
          wrapCenter(makeSmallCapsule("余额", data.bal.value, "元", true)),
        ],
      };
    }

    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      gap: 9,
      children: [
        makeCapsule(data.yst.title, data.yst.value, data.yst.unit),
        makeCapsule(data.total.title, data.total.value, data.total.unit),
        makeCapsule(data.bal.title, data.bal.value, data.bal.unit, true),
      ],
    };
  }

  function makeExtraCards() {
    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      gap: 9,
      children: [
        makeCapsule(data.lastFee.title, data.lastFee.value, data.lastFee.unit),
        makeCapsule(data.yearPower.title, data.yearPower.value, data.yearPower.unit),
        makeCapsule(data.yearCost.title, data.yearCost.value, data.yearCost.unit),
      ],
    };
  }

  function makeCapsule(title, value, unit, isBalance = false) {
    const n = parseFloat(value);
    const valueColor =
      isBalance && !Number.isNaN(n) && n < 0 ? colors.error : colors.value;

    return {
      type: "stack",
      direction: "column",
      alignItems: "center",
      flex: 1,
      padding: [8, 10, 8, 10],
      backgroundColor: colors.capsuleBg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      children: [
        {
          type: "text",
          text: title,
          font: { size: "caption2", weight: "medium" },
          textColor: colors.title,
          maxLines: 1,
        },
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 3,
          children: [
            {
              type: "text",
              text: String(value),
              font: { size: "title2", weight: "semibold" },
              textColor: valueColor,
              maxLines: 1,
              minScale: 0.55,
            },
            {
              type: "text",
              text: unit,
              font: { size: "caption2", weight: "regular" },
              textColor: colors.title,
              maxLines: 1,
            },
          ],
        },
      ],
    };
  }

  function makeSmallCapsule(title, value, unit, isBalance = false) {
    const n = parseFloat(value);
    const valueColor =
      isBalance && !Number.isNaN(n) && n < 0 ? colors.error : colors.title;

    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      padding: [6, 14, 6, 14],
      backgroundColor: colors.capsuleBg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      children: [
        {
          type: "text",
          text: `${title} ${value}${unit ? " " + unit : ""}`,
          font: { size: "body", weight: "medium" },
          textColor: valueColor,
          textAlign: "center",
          maxLines: 1,
          minScale: 0.65,
        },
      ],
    };
  }

  function wrapCenter(child) {
    return {
      type: "stack",
      direction: "row",
      children: [{ type: "spacer" }, child, { type: "spacer" }],
    };
  }

  function makeBottomIndicator() {
    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      children: [
        { type: "spacer" },
        {
          type: "stack",
          width: 48,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
        },
        { type: "spacer" },
      ],
    };
  }

  function makeAccessoryWidget(widgetFamily) {
    if (widgetFamily === "accessoryInline") {
      return {
        type: "widget",
        children: [
          {
            type: "text",
            text: data.error
              ? `网上国网 ${data.error}`
              : `网上国网 余额${data.bal.value}元 本月${data.total.value}度`,
            font: { size: "caption1", weight: "medium" },
            textColor: data.error ? colors.error : colors.value,
            maxLines: 1,
          },
        ],
      };
    }

    if (widgetFamily === "accessoryCircular") {
      return {
        type: "widget",
        backgroundColor: colors.bg,
        padding: 6,
        gap: 2,
        children: [
          {
            type: "image",
            src: "sf-symbol:bolt.fill",
            color: data.error ? colors.error : colors.accent,
            width: 18,
            height: 18,
          },
          {
            type: "text",
            text: data.error ? "失败" : `${data.bal.value}`,
            font: { size: "caption2", weight: "semibold" },
            textColor: data.error ? colors.error : colors.value,
            textAlign: "center",
            maxLines: 1,
            minScale: 0.45,
          },
          {
            type: "text",
            text: "元",
            font: { size: "caption2" },
            textColor: colors.title,
            textAlign: "center",
            maxLines: 1,
          },
        ],
      };
    }

    return {
      type: "widget",
      backgroundColor: colors.bg,
      padding: [8, 10, 8, 10],
      gap: 4,
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 5,
          children: [
            {
              type: "image",
              src: "sf-symbol:bolt.square.fill",
              color: data.error ? colors.error : colors.accent,
              width: 14,
              height: 14,
            },
            {
              type: "text",
              text: data.error ? "网上国网异常" : "网上国网",
              font: { size: "caption1", weight: "semibold" },
              textColor: data.error ? colors.error : colors.value,
              maxLines: 1,
            },
          ],
        },
        {
          type: "text",
          text: data.error
            ? data.debugInfo[0] || "请求失败"
            : `余额 ${data.bal.value} 元 · 本月 ${data.total.value} 度`,
          font: { size: "caption2" },
          textColor: data.error ? colors.error : colors.title,
          maxLines: 1,
          minScale: 0.6,
        },
      ],
    };
  }

  function fillData(target, item) {
    const eleBill = item.eleBill || {};
    const userInfo = item.userInfo || {};
    const monthInfo = item.monthElecQuantity || {};
    const lastYearInfo = item.lastYearElecQuantity || {};

    const consName =
      cleanText(userInfo.consName_dst) ||
      cleanText(userInfo.consName) ||
      cleanText(eleBill.consName);

    const consNo =
      cleanText(eleBill.consNo) ||
      cleanText(userInfo.consNo_dst) ||
      cleanText(userInfo.consNo);

    if (showName) {
      if (consName) {
        target.name = consName;
      } else if (consNo) {
        target.name = `户号 ${maskNo(consNo)}`;
      }
    }

    const latestDay = getLatestDailyUsage(item);
    if (latestDay) {
      target.yst.value = fmtNumber(latestDay.value, 2);
      if (latestDay.day) {
        target.yst.title = isYesterday(latestDay.day) ? "昨日用电" : "最近用电";
      }
    }

    const monthTotal = getCurrentMonthTotal(item);
    if (isFiniteNumber(monthTotal)) {
      target.total.value = fmtNumber(monthTotal, 2);
    }

    let balance = firstNumber(
      eleBill.sumMoney,
      eleBill.accountBalance,
      eleBill.balance,
      eleBill.amt
    );

    if (isFiniteNumber(balance)) {
      const arrears = Boolean(item.arrearsOfFees);
      if (arrears && balance > 0) balance = -Math.abs(balance);
      target.bal.value = fmtNumber(balance, 2);
    }

    const lastMonth = lastValid(monthInfo.mothEleList || monthInfo.monthEleList || []);
    if (lastMonth) {
      const fee = firstNumber(lastMonth.monthEleCost, lastMonth.eleCost, lastMonth.cost);
      if (isFiniteNumber(fee)) target.lastFee.value = fmtNumber(fee, 2);
    }

    const yearPower = firstNumber(
      monthInfo.dataInfo?.totalEleNum,
      monthInfo.dataInfo?.totalPower,
      eleBill.totalEleNum
    );
    if (isFiniteNumber(yearPower)) {
      target.yearPower.value = fmtNumber(yearPower, 0);
    }

    const yearCost = firstNumber(
      monthInfo.dataInfo?.totalEleCost,
      monthInfo.dataInfo?.totalCost,
      eleBill.totalEleCost
    );
    if (isFiniteNumber(yearCost)) {
      target.yearCost.value = fmtNumber(yearCost, 2);
    }

    const update =
      cleanText(eleBill.date) ||
      cleanText(eleBill.amtTime) ||
      cleanText(item.update) ||
      "";

    target.updateTime = formatUpdateTime(update);
  }

  function normalizeResponse(json) {
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.data)) return json.data;
    if (Array.isArray(json?.result)) return json.result;
    if (json?.data && typeof json.data === "object") return [json.data];
    if (json && typeof json === "object") return [json];
    return [];
  }

  function getLatestDailyUsage(item) {
    const lists = [
      item.dayElecQuantity31?.sevenEleList,
      item.dayElecQuantity?.sevenEleList,
      item.dayElecQuantity31?.dayEleList,
      item.dayElecQuantity?.dayEleList,
      item.dayElecQuantity31?.list,
      item.dayElecQuantity?.list,
    ].filter(Array.isArray);

    const merged = lists.flat();

    const valid = merged
      .map((x) => ({
        day: cleanText(x.day || x.date || x.dataDate),
        value: firstNumber(x.dayElePq, x.dayEleNum, x.power, x.eleNum),
      }))
      .filter((x) => isFiniteNumber(x.value));

    if (!valid.length) return null;
    return valid[valid.length - 1];
  }

  function getCurrentMonthTotal(item) {
    const lists = [
      item.dayElecQuantity31?.sevenEleList,
      item.dayElecQuantity31?.dayEleList,
      item.dayElecQuantity31?.list,
    ].filter(Array.isArray);

    const merged = lists.flat();
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");

    let currentMonthItems = merged
      .map((x) => ({
        day: cleanText(x.day || x.date || x.dataDate),
        value: firstNumber(x.dayElePq, x.dayEleNum, x.power, x.eleNum),
      }))
      .filter((x) => isFiniteNumber(x.value))
      .filter((x) => {
        if (!x.day) return true;
        if (/^\d{4}-\d{2}-\d{2}/.test(x.day)) {
          return x.day.startsWith(`${yyyy}-${mm}`);
        }
        if (/^\d{2}-\d{2}/.test(x.day)) {
          return x.day.startsWith(`${mm}-`);
        }
        return true;
      });

    if (currentMonthItems.length) {
      return currentMonthItems.reduce((sum, x) => sum + x.value, 0);
    }

    const monthList =
      item.monthElecQuantity?.mothEleList ||
      item.monthElecQuantity?.monthEleList ||
      [];

    const currentMonth =
      monthList.find((x) => cleanText(x.month).includes(`${yyyy}-${mm}`)) ||
      lastValid(monthList);

    return firstNumber(
      currentMonth?.monthEleNum,
      currentMonth?.monthPower,
      currentMonth?.totalPower
    );
  }

  function withQuery(url, params) {
    const joiner = url.includes("?") ? "&" : "?";
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    return `${url}${joiner}${qs}`;
  }

  function firstNumber(...vals) {
    for (const v of vals) {
      if (v === undefined || v === null || v === "" || v === "-") continue;
      const n = Number(String(v).replace(/[^\d.-]/g, ""));
      if (!Number.isNaN(n) && Number.isFinite(n)) return n;
    }
    return NaN;
  }

  function isFiniteNumber(v) {
    return typeof v === "number" && Number.isFinite(v);
  }

  function fmtNumber(v, digits = 2) {
    if (!isFiniteNumber(v)) return "--";
    return Number(v).toFixed(digits).replace(/\.00$/, "");
  }

  function cleanText(v) {
    if (v === undefined || v === null) return "";
    return String(v).replace(/\*/g, "").trim();
  }

  function lastValid(arr) {
    if (!Array.isArray(arr) || !arr.length) return null;
    return arr[arr.length - 1];
  }

  function maskNo(no) {
    const s = String(no || "");
    if (s.length <= 4) return s;
    return `****${s.slice(-4)}`;
  }

  function formatUpdateTime(input) {
    if (!input) {
      return new Date().toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Shanghai",
      });
    }

    const text = String(input).trim();

    const m = text.match(/(\d{1,2}):(\d{2})/);
    if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;

    return new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Shanghai",
    });
  }

  function isYesterday(dayText) {
    if (!dayText) return false;

    const now = new Date();
    const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yyyy = y.getFullYear();
    const mm = String(y.getMonth() + 1).padStart(2, "0");
    const dd = String(y.getDate()).padStart(2, "0");

    const s = String(dayText);

    return s.includes(`${yyyy}-${mm}-${dd}`) || s.includes(`${mm}-${dd}`);
  }
}