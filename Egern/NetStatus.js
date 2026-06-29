const STATUS_API = "https://status.openai.com/api/v2/summary.json";
const STATUS_PAGE = "https://status.openai.com/";

export default async function(ctx) {
  try {
    const resp = await ctx.http.get(STATUS_API);
    const data = await resp.json();

    if (!data || !data.status) {
      throw new Error("Invalid response");
    }

    return buildWidget(ctx, data);
  } catch (e) {
    return buildErrorWidget(ctx, e);
  }
}

function buildWidget(ctx, data) {
  const family = ctx.widgetFamily || "systemSmall";

  const page = data.page || {};
  const status = data.status || {};
  const components = Array.isArray(data.components) ? data.components : [];
  const incidents = Array.isArray(data.incidents) ? data.incidents : [];

  const activeIncidents = incidents.filter(function(item) {
    return item && item.status && item.status !== "resolved";
  });

  const affectedComponents = components.filter(function(item) {
    return item && item.status && item.status !== "operational";
  });

  const indicator = getFinalIndicator(
    status.indicator || "none",
    affectedComponents,
    activeIncidents
  );

  const color = getColor(indicator);
  const bgColor = getBackgroundColor(indicator);

  const title = "OpenAI Status";
  const statusText = status.description || getStatusText(indicator);
  const updatedText = page.updated_at
    ? "Updated: " + formatDate(page.updated_at)
    : "Updated: unknown";

  if (family === "accessoryInline") {
    return {
      type: "widget",
      url: STATUS_PAGE,
      children: [
        {
          type: "text",
          text: "OpenAI: " + statusText,
          maxLines: 1,
          minScale: 0.6
        }
      ]
    };
  }

  if (family === "accessoryCircular") {
    return {
      type: "widget",
      url: STATUS_PAGE,
      padding: 6,
      children: [
        {
          type: "text",
          text: getShortText(indicator),
          font: {
            size: "headline",
            weight: "bold"
          },
          textColor: color,
          textAlign: "center",
          maxLines: 1,
          minScale: 0.5
        }
      ]
    };
  }

  if (family === "accessoryRectangular") {
    return buildRectangularWidget(
      title,
      statusText,
      color,
      activeIncidents,
      affectedComponents
    );
  }

  return buildSystemWidget(
    title,
    statusText,
    updatedText,
    color,
    bgColor,
    components,
    activeIncidents,
    affectedComponents
  );
}

function buildSystemWidget(
  title,
  statusText,
  updatedText,
  color,
  bgColor,
  components,
  incidents,
  affectedComponents
) {
  const children = [
    {
      type: "text",
      text: title,
      font: {
        size: "headline",
        weight: "bold"
      },
      textColor: "#FFFFFF",
      maxLines: 1
    },
    {
      type: "spacer"
    },
    {
      type: "text",
      text: statusText,
      font: {
        size: "title3",
        weight: "bold"
      },
      textColor: color,
      maxLines: 2,
      minScale: 0.6
    }
  ];

  if (incidents.length > 0) {
    children.push({
      type: "text",
      text: "Incident: " + incidents[0].name,
      font: {
        size: "caption",
        weight: "regular"
      },
      textColor: "#FFD60A",
      maxLines: 2,
      minScale: 0.55
    });
  } else if (affectedComponents.length > 0) {
    children.push({
      type: "text",
      text: buildAffectedText(affectedComponents, 3),
      font: {
        size: "caption",
        weight: "regular"
      },
      textColor: "#FF9F0A",
      maxLines: 3,
      minScale: 0.55
    });
  } else {
    children.push({
      type: "text",
      text: components.length + " components operational",
      font: {
        size: "caption",
        weight: "regular"
      },
      textColor: "#D1D5DB",
      maxLines: 1,
      minScale: 0.7
    });
  }

  children.push({
    type: "text",
    text: updatedText,
    font: {
      size: "caption2",
      weight: "regular"
    },
    textColor: "#9CA3AF",
    maxLines: 1,
    minScale: 0.6
  });

  return {
    type: "widget",
    url: STATUS_PAGE,
    padding: 16,
    gap: 6,
    backgroundColor: bgColor,
    children: children
  };
}

