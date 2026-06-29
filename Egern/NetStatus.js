const OPENAI_STATUS_API = "https://status.openai.com/api/v2/summary.json";
const OPENAI_STATUS_PAGE = "https://status.openai.com/";

export default async function(ctx) {
  try {
    const resp = await ctx.http.get(OPENAI_STATUS_API);

    if (resp.status && (resp.status < 200 || resp.status >= 300)) {
      throw new Error("HTTP " + resp.status);
    }

    const data = await resp.json();

    if (!data || !data.status) {
      throw new Error("Invalid status response");
    }

    return renderWidget(ctx, data);
  } catch (error) {
    return renderErrorWidget(ctx, error);
  }
}

function renderWidget(ctx, data) {
  const family = ctx.widgetFamily || "systemSmall";

  const page = data.page || {};
  const status = data.status || {};
  const components = Array.isArray(data.components) ? data.components : [];
  const incidents = getActiveIncidents(data.incidents);
  const maintenances = getActiveMaintenances(data.scheduled_maintenances);

  const affectedComponents = components.filter(function(item) {
    return item && item.status && item.status !== "operational";
  });

  const indicator = getDisplayIndicator(
    status.indicator || "none",
    affectedComponents,
    incidents,
    maintenances
  );

  const color = getIndicatorColor(indicator);
  const icon = getIndicatorIcon(indicator);

  const statusText = status.description || getIndicatorText(indicator);
  const updatedAt = page.updated_at || "";
  const updatedText = updatedAt ? "更新于 " + formatDate(updatedAt) : "更新时间未知";

  if (family === "accessoryInline") {
    return renderInlineWidget(statusText, incidents, maintenances);
  }

  if (family === "accessoryCircular") {
    return renderCircularWidget(indicator, color, icon);
  }

  if (family === "accessoryRectangular") {
    return renderRectangularWidget({
      statusText: statusText,
      color: color,
      icon: icon,
      incidents: incidents,
      maintenances: maintenances,
      affectedComponents: affectedComponents,
      updatedText: updatedText
    });
  }

  return renderSystemWidget({
    family: family,
    statusText: statusText,
    color: color,
    icon: icon,
    components: components,
    incidents: incidents,
    maintenances: maintenances,
    affectedComponents: affectedComponents,
    updatedText: updatedText
  });
}

function renderSystemWidget(options) {
  const family = options.family;
  const isLarge = family === "systemLarge" || family === "systemExtraLarge";
  const isSmall = family === "systemSmall";

  const maxAffected = isLarge ? 6 : isSmall ? 2 : 4;
  const affectedText = buildAffectedText(options.affectedComponents, maxAffected);
  const incidentText = buildIncidentText(options.incidents);
  const maintenanceText = buildMaintenanceText(options.maintenances);

  const children = [
    {
      type: "stack",
      direction: "row",
      alignItems: "center",
      gap: 8,
      children: [
        {
          type: "image",
          src: "sf-symbol:" + options.icon,
          color: options.color,
          width: 20,
          height: 20
        },
        {
          type: "text",
          text: "OpenAI Status",
          font: { size: "headline", weight: "bold" },
          textColor: "#FFFFFF",
          maxLines: 1,
          minScale: 0.7
        },
        {
          type: "spacer"
        }
      ]
    },

    {
      type: "spacer"
    },

    {
      type: "text",
      text: options.statusText,
      font: { size: isSmall ? "headline" : "title3", weight: "bold" },
      textColor: options.color,
      maxLines: 2,
      minScale: 0.6
    },

    {
      type: "text",
      text: options.affectedComponents.length === 0
        ? options.components.length + " 个组件正常"
        : options.affectedComponents.length + " 个组件异常",
      font: { size: "subheadline", weight: "semibold" },
      textColor: "#D1D5DB",
      maxLines: 1,
      minScale: 0.7
    }
  ];

  if (options.incidents.length > 0) {
    children.push({
      type: "text",
      text: incidentText,
      font: { size: "caption", weight: "regular" },
      textColor: "#FBBF24",
      maxLines: isLarge ? 3 : 2,
      minScale: 0.55
    });
  }

  if (options.maintenances.length > 0) {
    children.push({
      type: "text",
      text: maintenanceText,
      font: { size: "caption", weight: "regular" },
      textColor: "#64D2FF",
      maxLines: isLarge ? 3 : 2,
      minScale: 0.55
    });
  }

  if (options.affectedComponents.length > 0) {
    children.push({
      type: "text",
      text: affectedText,
      font: { size: "caption", weight: "regular" },
      textColor: "#FCA5A5",
      maxLines: isLarge ? 6 : isSmall ? 2 : 4,
      minScale: 0.55
    });
  } else if (!isSmall) {
    children.push({
      type: "text",
      text: "所有核心服务当前正常运行",
      font: { size: "caption", weight: "regular" },
      textColor: "#9CA3AF",
      maxLines: 1,
      minScale: 0.7
    });
  }

  children.push({
    type: "text",
    text: options.updatedText,
    font: { size: "caption2", weight: "regular" },
    textColor: "#6B7280",
    maxLines: 1,
    minScale: 0.6
  });

  return {
    type: "widget",
    url: OPENAI_STATUS_PAGE,
    padding: 16,
    gap: 6,
    backgroundGradient: {
      type: "linear",
      colors: ["#0F172A", "#111827"],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 }
    },
    children: children
  };
}

