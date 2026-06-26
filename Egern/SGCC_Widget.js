export default async function(ctx) {
  const env = ctx.env || {};
  const family = ctx.widgetFamily || "systemMedium";
  const API_URL =
    env.API_URL || "https://api.wsgw-rewrite.com/electricity/bill/all";

  function text(text, size = "caption1", weight = "regular", color, maxLines) {
    const node = {
      type: "text",
      text: String(text ?? ""),
      font: {
        size,
        weight
      },
      textColor: color || {
        light: "#111827",
        dark: "#F9FAFB"
      }
    };

    if (maxLines) node.maxLines = maxLines;
    return node;
  }

  function spacer(length) {
    const node = { type: "spacer" };
    if (length) node.length = length;
    return node;
  }

  function errorWidget(msg) {
    return {
      type: "widget",
      padding: 14,
      gap: 8,
      backgroundColor: {
        light: "#FEF2F2",
        dark: "#450A0A"
      },
      children: [
        text("网上国网", "headline", "bold", {
          light: "#DC2626",
          dark: "#F87171"
        }),
        text("❌ 查询失败", "caption1", "semibold", {
          light: "#991B1B",
          dark: "#FCA5A5"
        }),
        text(msg, "caption2", "regular", {
          light: "#7F1D1D",
          dark: "#FECACA"
        }, 5)
      ]
    };
  }

  function normalizeAccount(item) {
    const user = item.userInfo || item.user || {};
    const billRaw = item.eleBill || item.bill || {};
    const bill = Array.isArray(billRaw) ? billRaw[0] || {} : billRaw;

    const dayRaw = item.dayElecQuantity || item.dayElecQuantity31 || {};
    const day = Array.isArray(dayRaw) ? dayRaw[0] || {} : dayRaw;

    const monthRaw = item.monthElecQuantity || {};
    const month = Array.isArray(monthRaw) ? monthRaw[0] || {} : monthRaw;

    const consNo =
      user.consNo_dst ||
      user.consNo ||
      user.consNoSrc ||
      bill.consNo ||
      "";

    const name =
      user.consName_dst ||
      user.consName ||
      user.realName ||
      user.userName ||
      "";

    const address =
      user.elecAddr_dst ||
      user.elecAddr ||
      user.address ||
      "";

    const balanceRaw = bill.sumMoney ?? bill.balance ?? bill.prepayBal ?? "";
    const balanceNum = Number(balanceRaw);
    const hasBalance = balanceRaw !== "" && balanceRaw !== undefined && balanceRaw !== null;

    const isOwe =
      item.arrearsOfFees === true ||
      Number(bill.historyOwe || 0) > 0 ||
      balanceNum < 0;

    const currentUsage =
      bill.totalPq ||
      day.totalPq ||
      day.totalPower ||
      "";

    const billDate =
      bill.date ||
      bill.billDate ||
      day.endTime ||
      "";

    const estimatedDays =
      bill.dayNum ||
      bill.estimatedDays ||
      "";

    const annualUsage =
      month?.dataInfo?.totalEleNum ||
      month?.totalEleNum ||
      "";

    const annualCost =
      month?.dataInfo?.totalEleCost ||
      month?.totalEleCost ||
      "";

    return {
      consNo,
      name,
      address,
      balance: hasBalance ? Math.abs(balanceNum).toFixed(2) : "",
      isOwe,
      currentUsage,
      billDate,
      estimatedDays,
      annualUsage,
      annualCost
    };
  }

  function buildLines(accounts) {
    const lines = [];

    accounts.forEach((acc, idx) => {
      if (accounts.length > 1) {
        lines.push(`户号 ${idx + 1}`);
      }

      if (acc.currentUsage) {
        lines.push(`本期电量：${acc.currentUsage} 度`);
      }

      if (acc.balance) {
        lines.push(`账户余额：${acc.isOwe ? "-" : ""}${acc.balance} 元`);
      }

      if (acc.billDate) {
        lines.push(`截至日期：${acc.billDate}`);
      }

      if (acc.estimatedDays) {
        lines.push(`预计可用：${acc.estimatedDays} 天`);
      }

      if (acc.annualUsage || acc.annualCost) {
        lines.push(`年度用电：${acc.annualUsage || "--"} 度 / ${acc.annualCost || "--"} 元`);
      }

      if (acc.consNo) {
        lines.push(`户号信息：${acc.consNo}${acc.name ? "|" + acc.name : ""}`);
      }

      if (family !== "systemSmall" && acc.address) {
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

    return {
      type: "widget",
      children: [
        text("⚡", "title3", "bold", "#FFFFFF", 1),
        text(main, "caption2", "semibold", "#FFFFFF", 2)
      ]
    };
  }

  function buildWidget(accounts) {
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

    const shown = lines.slice(0, maxLines);

    return {
      type: "widget",
      padding: 14,
      gap: 7,
      backgroundColor: {
        light: "#F0FDF4",
        dark: "#052E16"
      },
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
              color: {
                light: "#059669",
                dark: "#34D399"
              },
              width: 18,
              height: 18
            },
            text("网上国网", "headline", "bold", {
              light: "#047857",
              dark: "#6EE7B7"
            }, 1),
            spacer(),
            {
              type: "date",
              date: new Date().toISOString(),
              format: "time",
              font: {
                size: "caption2",
                weight: "regular"
              },
              textColor: {
                light: "#6B7280",
                dark: "#9CA3AF"
              }
            }
          ]
        },
        {
          type: "stack",
          direction: "column",
          alignItems: "start",
          gap: 3,
          children: shown.map(line => {
            const important =
              line.includes("余额") ||
              line.includes("本期电量") ||
              line.includes("预计可用");

            return text(
              line,
              family === "systemSmall" ? "caption2" : "caption1",
              important ? "semibold" : "regular",
              important
                ? { light: "#111827", dark: "#FFFFFF" }
                : { light: "#374151", dark: "#D1D5DB" },
              1
            );
          })
        }
      ]
    };
  }

  try {
    const url = `${API_URL}?_=${Date.now()}`;
    const resp = await ctx.http.get(url);
    const json = await resp.json();

    if (json && json.error) {
      return errorWidget(json.message || json.error);
    }

    const arr = Array.isArray(json)
      ? json
      : Array.isArray(json.data)
        ? json.data
        : [json];

    const accounts = arr.map(normalizeAccount);

    if (!accounts.length) {
      return errorWidget("接口没有返回户号数据");
    }

    return buildWidget(accounts);
  } catch (e) {
    return errorWidget(String(e && e.message ? e.message : e));
  }
}