function buildRectangularWidget(
  title,
  statusText,
  color,
  incidents,
  affectedComponents
) {
  let detail = "All systems operational";

  if (incidents.length > 0) {
    detail = incidents[0].name;
  } else if (affectedComponents.length > 0) {
    detail = buildAffectedText(affectedComponents, 1);
  }

  return {
    type: "widget",
    url: STATUS_PAGE,
    padding: 8,
    gap: 4,
    children: [
      {
        type: "text",
        text: title,
        font: {
          size: "caption",
          weight: "semibold"
        },
        maxLines: 1,
        minScale: 0.7
      },
      {
        type: "text",
        text: statusText,
        font: {
          size: "headline",
          weight: "bold"
        },
        textColor: color,
        maxLines: 1,
        minScale: 0.55
      },
      {
        type: "text",
        text: detail,
        font: {
          size: "caption2",
          weight: "regular"
        },
        maxLines: 2,
        minScale: 0.5
      }
    ]
  };
}

function buildErrorWidget(ctx, error) {
  const family = ctx.widgetFamily || "systemSmall";
  const message = error && error.message ? error.message : String(error);

  if (family === "accessoryInline") {
    return {
      type: "widget",
      url: STATUS_PAGE,
      children: [
        {
          type: "text",
          text: "OpenAI Status: failed",
          maxLines: 1
        }
      ]
    };
  }

  return {
    type: "widget",
    url: STATUS_PAGE,
    padding: 16,
    gap: 6,
    backgroundColor: "#1F2937",
    children: [
      {
        type: "text",
        text: "OpenAI Status",
        font: {
          size: "headline",
          weight: "bold"
        },
        textColor: "#FFFFFF",
        maxLines: 1
      },
      {
        type: "text",
        text: "加载失败",
        font: {
          size: "title3",
          weight: "bold"
        },
        textColor: "#FF3B30",
        maxLines: 1
      },
      {
        type: "text",
        text: message,
        font: {
          size: "caption",
          weight: "regular"
        },
        textColor: "#D1D5DB",
        maxLines: 2,
        minScale: 0.6
      }
    ]
  };
}

function getFinalIndicator(indicator, affectedComponents, incidents) {
  let result = indicator || "none";

  for (let i = 0; i < affectedComponents.length; i++) {
    const item = affectedComponents[i];
    const mapped = mapComponentStatus(item.status);
    result = worseIndicator(result, mapped);
  }

  for (let j = 0; j < incidents.length; j++) {
    const incident = incidents[j];
    result = worseIndicator(result, incident.impact || "none");
  }

  return result;
}

function mapComponentStatus(status) {
  const map = {
    operational: "none",
    degraded_performance: "minor",
    partial_outage: "major",
    major_outage: "critical",
    under_maintenance: "minor"
  };

  return map[status] || "minor";
}

function worseIndicator(a, b) {
  const rank = {
    none: 0,
    minor: 1,
    major: 2,
    critical: 3
  };

  const ra = rank[a] || 0;
  const rb = rank[b] || 0;

  return rb > ra ? b : a;
}

function getColor(indicator) {
  const map = {
    none: "#34C759",
    minor: "#FFD60A",
    major: "#FF9500",
    critical: "#FF3B30"
  };

  return map[indicator] || "#8E8E93";
}

function getBackgroundColor(indicator) {
  const map = {
    none: "#0F172A",
    minor: "#1F2937",
    major: "#2A1F12",
    critical: "#2A1215"
  };

  return map[indicator] || "#111827";
}

function getStatusText(indicator) {
  const map = {
    none: "All Systems Operational",
    minor: "Minor Service Outage",
    major: "Partial System Outage",
    critical: "Major System Outage"
  };

  return map[indicator] || "Unknown";
}

function getShortText(indicator) {
  const map = {
    none: "OK",
    minor: "MIN",
    major: "WARN",
    critical: "DOWN"
  };

  return map[indicator] || "N/A";
}

function getComponentStatusText(status) {
  const map = {
    operational: "normal",
    degraded_performance: "degraded",
    partial_outage: "partial outage",
    major_outage: "major outage",
    under_maintenance: "maintenance"
  };

  return map[status] || status || "unknown";
}

function buildAffectedText(components, maxCount) {
  if (!components || components.length === 0) {
    return "";
  }

  const list = components.slice(0, maxCount).map(function(item) {
    return item.name + ": " + getComponentStatusText(item.status);
  });

  const more = components.length - list.length;

  if (more > 0) {
    list.push("+" + more + " more");
  }

  return list.join("\n");
}

function formatDate(value) {
  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return value;
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