function renderRectangularWidget(options) {
  let detailText = "All systems operational";

  if (options.incidents.length > 0) {
    detailText = options.incidents[0].name;
  } else if (options.maintenances.length > 0) {
    detailText = options.maintenances[0].name;
  } else if (options.affectedComponents.length > 0) {
    detailText = buildAffectedText(options.affectedComponents, 1);
  }

  return {
    type: "widget",
    url: OPENAI_STATUS_PAGE,
    padding: 8,
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
            src: "sf-symbol:" + options.icon,
            color: options.color,
            width: 14,
            height: 14
          },
          {
            type: "text",
            text: "OpenAI",
            font: { size: "caption", weight: "semibold" },
            maxLines: 1,
            minScale: 0.7
          }
        ]
      },
      {
        type: "text",
        text: options.statusText,
        font: { size: "headline", weight: "bold" },
        textColor: options.color,
        maxLines: 1,
        minScale: 0.55
      },
      {
        type: "text",
        text: detailText,
        font: { size: "caption2", weight: "regular" },
        maxLines: 2,
        minScale: 0.5
      }
    ]
  };
}

function renderCircularWidget(indicator, color, icon) {
  return {
    type: "widget",
    url: OPENAI_STATUS_PAGE,
    padding: 6,
    gap: 4,
    children: [
      {
        type: "image",
        src: "sf-symbol:" + icon,
        color: color,
        width: 22,
        height: 22
      },
      {
        type: "text",
        text: getShortIndicatorText(indicator),
        font: { size: "caption2", weight: "bold" },
        textColor: color,
        textAlign: "center",
        maxLines: 1,
        minScale: 0.5
      }
    ]
  };
}

function renderInlineWidget(statusText, incidents, maintenances) {
  let text = "OpenAI: " + statusText;

  if (incidents && incidents.length > 0) {
    text = "OpenAI: " + incidents[0].name;
  } else if (maintenances && maintenances.length > 0) {
    text = "OpenAI: " + maintenances[0].name;
  }

  return {
    type: "widget",
    url: OPENAI_STATUS_PAGE,
    children: [
      {
        type: "text",
        text: text,
        maxLines: 1,
        minScale: 0.6
      }
    ]
  };
}

function renderErrorWidget(ctx, error) {
  const family = ctx.widgetFamily || "systemSmall";
  const message = String(error && error.message ? error.message : error);

  if (family === "accessoryInline") {
    return {
      type: "widget",
      url: OPENAI_STATUS_PAGE,
      children: [
        {
          type: "text",
          text: "OpenAI Status: 加载失败",
          maxLines: 1,
          minScale: 0.6
        }
      ]
    };
  }

  if (family === "accessoryCircular") {
    return {
      type: "widget",
      url: OPENAI_STATUS_PAGE,
      padding: 6,
      gap: 4,
      children: [
        {
          type: "image",
          src: "sf-symbol:exclamationmark.triangle.fill",
          color: "#FF3B30",
          width: 22,
          height: 22
        },
        {
          type: "text",
          text: "ERR",
          font: { size: "caption2", weight: "bold" },
          textColor: "#FF3B30",
          textAlign: "center",
          maxLines: 1
        }
      ]
    };
  }

  if (family === "accessoryRectangular") {
    return {
      type: "widget",
      url: OPENAI_STATUS_PAGE,
      padding: 8,
      gap: 4,
      children: [
        {
          type: "text",
          text: "OpenAI Status",
          font: { size: "caption", weight: "semibold" },
          maxLines: 1
        },
        {
          type: "text",
          text: "加载失败",
          font: { size: "headline", weight: "bold" },
          textColor: "#FF3B30",
          maxLines: 1
        },
        {
          type: "text",
          text: message,
          font: { size: "caption2", weight: "regular" },
          maxLines: 1,
          minScale: 0.5
        }
      ]
    };
  }

  return {
    type: "widget",
    url: OPENAI_STATUS_PAGE,
    padding: 16,
    gap: 8,
    backgroundGradient: {
      type: "linear",
      colors: ["#1F2937", "#111827"],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 }
    },
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 8,
        children: [
          {
            type: "image",
            src: "sf-symbol:exclamationmark.triangle.fill",
            color: "#FF3B30",
            width: 20,
            height: 20
          },
          {
            type: "text",
            text: "OpenAI Status",
            font: { size: "headline", weight: "bold" },
            textColor: "#FFFFFF",
            maxLines: 1
          }
        ]
      },
      {
        type: "text",
        text: "状态加载失败",
        font: { size: "title3", weight: "bold" },
        textColor: "#FF3B30",
        maxLines: 1
      },
      {
        type: "text",
        text: message,
        font: { size: "caption", weight: "regular" },
        textColor: "#9CA3AF",
        maxLines: 2,
        minScale: 0.6
      }
    ]
  };
}

