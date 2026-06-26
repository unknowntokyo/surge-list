export default async function(ctx) {
  const env = ctx.env || {};
  const family = ctx.widgetFamily || "systemMedium";

  const API_URL =
    env.API_URL ||
    "https://api.wsgw-rewrite.com/electricity/bill/all";

  function color(light, dark) {
    return {
      light,
      dark
    };
  }

  function text(value, size, weight, textColor, maxLines) {
    const node = {
      type: "text",
      text: String(value ?? ""),
      font: {
        size: size || "caption1",
        weight: weight || "regular"
      },
      textColor: textColor || color("#111827", "#F9FAFB")
    };

    if (maxLines) {
      node.maxLines = maxLines;
      node.minScale = 0.6;
    }

    return node;
  }

  function spacer(length) {
    const node = {
      type: "spacer"
    };

    if (length !== undefined) {
      node.length = length;
    }

    return node;
  }

  function errorWidget(message) {
    return {
      type: "widget",
      padding: 14,
      gap: 8,
      backgroundColor: color("#FEF2F2", "#450A0A"),
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 6,
          children: [
            {
              type: "image",
              src: "sf-symbol:exclamationmark.triangle.fill",
              color: "#EF4444",
              width: 18,
              height: 18
            },
            text("网上国网", "headline", "bold", color("#991B1B", "#FCA5A5"), 1)
          ]
        },
        text("查询失败", "caption1", "semibold", color("#B91C1C", "#FECACA"), 1),
        text(message || "未知错误", "caption2", "regular", color("#7F1D1D", "#FECACA"), 6)
      ]
    };
  }

  function emptyWidget(message) {
    return {
      type: "widget",
      padding: 14,
      gap: 8,
      backgroundColor: color("#F3F4F6", "#111827"),
      children: [
        text("网上国网", "headline", "bold", color("#374151", "#F9FAFB"), 1),
        text(message || "暂无数据", "caption1", "regular", color("#6B7280", "#D1D5DB"), 5)
      ]
    };
  }

  function safeNumber(value) {
    if (value === undefined || value === null || value === "") return null;

    const n = Number(value);

    if (Number.isFinite(n)) return n;

    return null;
  }

  function pick(...values) {
    for (const v of values) {
      if (v !== undefined && v !== null && v !== "") {
        return v;
      }
    }

    return "";
  }

  function normalizeAccount(item) {
    const root = item || {};

    const userInfo =
      root.userInfo ||
      root.user ||
      root.consInfo ||
      root.account ||
      {};

    const eleBillRaw =
      root.eleBill ||
      root.bill ||
      root.electricityBill ||
      root.elecBill ||
      {};

    const eleBill = Array.isArray(eleBillRaw)
      ? eleBillRaw[0] || {}
      : eleBillRaw;

    const dayRaw =
      root.dayElecQuantity ||
      root.dayElecQuantity31 ||
      root.dayPower ||
      root.recentUsage ||
      {};

    const day = Array.isArray(dayRaw)
      ? dayRaw[0] || {}
      : dayRaw;

    const monthRaw =
      root.monthElecQuantity ||
      root.monthPower ||
      root.yearPower ||
      {};

    const month = Array.isArray(monthRaw)
      ? monthRaw[0] || {}
      : monthRaw;

    const consNo = pick(
      userInfo.consNo_dst,
      userInfo.consNo,
      userInfo.consNoSrc,
      userInfo.acctId,
      eleBill.consNo,
      root.consNo
    );

    const name = pick(
      userInfo.consName_dst,
      userInfo.consName,
      userInfo.realName,
      userInfo.userName,
      userInfo.name,
      root.name
    );

    const address = pick(
      userInfo.elecAddr_dst,
      userInfo.elecAddr,
      userInfo.address,
      userInfo.addr,
      root.address
    );

    const balanceRaw = pick(
      eleBill.sumMoney,
      eleBill.balance,
      eleBill.prepayBal,
      eleBill.availableBalance,
      root.balance,
      root.sumMoney
    );

    const balanceNum = safeNumber(balanceRaw);

    const oweRaw = pick(
      eleBill.historyOwe,
      eleBill.oweFee,
      root.historyOwe,
      root.oweFee
    );

    const oweNum = safeNumber(oweRaw);

    const isOwe =
      root.arrearsOfFees === true ||
      oweNum > 0 ||
      balanceNum < 0;

    const currentUsage = pick(
      eleBill.totalPq,
      eleBill.totalPower,
      day.totalPq,
      day.totalPower,
      day.power,
      root.totalPq,
      root.currentUsage
    );

    const currentFee = pick(
      eleBill.totalAmt,
      eleBill.totalFee,
      eleBill.elecFee,
      root.totalFee,
      root.currentFee
    );

    const billDate = pick(
      eleBill.date,
      eleBill.billDate,
      eleBill.rcvblYm,
      day.endTime,
      day.date,
      root.billDate
    );

    const estimatedDays = pick(
      eleBill.dayNum,
      eleBill.estimatedDays,
      root.dayNum,
      root.estimatedDays
    );

    const annualUsage = pick(
      month?.dataInfo?.totalEleNum,
      month?.totalEleNum,
      month?.yearTotalPower,
      root.annualUsage
    );

    const annualCost = pick(
      month?.dataInfo?.totalEleCost,
      month?.totalEleCost,
      month?.yearTotalFee,
      root.annualCost
    );

    return {
      consNo,
      name,
      address,
      balance: balanceNum === null ? "" : Math.abs(balanceNum).toFixed(2),
      isOwe,
      currentUsage,
      currentFee,
      billDate,
      estimatedDays,
      annualUsage,
      annualCost
    };
  }

  function extractAccounts(json) {
    if (!json) return [];

    if (Array.isArray(json)) {
      return json.map(normalizeAccount);
    }

    if (Array.isArray(json.data)) {
      return json.data.map(normalizeAccount);
    }

    if (Array.isArray(json.result)) {
      return json.result.map(normalizeAccount);
    }

    if (Array.isArray(json.accounts)) {
      return json.accounts.map(normalizeAccount);
    }

    if (json.data && Array.isArray(json.data.list)) {
      return json.data.list.map(normalizeAccount);
    }

    if (json.data && typeof json.data === "object") {
      return [normalizeAccount(json.data)];
    }

    return [normalizeAccount(json)];
  }

  function buildLines(accounts) {
    const lines = [];

    accounts.forEach((acc, index) => {
      if (accounts.length > 1) {
        lines.push(`户号 ${index + 1}`);
      }

      if (acc.balance) {
        lines.push(`账户余额：${acc.isOwe ? "-" : ""}${acc.balance} 元`);
      }

      if (acc.currentUsage) {
        lines.push(`本期电量：${acc.currentUsage} 度`);
      }

      if (acc.currentFee) {
        lines.push(`本期电费：${acc.currentFee} 元`);
      }

      if (acc.estimatedDays) {
        lines.push(`预计可用：${acc.estimatedDays} 天`);
      }

      if (acc.billDate) {
        lines.push(`截至日期：${acc.billDate}`);
      }

      if (acc.annualUsage || acc.annualCost) {
        lines.push(`年度用电：${acc.annualUsage || "--"} 度 / ${acc.annualCost || "--"} 元`);
      }

      if (family !== "systemSmall" && acc.consNo) {
        const user = acc.name ? `${acc.consNo} | ${acc.name}` : acc.consNo;
        lines.push(`户号信息：${user}`);
      }

      if (
        family !== "systemSmall" &&
        family !== "systemMedium" &&
        acc.address
      ) {
        lines.push(`用电地址：${acc.address}`);
      }

      if (accounts.length > 1) {
        lines.push("");
      }
    });

    return lines.filter(Boolean);
  }

  function buildAccessory(accounts) {
    const acc = accounts[0] || {};

    const main = acc.balance
      ? `${acc.isOwe ? "-" : ""}${acc.balance}元`
      : acc.currentUsage
        ? `${acc.currentUsage}度`
        : "网上国网";

    if (family === "accessoryInline") {
      return {
        type: "widget",
        children: [
          text(`⚡ ${main}`, "caption1", "medium", "#FFFFFF", 1)
        ]
      };
    }

    if (family === "accessoryCircular") {
      return {
        type: "widget",
        children: [
          text("⚡", "title3", "bold", "#FFFFFF", 1),
          text(main, "caption2", "semibold", "#FFFFFF", 2)
        ]
      };
    }

    return {
      type: "widget",
      children: [
        text(`⚡ ${main}`, "caption1", "semibold", "#FFFFFF", 2)
      ]
    };
  }

  function buildWidget(accounts) {
    if (!accounts.length) {
      return emptyWidget("没有获取到户号数据");
    }

    if (family.startsWith("accessory")) {
      return buildAccessory(accounts);
    }

    const lines = buildLines(accounts);

    const maxLines =
      family === "systemSmall"
        ? 5
        : family === "systemMedium"
          ? 8
          : 16;

    const shownLines = lines.slice(0, maxLines);

    return {
      type: "widget",
      padding: 14,
      gap: 8,
      backgroundColor: color("#F0FDF4", "#052E16"),
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 6,
          children: [
            {
              type: "image",
              src: "sf-symbol:bolt.fill",
              color: "#10B981",
              width: 18,
              height: 18
            },
            text("网上国网", "headline", "bold", color("#047857", "#6EE7B7"), 1),
            spacer(),
            {
              type: "date",
              date: new Date().toISOString(),
              format: "time",
              font: {
                size: "caption2",
                weight: "regular"
              },
              textColor: color("#6B7280", "#9CA3AF")
            }
          ]
        },
        {
          type: "stack",
          direction: "column",
          alignItems: "start",
          gap: 3,
          children: shownLines.map(line => {
            const important =
              line.includes("余额") ||
              line.includes("电量") ||
              line.includes("电费") ||
              line.includes("预计可用");

            return text(
              line,
              family === "systemSmall" ? "caption2" : "caption1",
              important ? "semibold" : "regular",
              important
                ? color("#111827", "#FFFFFF")
                : color("#374151", "#D1D5DB"),
              1
            );
          })
        }
      ]
    };
  }

  async function fetchJSON() {
    const url = API_URL.includes("?")
      ? `${API_URL}&_=${Date.now()}`
      : `${API_URL}?_=${Date.now()}`;

    const resp = await ctx.http.get(url, {
      timeout: 25000,
      redirect: "follow"
    });

    let json;

    try {
      json = await resp.json();
    } catch (_) {
      const body = await resp.text();

      throw new Error(
        `接口没有返回 JSON，HTTP ${resp.status}：${String(body).slice(0, 120)}`
      );
    }

    if (resp.status < 200 || resp.status >= 300) {
      throw new Error(
        json && json.error
          ? json.error
          : `HTTP ${resp.status}`
      );
    }

    return json;
  }

  try {
    const json = await fetchJSON();

    if (json && json.error) {
      return errorWidget(json.message || json.error);
    }

    const accounts = extractAccounts(json)
      .filter(acc => {
        return (
          acc.balance ||
          acc.currentUsage ||
          acc.currentFee ||
          acc.consNo ||
          acc.address ||
          acc.annualUsage ||
          acc.annualCost
        );
      });

    return buildWidget(accounts);
  } catch (e) {
    return errorWidget(String(e && e.message ? e.message : e));
  }
}