function getActiveIncidents(incidents) {
  if (!Array.isArray(incidents)) {
    return [];
  }

  return incidents.filter(function(item) {
    if (!item || !item.status) {
      return false;
    }

    return item.status !== "resolved";
  });
}

function getActiveMaintenances(maintenances) {
  if (!Array.isArray(maintenances)) {
    return [];
  }

  return maintenances.filter(function(item) {
    if (!item || !item.status) {
      return false;
    }

    return item.status !== "completed";
  });
}

function getDisplayIndicator(indicator, affectedComponents, incidents, maintenances) {
  let result = indicator || "none";

  for (let i = 0; i < affectedComponents.length; i++) {
    const status = affectedComponents[i].status;
    const mapped = mapComponentStatusToIndicator(status);
    result = worseIndicator(result, mapped);
  }

  for (let j = 0; j < incidents.length; j++) {
    const impact = incidents[j].impact || "none";
    result = worseIndicator(result, impact);
  }

  if (maintenances && maintenances.length > 0 && result === "none") {
    result = "maintenance";
  }

  return result;
}

function mapComponentStatusToIndicator(status) {
  const map = {
    operational: "none",
    degraded_performance: "minor",
    partial_outage: "major",
    major_outage: "critical",
    under_maintenance: "maintenance"
  };

  return map[status] || "minor";
}

function worseIndicator(a, b) {
  const rank = {
    none: 0,
    maintenance: 1,
    minor: 1,
    major: 2,
    critical: 3
  };

  const ra = rank[a] || 0;
  const rb = rank[b] || 0;

  return rb > ra ? b : a;
}

function getIndicatorColor(indicator) {
  const map = {
    none: "#34C759",
    minor: "#FFD60A",
    major: "#FF9500",
    critical: "#FF3B30",
    maintenance: "#64D2FF"
  };

  return map[indicator] || "#8E8E93";
}

function getIndicatorIcon(indicator) {
  const map = {
    none: "checkmark.circle.fill",
    minor: "exclamationmark.triangle.fill",
    major: "exclamationmark.triangle.fill",
    critical: "xmark.octagon.fill",
    maintenance: "wrench.fill"
  };

  return map[indicator] || "questionmark.circle.fill";
}

function getIndicatorText(indicator) {
  const map = {
    none: "All Systems Operational",
    minor: "Minor Service Outage",
    major: "Partial System Outage",
    critical: "Major System Outage",
    maintenance: "Under Maintenance"
  };

  return map[indicator] || "Unknown";
}

function getShortIndicatorText(indicator) {
  const map = {
    none: "OK",
    minor: "MIN",
    major: "WARN",
    critical: "DOWN",
    maintenance: "MAINT"
  };

  return map[indicator] || "N/A";
}

function getComponentStatusText(status) {
  const map = {
    operational: "正常",
    degraded_performance: "性能下降",
    partial_outage: "部分中断",
    major_outage: "严重中断",
    under_maintenance: "维护中"
  };

  return map[status] || status || "未知";
}

function buildAffectedText(components, maxCount) {
  if (!components || components.length === 0) {
    return "";
  }

  const list = components.slice(0, maxCount).map(function(item) {
    return item.name + "：" + getComponentStatusText(item.status);
  });

  const moreCount = components.length - list.length;
  if (moreCount > 0) {
    list.push("另有 " + moreCount + " 项异常");
  }

  return list.join("\n");
}

function buildIncidentText(incidents) {
  if (!incidents || incidents.length === 0) {
    return "";
  }

  if (incidents.length === 1) {
    return "事件：" + incidents[0].name;
  }

  return "事件：" + incidents[0].name + " 等 " + incidents.length + " 项";
}

function buildMaintenanceText(maintenances) {
  if (!maintenances || maintenances.length === 0) {
    return "";
  }

  if (maintenances.length === 1) {
    return "维护：" + maintenances[0].name;
  }

  return "维护：" + maintenances[0].name + " 等 " + maintenances.length + " 项";
}

function formatDate(isoString) {
  const date = new Date(isoString);

  if (isNaN(date.getTime())) {
    return isoString;
  }

  const pad = function(n) {
    return n < 10 ? "0" + n : String(n);
  };

  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    " " +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes())
  );
}