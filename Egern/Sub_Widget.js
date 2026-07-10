/**
 * 机场订阅流量监控小组件
 *
 * 使用说明：
 * 1. 添加环境变量：
 *
 *    NAME1 = 翻墙
 *    URL1 = https://xxx.com/sub...
 *    RESET1 = 1
 *
 * 2. 参数说明：
 *    - NAME1-5：机场名称，显示在卡片上（可选，否则显示"机场订阅"）
 *    - URL1-5：订阅地址，从机场后台复制（必填）
 *    - RESET1-5：流量重置日，1-31 的整数（可选）
 *
 * 3. 注意事项：
 *    - 本脚本读取大写键名 NAME1、URL1、RESET1 等
 *    - 至少需要配置 URL1 才能显示
 *    - 订阅地址需要包含完整的 token
 *    - 目标刷新时间设置为约 1 小时后，实际执行时间由系统决定
 *    - 自动适配系统深色/浅色模式
 *
 * 4. 功能说明：
 *    - 最多支持配置 5 个机场
 *    - 中小尺寸组件显示前 2 个机场，大尺寸显示 5 个机场
 *    - 大尺寸显示 5 个机场时自动使用紧凑布局
 *    - 同一订阅 30 分钟内直接返回缓存，不重复请求网络
 *    - 单个订阅失败不会影响其他订阅刷新
 *    - 断网或订阅异常时，10 天内的旧缓存可兜底显示
 *    - 超过 10 天的旧缓存会被删除并显示失败
 *    - 删除或替换订阅后会清理对应缓存
 *    - 记忆上次成功的订阅请求策略，下次刷新时优先使用
 *    - 缓存不保存完整订阅 URL/token
 *    - 使用缓存键和多重 URL 指纹降低碰撞导致的数据串用风险
 */

const COLORS = {
  textPrimary: { light: "#000000", dark: "#FFFFFF" },
  textSecondary: { light: "#555555", dark: "#EBEBF5" },
  textTertiary: { light: "#888888", dark: "#8E8E93" },
  accentGreen: { light: "#34C759", dark: "#30D158" },
  accentOrange: { light: "#FF9500", dark: "#FF9F0A" },
  accentRed: { light: "#FF3B30", dark: "#FF453A" },
  accentPurple: { light: "#D14FE2", dark: "#CA31E1" },
  divider: { light: "#E5E5EA", dark: "#48484A" },
  errorBg: { light: "#FFF5F5", dark: "#3B1F1F" },
  progressBg: { light: "#E8E8EA", dark: "#48484A" },
};

const WIDGET_BG_COLOR = {
  light: "#FFFFFF",
  dark: "#2C2C2E",
};

const CARD_BG_COLOR = {
  light: "#FFFFFF",
  dark: "#2B2B2D",
};

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const NETWORK_COOLDOWN_MS = 30 * 60 * 1000;
const MAX_STALE_MS = 10 * 24 * 60 * 60 * 1000;

const SCRIPT_SOFT_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 2000;
const MIN_REQUEST_TIMEOUT_MS = 500;

const CACHE_PREFIX = "sub_cache";
const CACHE_VERSION = 3;
const CACHE_INDEX_KEY =
  `${CACHE_PREFIX}_index_v${CACHE_VERSION}`;

const MAX_FATAL_ERROR_TEXT_LENGTH = 120;

const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];

const REGEX_USERINFO =
  /([-\w]+)\s*=\s*([\d.eE+-]+)/g;

const USERINFO_KEYS = new Set([
  "upload",
  "download",
  "total",
  "expire",
]);

const STRATEGIES = [
  {
    flag: "meta",
    ua: {
      "User-Agent": "mihomo/1.19.3",
      Accept: "application/x-yaml,text/plain,*/*",
    },
  },
  {
    flag: "clash",
    ua: {
      "User-Agent": "Clash/1.18.0",
      Accept: "application/x-yaml,text/plain,*/*",
    },
  },
  {
    flag: null,
    ua: {
      "User-Agent": "clash-verge-rev/2.3.1",
      Accept: "application/x-yaml,text/plain,*/*",
    },
  },
];

export default async function (ctx) {
  try {
    return await main(ctx);
  } catch (err) {
    return buildStatusWidget({
      icon: "sf-symbol:exclamationmark.triangle.fill",
      iconSize: 28,
      title: "脚本异常",
      titleColor: COLORS.accentRed,
      message: normalizeFatalError(err),
      gap: 8,
    });
  }
}

async function main(ctx) {
  const env = ctx.env || {};
  const slots = buildSlots(env);

  const cacheBucketMemo = new Map();

  // 即使已经删除最后一个订阅，也要清理索引中的旧缓存。
  syncCacheIndex(
    ctx,
    slots,
    cacheBucketMemo
  );

  if (!slots.length) {
    return buildStatusWidget({
      icon: "sf-symbol:wifi.slash",
      iconSize: 32,
      title: "未配置订阅",
      titleColor: COLORS.textPrimary,
      gap: 10,
    });
  }

  const widgetFamily = String(
    ctx.widgetFamily || "systemMedium"
  );

  const now = new Date();
  const nowTime = now.getTime();
  const deadlineTime =
    nowTime + SCRIPT_SOFT_TIMEOUT_MS;

  const slotCacheMemo = new Map();

  // 所有配置项都读取一次，使未显示的订阅也能清理过期缓存。
  const allSlotStates = slots.map((slot) =>
    buildSlotState(
      ctx,
      slot,
      now,
      nowTime,
      slotCacheMemo,
      cacheBucketMemo
    )
  );

  const slotStates = allSlotStates.slice(
    0,
    getDisplayLimit(widgetFamily)
  );

  const maxConcurrent =
    slotStates.length > 2 ? 3 : 2;

  const results = new Array(slotStates.length);
  const remoteGroups = [];
  const remoteGroupMap = new Map();

  for (let i = 0; i < slotStates.length; i++) {
    const state = slotStates[i];

    if (state.cache.fresh) {
      results[i] = attachSlotMeta(
        state.cache.fresh,
        state.slot,
        state.remainDays
      );
      continue;
    }

    let group = remoteGroupMap.get(state.slot.url);

    if (!group) {
      group = {
        cacheKey: state.cacheKey,
        cacheId: state.cacheId,
        url: state.slot.url,
        indexes: [],
        preferredStrategyIndex:
          normalizeStrategyIndex(
            state.cache.stale?.strategyIndex
          ),
      };

      remoteGroupMap.set(state.slot.url, group);
      remoteGroups.push(group);
    }

    group.indexes.push(i);
  }

  if (remoteGroups.length) {
    const remoteGroupResults = await concurrentMap(
      remoteGroups,
      maxConcurrent,
      (group) =>
        fetchRemoteForGroup(
          ctx,
          group,
          deadlineTime
        )
    );

    for (const groupResult of remoteGroupResults) {
      const group = groupResult?.group;
      const remote = groupResult?.remote || {
        ok: false,
        errorMsg: "Fetch Error",
      };

      if (!group) {
        continue;
      }

      if (remote.ok) {
        saveCache(
          ctx,
          group.cacheKey,
          group.cacheId,
          remote.data,
          nowTime,
          remote.strategyIndex,
          cacheBucketMemo
        );

        const dataWithCacheTime = {
          ...remote.data,
          cacheTime: nowTime,
          strategyIndex: remote.strategyIndex,
        };

        for (const index of group.indexes) {
          const state = slotStates[index];

          results[index] = attachSlotMeta(
            dataWithCacheTime,
            state.slot,
            state.remainDays
          );
        }

        continue;
      }

      for (const index of group.indexes) {
        const state = slotStates[index];

        if (state.cache.stale) {
          results[index] = attachSlotMeta(
            {
              ...state.cache.stale,
              isFallback: true,
              cacheAgeText: formatCacheAge(
                nowTime -
                  state.cache.stale.cacheTime
              ),
            },
            state.slot,
            state.remainDays
          );
        } else {
          results[index] = buildErrorResult(
            state.slot,
            remote.errorMsg || "Unknown"
          );
        }
      }
    }
  }

  for (let i = 0; i < results.length; i++) {
    if (!results[i]) {
      const state = slotStates[i];

      results[i] = buildErrorResult(
        state.slot,
        "Fetch Error"
      );
    }
  }

  const layout = getWidgetLayout(
    widgetFamily,
    results.length
  );

  const cardChildren = results.map((result) =>
    safeBuildCard(
      result,
      widgetFamily,
      nowTime,
      layout
    )
  );

  const timeStr =
    String(now.getHours()).padStart(2, "0") +
    ":" +
    String(now.getMinutes()).padStart(2, "0");

  return {
    type: "widget",
    backgroundColor: WIDGET_BG_COLOR,
    padding: layout.widgetPadding,
    gap: layout.widgetGap,
    refreshAfter: new Date(
      nowTime + REFRESH_INTERVAL_MS
    ).toISOString(),
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 6,
        children: [
          {
            type: "image",
            src:
              "sf-symbol:gauge.with.dots.needle.67percent",
            width: 16,
            height: 16,
            color: COLORS.accentGreen,
          },
          {
            type: "text",
            text: "SubInfo",
            font: {
              size: "subheadline",
              weight: "bold",
            },
            textColor: COLORS.textPrimary,
          },
          {
            type: "spacer",
          },
          {
            type: "image",
            src: "sf-symbol:arrow.clockwise",
            width: 10,
            height: 10,
            color: COLORS.textTertiary,
          },
          {
            type: "text",
            text: timeStr,
            font: {
              size: "caption2",
              weight: "medium",
            },
            textColor: COLORS.textTertiary,
          },
        ],
      },
      {
        type: "stack",
        direction: "column",
        gap: layout.cardsGap,
        children: cardChildren,
      },
    ],
  };
}

function getDisplayLimit(widgetFamily) {
  return widgetFamily === "systemLarge" ||
    widgetFamily === "systemExtraLarge"
    ? 5
    : 2;
}

function getWidgetLayout(widgetFamily, count) {
  const compact =
    count > 2 &&
    (widgetFamily === "systemLarge" ||
      widgetFamily === "systemExtraLarge");

  if (compact) {
    return {
      widgetPadding: [8, 10, 8, 10],
      widgetGap: 4,
      cardsGap: 5,
      cardPadding: [5, 8, 5, 8],
      cardGap: 3,
      progressHeight: 4,
    };
  }

  return {
    widgetPadding: [10, 10, 10, 10],
    widgetGap: 6,
    cardsGap: 10,
    cardPadding: [8, 10, 8, 10],
    cardGap: 5,
    progressHeight: 5,
  };
}

function buildSlots(env) {
  const slots = [];
  const descriptorMemo = new Map();

  for (let i = 1; i <= 5; i++) {
    const url = String(
      env[`URL${i}`] || ""
    ).trim();

    if (!url) {
      continue;
    }

    const name = String(
      env[`NAME${i}`] || ""
    ).trim();

    let descriptor =
      descriptorMemo.get(url);

    if (!descriptor) {
      descriptor = getCacheDescriptor(url);
      descriptorMemo.set(url, descriptor);
    }

    slots.push({
      name: name || "机场订阅",
      url,
      resetDay: parseResetDay(
        env[`RESET${i}`]
      ),
      cacheKey: descriptor.key,
      cacheId: descriptor.id,
    });
  }

  return slots;
}

function buildStatusWidget(options) {
  const children = [
    {
      type: "image",
      src: options.icon,
      width: options.iconSize,
      height: options.iconSize,
      color: COLORS.accentRed,
    },
    {
      type: "text",
      text: options.title,
      font: {
        size: "headline",
        weight: "semibold",
      },
      textColor: options.titleColor,
      maxLines: 1,
    },
  ];

  if (options.message) {
    children.push({
      type: "text",
      text: options.message,
      font: {
        size: "caption2",
        weight: "medium",
      },
      textColor: COLORS.textTertiary,
      maxLines: 2,
      textAlign: "center",
    });
  }

  return {
    type: "widget",
    backgroundColor: WIDGET_BG_COLOR,
    padding: 16,
    refreshAfter: new Date(
      Date.now() + REFRESH_INTERVAL_MS
    ).toISOString(),
    children: [
      {
        type: "stack",
        direction: "column",
        gap: options.gap,
        alignItems: "center",
        children,
      },
    ],
  };
}

function normalizeFatalError(err) {
  const msg = String(
    err?.message ?? err ?? ""
  ).trim();

  if (!msg) {
    return "Unknown";
  }

  if (
    msg.length <= MAX_FATAL_ERROR_TEXT_LENGTH
  ) {
    return msg;
  }

  return (
    msg.slice(
      0,
      MAX_FATAL_ERROR_TEXT_LENGTH - 1
    ) + "…"
  );
}

function buildSlotState(
  ctx,
  slot,
  now,
  nowTime,
  slotCacheMemo,
  cacheBucketMemo
) {
  const remainDays = slot.resetDay
    ? getRemainingDays(slot.resetDay, now)
    : null;

  let cache =
    slotCacheMemo.get(slot.url);

  if (!cache) {
    cache = readCache(
      ctx,
      slot.cacheKey,
      slot.cacheId,
      nowTime,
      cacheBucketMemo
    );

    slotCacheMemo.set(
      slot.url,
      cache
    );
  }

  return {
    slot,
    remainDays,
    cacheKey: slot.cacheKey,
    cacheId: slot.cacheId,
    cache,
  };
}

function syncCacheIndex(
  ctx,
  slots,
  cacheBucketMemo
) {
  const currentEntries =
    buildCacheIndexEntries(slots);

  const previousState =
    readCacheIndex(ctx);

  // 读取失败时无法安全判断哪些缓存需要删除。
  if (!previousState.ok) {
    return;
  }

  if (
    previousState.valid &&
    cacheIndexEntriesEqual(
      previousState.entries,
      currentEntries
    )
  ) {
    return;
  }

  const previousMap = new Map(
    previousState.entries.map(
      (entry) => [
        entry.key,
        entry.ids,
      ]
    )
  );

  const currentMap = new Map(
    currentEntries.map(
      (entry) => [
        entry.key,
        entry.ids,
      ]
    )
  );

  let cleanupSucceeded = true;

  for (
    const entry of previousState.entries
  ) {
    if (currentMap.has(entry.key)) {
      continue;
    }

    if (
      !deleteCacheBucket(
        ctx,
        entry.key,
        cacheBucketMemo
      )
    ) {
      cleanupSucceeded = false;
    }
  }

  for (const entry of currentEntries) {
    const previousIds =
      previousMap.get(entry.key);

    if (
      previousIds &&
      stringArraysEqual(
        previousIds,
        entry.ids
      )
    ) {
      continue;
    }

    if (
      !pruneCacheBucket(
        ctx,
        entry.key,
        new Set(entry.ids),
        cacheBucketMemo
      )
    ) {
      cleanupSucceeded = false;
    }
  }

  // 清理未全部成功时不推进索引，
  // 保留下次运行时的重试依据。
  if (!cleanupSucceeded) {
    return;
  }

  if (!currentEntries.length) {
    safeDeleteCache(
      ctx,
      CACHE_INDEX_KEY
    );
    return;
  }

  try {
    ctx.storage.setJSON(
      CACHE_INDEX_KEY,
      {
        version: CACHE_VERSION,
        entries: currentEntries,
      }
    );
  } catch (e) {}
}

function buildCacheIndexEntries(slots) {
  const entryMap = new Map();

  for (const slot of slots) {
    let ids =
      entryMap.get(slot.cacheKey);

    if (!ids) {
      ids = new Set();
      entryMap.set(
        slot.cacheKey,
        ids
      );
    }

    ids.add(slot.cacheId);
  }

  return cacheIndexEntriesFromMap(
    entryMap
  );
}

function cacheIndexEntriesFromMap(
  entryMap
) {
  return Array.from(
    entryMap,
    ([key, ids]) => ({
      key,
      ids: Array.from(ids).sort(),
    })
  ).sort((a, b) =>
    a.key < b.key
      ? -1
      : a.key > b.key
        ? 1
        : 0
  );
}

function readCacheIndex(ctx) {
  let previous;

  try {
    previous =
      ctx.storage.getJSON(
        CACHE_INDEX_KEY
      );
  } catch (e) {
    return {
      ok: false,
      valid: false,
      entries: [],
    };
  }

  if (previous == null) {
    return {
      ok: true,
      valid: true,
      entries: [],
    };
  }

  if (
    previous.version !== CACHE_VERSION
  ) {
    return {
      ok: true,
      valid: false,
      entries: [],
    };
  }

  const entries =
    normalizeCacheIndexEntries(
      previous.entries
    );

  return entries
    ? {
        ok: true,
        valid: true,
        entries,
      }
    : {
        ok: true,
        valid: false,
        entries: [],
      };
}

function normalizeCacheIndexEntries(
  entries
) {
  if (!Array.isArray(entries)) {
    return null;
  }

  const entryMap = new Map();

  for (const entry of entries) {
    if (
      !entry ||
      typeof entry.key !== "string" ||
      !Array.isArray(entry.ids)
    ) {
      return null;
    }

    let ids =
      entryMap.get(entry.key);

    if (!ids) {
      ids = new Set();
      entryMap.set(
        entry.key,
        ids
      );
    }

    for (const id of entry.ids) {
      if (typeof id !== "string") {
        return null;
      }

      ids.add(id);
    }

    if (!ids.size) {
      return null;
    }
  }

  return cacheIndexEntriesFromMap(
    entryMap
  );
}

function cacheIndexEntriesEqual(
  a,
  b
) {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (
      a[i].key !== b[i].key ||
      !stringArraysEqual(
        a[i].ids,
        b[i].ids
      )
    ) {
      return false;
    }
  }

  return true;
}

function stringArraysEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

function readCacheBucket(
  ctx,
  cacheKey,
  cacheBucketMemo
) {
  if (
    cacheBucketMemo.has(cacheKey)
  ) {
    return cacheBucketMemo.get(
      cacheKey
    );
  }

  let cached;

  try {
    cached = {
      ok: true,
      bucket:
        ctx.storage.getJSON(cacheKey),
    };
  } catch (e) {
    cached = {
      ok: false,
      bucket: null,
    };
  }

  cacheBucketMemo.set(
    cacheKey,
    cached
  );

  return cached;
}

function setCacheBucketMemo(
  cacheBucketMemo,
  cacheKey,
  bucket
) {
  cacheBucketMemo.set(
    cacheKey,
    {
      ok: true,
      bucket,
    }
  );
}

function isValidCacheBucket(bucket) {
  return (
    bucket &&
    bucket.version === CACHE_VERSION &&
    Array.isArray(bucket.entries)
  );
}

function deleteCacheBucket(
  ctx,
  cacheKey,
  cacheBucketMemo
) {
  const deleted =
    safeDeleteCache(ctx, cacheKey);

  if (deleted) {
    setCacheBucketMemo(
      cacheBucketMemo,
      cacheKey,
      null
    );
  }

  return deleted;
}

function pruneCacheBucket(
  ctx,
  cacheKey,
  validIds,
  cacheBucketMemo
) {
  const cached = readCacheBucket(
    ctx,
    cacheKey,
    cacheBucketMemo
  );

  // 读取失败时不能确认缓存无效。
  if (!cached.ok) {
    return false;
  }

  const bucket = cached.bucket;

  if (!bucket) {
    return true;
  }

  if (!isValidCacheBucket(bucket)) {
    return deleteCacheBucket(
      ctx,
      cacheKey,
      cacheBucketMemo
    );
  }

  const entries = bucket.entries.filter(
    (entry) =>
      entry &&
      typeof entry.id === "string" &&
      validIds.has(entry.id)
  );

  if (!entries.length) {
    return deleteCacheBucket(
      ctx,
      cacheKey,
      cacheBucketMemo
    );
  }

  if (
    entries.length ===
    bucket.entries.length
  ) {
    return true;
  }

  const nextBucket = {
    version: CACHE_VERSION,
    entries,
  };

  try {
    ctx.storage.setJSON(
      cacheKey,
      nextBucket
    );

    setCacheBucketMemo(
      cacheBucketMemo,
      cacheKey,
      nextBucket
    );

    return true;
  } catch (e) {
    // 写回失败时保留原缓存桶。
    return false;
  }
}

async function fetchRemoteForGroup(
  ctx,
  group,
  deadlineTime
) {
  try {
    const remote = await fetchRemoteInfo(
      ctx,
      group.url,
      deadlineTime,
      group.preferredStrategyIndex
    );

    return {
      group,
      remote,
    };
  } catch (err) {
    return {
      group,
      remote: {
        ok: false,
        errorMsg:
          normalizeRequestError(err),
      },
    };
  }
}

function readCache(
  ctx,
  cacheKey,
  cacheId,
  nowTime,
  cacheBucketMemo
) {
  const cached = readCacheBucket(
    ctx,
    cacheKey,
    cacheBucketMemo
  );

  if (!cached.ok) {
    return {
      fresh: null,
      stale: null,
    };
  }

  const bucket = cached.bucket;

  if (!bucket) {
    return {
      fresh: null,
      stale: null,
    };
  }

  if (!isValidCacheBucket(bucket)) {
    deleteCacheBucket(
      ctx,
      cacheKey,
      cacheBucketMemo
    );

    return {
      fresh: null,
      stale: null,
    };
  }

  const entry = bucket.entries.find(
    (item) =>
      item &&
      item.id === cacheId
  );

  if (!entry) {
    return {
      fresh: null,
      stale: null,
    };
  }

  const data = entry.data;
  const cacheTime = Number(entry.time);
  const strategyIndex =
    normalizeStrategyIndex(
      entry.strategyIndex
    );

  if (
    !data ||
    !Number.isFinite(cacheTime)
  ) {
    removeCacheEntry(
      ctx,
      cacheKey,
      cacheId,
      bucket,
      cacheBucketMemo
    );

    return {
      fresh: null,
      stale: null,
    };
  }

  const age = nowTime - cacheTime;

  const cachedData = {
    ...data,
    cacheTime,
    strategyIndex,
  };

  if (
    age >= 0 &&
    age < NETWORK_COOLDOWN_MS
  ) {
    return {
      fresh: cachedData,
      stale: null,
    };
  }

  if (
    age >= 0 &&
    age < MAX_STALE_MS
  ) {
    return {
      fresh: null,
      stale: cachedData,
    };
  }

  removeCacheEntry(
    ctx,
    cacheKey,
    cacheId,
    bucket,
    cacheBucketMemo
  );

  return {
    fresh: null,
    stale: null,
  };
}

function saveCache(
  ctx,
  cacheKey,
  cacheId,
  data,
  cacheTime,
  strategyIndex,
  cacheBucketMemo
) {
  const time = Number(cacheTime);

  if (!Number.isFinite(time)) {
    return;
  }

  const cached = readCacheBucket(
    ctx,
    cacheKey,
    cacheBucketMemo
  );

  // 读取失败时不覆盖可能仍然有效的原缓存。
  if (!cached.ok) {
    return;
  }

  let entries = [];
  const current = cached.bucket;

  if (isValidCacheBucket(current)) {
    entries = current.entries.filter(
      (entry) =>
        entry &&
        entry.id !== cacheId
    );
  }

  entries.push({
    id: cacheId,
    time,
    strategyIndex:
      normalizeStrategyIndex(
        strategyIndex
      ),
    data,
  });

  const nextBucket = {
    version: CACHE_VERSION,
    entries,
  };

  try {
    ctx.storage.setJSON(
      cacheKey,
      nextBucket
    );

    setCacheBucketMemo(
      cacheBucketMemo,
      cacheKey,
      nextBucket
    );
  } catch (e) {}
}

function removeCacheEntry(
  ctx,
  cacheKey,
  cacheId,
  bucket,
  cacheBucketMemo
) {
  if (!isValidCacheBucket(bucket)) {
    return deleteCacheBucket(
      ctx,
      cacheKey,
      cacheBucketMemo
    );
  }

  const entries = bucket.entries.filter(
    (entry) =>
      entry &&
      entry.id !== cacheId
  );

  if (!entries.length) {
    return deleteCacheBucket(
      ctx,
      cacheKey,
      cacheBucketMemo
    );
  }

  const nextBucket = {
    version: CACHE_VERSION,
    entries,
  };

  try {
    ctx.storage.setJSON(
      cacheKey,
      nextBucket
    );

    setCacheBucketMemo(
      cacheBucketMemo,
      cacheKey,
      nextBucket
    );

    return true;
  } catch (e) {
    return false;
  }
}

function safeDeleteCache(ctx, cacheKey) {
  try {
    ctx.storage.delete(cacheKey);
    return true;
  } catch (e) {
    return false;
  }
}

async function fetchRemoteInfo(
  ctx,
  url,
  deadlineTime,
  preferredStrategyIndex
) {
  let lastErrorMsg = "Unknown";

  const strategyIndexes =
    getStrategyIndexes(
      preferredStrategyIndex
    );

  for (
    const strategyIndex
    of strategyIndexes
  ) {
    const strategy =
      STRATEGIES[strategyIndex];

    const timeout =
      getRequestTimeout(deadlineTime);

    if (timeout <= 0) {
      lastErrorMsg = "Timeout";
      break;
    }

    const requestUrl = buildUrl(
      url,
      strategy.flag
    );

    let resp = null;

    try {
      resp = await ctx.http.get(
        requestUrl,
        {
          headers: strategy.ua,
          timeout,
        }
      );

      const status = Number(
        resp.status
      );

      const userInfoHeader =
        resp.headers.get(
          "subscription-userinfo"
        ) || "";

      if (
        Number.isFinite(status) &&
        (status < 200 || status >= 300)
      ) {
        lastErrorMsg = `HTTP ${status}`;
        continue;
      }

      const info = parseUserInfo(
        userInfoHeader
      );

      if (
        info &&
        Number.isFinite(info.total) &&
        info.total > 0
      ) {
        return {
          ok: true,
          strategyIndex,
          data: buildSuccessResult(info),
        };
      }

      lastErrorMsg = "No Data";
    } catch (err) {
      lastErrorMsg =
        normalizeRequestError(err);
    } finally {
      await cancelResponseBody(resp);
    }
  }

  return {
    ok: false,
    errorMsg: lastErrorMsg,
  };
}

function getStrategyIndexes(
  preferredStrategyIndex
) {
  const preferred =
    normalizeStrategyIndex(
      preferredStrategyIndex
    );

  const indexes = [];

  if (preferred != null) {
    indexes.push(preferred);
  }

  for (
    let i = 0;
    i < STRATEGIES.length;
    i++
  ) {
    if (i !== preferred) {
      indexes.push(i);
    }
  }

  return indexes;
}

function normalizeStrategyIndex(value) {
  const index = Number(value);

  return Number.isInteger(index) &&
    index >= 0 &&
    index < STRATEGIES.length
    ? index
    : null;
}

async function cancelResponseBody(resp) {
  try {
    const body = resp?.body;

    if (
      body &&
      typeof body.cancel === "function"
    ) {
      await body.cancel();
    }
  } catch (e) {}
}

function getRequestTimeout(deadlineTime) {
  const remaining =
    deadlineTime - Date.now() - 100;

  if (
    remaining < MIN_REQUEST_TIMEOUT_MS
  ) {
    return 0;
  }

  return Math.min(
    REQUEST_TIMEOUT_MS,
    remaining
  );
}

function normalizeRequestError(err) {
  const msg = String(
    err?.message ?? err ?? ""
  ).toLowerCase();

  if (
    msg.includes("timeout") ||
    msg.includes("timed out")
  ) {
    return "Timeout";
  }

  if (msg.includes("dns")) {
    return "DNS Error";
  }

  return "Network";
}

function buildSuccessResult(info) {
  const upload = Math.max(
    0,
    info.upload || 0
  );

  const download = Math.max(
    0,
    info.download || 0
  );

  const used = upload + download;
  const totalBytes = info.total;

  return {
    used,
    totalBytes,
    percent:
      totalBytes > 0
        ? (used / totalBytes) * 100
        : 0,
    expire:
      Number.isFinite(info.expire) &&
      info.expire > 0
        ? info.expire
        : null,
  };
}

function attachSlotMeta(
  data,
  slot,
  remainDays
) {
  return {
    ...data,
    name: slot.name,
    remainDays,
  };
}

function buildErrorResult(
  slot,
  errorMsg
) {
  return {
    name: slot.name,
    error: true,
    errorMsg,
  };
}

function buildCard(
  result,
  widgetFamily,
  nowTime,
  layout
) {
  const {
    name,
    error,
    errorMsg,
    used,
    totalBytes,
  } = result;

  if (error) {
    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      gap: 6,
      padding: layout.cardPadding,
      backgroundColor: COLORS.errorBg,
      borderRadius: 8,
      children: [
        {
          type: "image",
          src:
            "sf-symbol:exclamationmark.circle.fill",
          width: 12,
          height: 12,
          color: COLORS.accentRed,
        },
        {
          type: "text",
          text: name,
          font: {
            size: "caption2",
            weight: "semibold",
          },
          textColor: COLORS.accentRed,
          flex: 1,
          maxLines: 1,
          minScale: 0.7,
        },
        {
          type: "text",
          text:
            `失败 | ${errorMsg || "异常"}`,
          font: {
            size: "caption2",
            weight: "bold",
          },
          textColor: COLORS.accentRed,
          maxLines: 1,
          minScale: 0.7,
        },
      ],
    };
  }

  const displayState =
    getCardDisplayState(
      result,
      nowTime
    );

  return {
    type: "stack",
    direction: "column",
    gap: layout.cardGap,
    padding: layout.cardPadding,
    backgroundColor: CARD_BG_COLOR,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.divider,
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 5,
        children: [
          {
            type: "image",
            src: "sf-symbol:circle.fill",
            width: 6,
            height: 6,
            color:
              displayState.dotColor,
          },
          {
            type: "text",
            text:
              displayState.displayName,
            font: {
              size: "caption2",
              weight: "semibold",
            },
            textColor:
              COLORS.textPrimary,
            flex: 1,
            maxLines: 1,
            minScale: 0.65,
          },
          {
            type: "text",
            text:
              `${Math.round(
                displayState.displayPercent
              )}%`,
            font: {
              size: "caption2",
              weight: "bold",
            },
            textColor:
              displayState.statusColor,
            maxLines: 1,
          },
        ],
      },
      {
        type: "stack",
        direction: "row",
        height: layout.progressHeight,
        borderRadius: 3,
        children: [
          {
            type: "stack",
            flex: Math.max(
              displayState.progressPercent,
              0.01
            ),
            height:
              layout.progressHeight,
            backgroundColor:
              displayState.statusColor,
            borderRadius: 3,
          },
          {
            type: "stack",
            flex: Math.max(
              100 -
                displayState.progressPercent,
              0.01
            ),
            height:
              layout.progressHeight,
            backgroundColor:
              COLORS.progressBg,
            borderRadius: 3,
          },
        ],
      },
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        children: [
          {
            type: "stack",
            direction: "row",
            flex: 1,
            children: [
              {
                type: "text",
                text:
                  `${formatBytes(
                    used
                  )}/${formatBytes(
                    totalBytes
                  )}`,
                font: {
                  size: "caption2",
                  weight: "medium",
                },
                textColor:
                  COLORS.textSecondary,
                maxLines: 1,
                minScale: 0.65,
              },
              {
                type: "spacer",
              },
            ],
          },
          ...(widgetFamily ===
          "systemSmall"
            ? []
            : [
                {
                  type: "text",
                  text:
                    displayState.expireText,
                  font: {
                    size: "caption2",
                    weight: "medium",
                  },
                  textColor:
                    displayState.isExpired
                      ? COLORS.accentRed
                      : COLORS.textTertiary,
                  maxLines: 1,
                  minScale: 0.65,
                },
              ]),
          {
            type: "stack",
            direction: "row",
            flex: 1,
            children: [
              {
                type: "spacer",
              },
              {
                type: "text",
                text:
                  `剩${formatBytes(
                    Math.max(
                      0,
                      totalBytes - used
                    )
                  )}`,
                font: {
                  size: "caption2",
                  weight: "semibold",
                },
                textColor:
                  displayState.statusColor,
                maxLines: 1,
                minScale: 0.65,
              },
            ],
          },
        ],
      },
    ],
  };
}

function getCardDisplayState(
  result,
  nowTime
) {
  const safePercent = Number.isFinite(
    result.percent
  )
    ? result.percent
    : 0;

  let statusColor =
    getUsageColor(safePercent);

  const expireState = getExpireState(
    result.expire,
    nowTime
  );

  const isExpired =
    expireState.isExpired;

  if (isExpired) {
    statusColor = COLORS.accentRed;
  }

  let expireText = expireState.text;

  if (
    !isExpired &&
    result.remainDays != null
  ) {
    expireText =
      result.remainDays === 0
        ? "今天重置"
        : `${result.remainDays}天后重置`;
  }

  return {
    statusColor,
    dotColor:
      result.isFallback || isExpired
        ? COLORS.accentRed
        : statusColor,
    displayName: result.isFallback
      ? `${result.name} · ${
          result.cacheAgeText || "缓存"
        }`
      : result.name,
    displayPercent: Math.max(
      0,
      safePercent
    ),
    progressPercent: Math.min(
      Math.max(safePercent, 0),
      100
    ),
    expireText,
    isExpired,
  };
}

function getUsageColor(percent) {
  if (percent >= 95) {
    return COLORS.accentRed;
  }

  if (percent >= 80) {
    return COLORS.accentOrange;
  }

  if (percent >= 50) {
    return COLORS.accentPurple;
  }

  return COLORS.accentGreen;
}

function getExpireState(
  expire,
  nowTime
) {
  const rawExpire = Number(expire);

  if (
    !Number.isFinite(rawExpire) ||
    rawExpire <= 0
  ) {
    return {
      text: "永久有效",
      isExpired: false,
    };
  }

  const expireMs =
    rawExpire < 1e12
      ? rawExpire * 1000
      : rawExpire;

  const d = new Date(expireMs);
  const expireTime = d.getTime();

  if (!Number.isFinite(expireTime)) {
    return {
      text: "有效期未知",
      isExpired: false,
    };
  }

  if (expireTime < nowTime) {
    return {
      text: "已过期",
      isExpired: true,
    };
  }

  return {
    text:
      `${d.getFullYear()}-` +
      `${String(
        d.getMonth() + 1
      ).padStart(2, "0")}-` +
      String(d.getDate()).padStart(
        2,
        "0"
      ),
    isExpired: false,
  };
}

function safeBuildCard(
  result,
  widgetFamily,
  nowTime,
  layout
) {
  try {
    return buildCard(
      result,
      widgetFamily,
      nowTime,
      layout
    );
  } catch (err) {
    return buildCard(
      {
        name:
          result?.name || "未知",
        error: true,
        errorMsg: "Render Error",
      },
      widgetFamily,
      nowTime,
      layout
    );
  }
}

function buildUrl(base, flag) {
  if (!flag) {
    return base;
  }

  try {
    const u = new URL(base);

    u.searchParams.set(
      "flag",
      flag
    );

    return u.toString();
  } catch (e) {
    const hashIndex =
      base.indexOf("#");

    const urlPart =
      hashIndex >= 0
        ? base.slice(0, hashIndex)
        : base;

    const hashPart =
      hashIndex >= 0
        ? base.slice(hashIndex)
        : "";

    const queryIndex =
      urlPart.indexOf("?");

    const path =
      queryIndex >= 0
        ? urlPart.slice(0, queryIndex)
        : urlPart;

    const query =
      queryIndex >= 0
        ? urlPart.slice(queryIndex + 1)
        : "";

    const params = query
      .split("&")
      .filter(isNonFlagParam);

    params.push(
      `flag=${encodeURIComponent(flag)}`
    );

    return (
      `${path}?${params.join("&")}` +
      hashPart
    );
  }
}

function isNonFlagParam(param) {
  if (!param) {
    return false;
  }

  const eqIndex = param.indexOf("=");

  const rawKey =
    eqIndex >= 0
      ? param.slice(0, eqIndex)
      : param;

  if (
    rawKey.toLowerCase() === "flag"
  ) {
    return false;
  }

  if (
    rawKey.includes("%") ||
    rawKey.includes("+")
  ) {
    try {
      const key = decodeURIComponent(
        rawKey.replace(/\+/g, "%20")
      );

      return (
        key.toLowerCase() !== "flag"
      );
    } catch (e) {}
  }

  return true;
}

function parseUserInfo(header) {
  if (header == null) {
    return null;
  }

  header = String(header);

  if (!header.trim()) {
    return null;
  }

  const info = {};

  REGEX_USERINFO.lastIndex = 0;

  let match;

  while (
    (match =
      REGEX_USERINFO.exec(header)) !==
    null
  ) {
    const key = String(
      match[1] || ""
    ).toLowerCase();

    if (!USERINFO_KEYS.has(key)) {
      continue;
    }

    const val = Number(match[2]);

    if (
      Number.isFinite(val) &&
      val >= 0
    ) {
      info[key] = val;
    }
  }

  return Object.keys(info).length
    ? info
    : null;
}

function formatBytes(bytes) {
  if (
    !Number.isFinite(bytes) ||
    bytes <= 0
  ) {
    return "0B";
  }

  let i = 0;
  let value = bytes;

  while (
    value >= 1024 &&
    i < UNITS.length - 1
  ) {
    value /= 1024;
    i++;
  }

  let displayValue =
    value >= 10 || i === 0
      ? Math.round(value)
      : Number(value.toFixed(1));

  if (
    displayValue >= 1024 &&
    i < UNITS.length - 1
  ) {
    displayValue = 1;
    i++;
  }

  return `${displayValue}${UNITS[i]}`;
}

function formatCacheAge(ms) {
  if (
    !Number.isFinite(ms) ||
    ms < 0
  ) {
    return "缓存";
  }

  const minutes = Math.max(
    1,
    Math.floor(ms / 60000)
  );

  if (minutes < 60) {
    return `缓存${minutes}分`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `缓存${hours}小时`;
  }

  const days = Math.floor(
    hours / 24
  );

  return `缓存${days}天`;
}

function getMonthDays(year, month) {
  return new Date(
    year,
    month + 1,
    0
  ).getDate();
}

function getRemainingDays(
  resetDay,
  now
) {
  const currentYear =
    now.getFullYear();

  const currentMonth =
    now.getMonth();

  const currentDate =
    now.getDate();

  let targetYear = currentYear;
  let targetMonth = currentMonth;

  let safeDay = Math.min(
    resetDay,
    getMonthDays(
      targetYear,
      targetMonth
    )
  );

  if (currentDate > safeDay) {
    targetMonth += 1;

    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }

    safeDay = Math.min(
      resetDay,
      getMonthDays(
        targetYear,
        targetMonth
      )
    );
  }

  const diffMs =
    Date.UTC(
      targetYear,
      targetMonth,
      safeDay
    ) -
    Date.UTC(
      currentYear,
      currentMonth,
      currentDate
    );

  return Math.max(
    0,
    Math.ceil(diffMs / 86400000)
  );
}

function parseResetDay(value) {
  if (value == null) {
    return null;
  }

  const raw = String(value).trim();

  if (!raw) {
    return null;
  }

  const num = Number(raw);

  return Number.isInteger(num) &&
    num >= 1 &&
    num <= 31
    ? num
    : null;
}

async function concurrentMap(
  items,
  maxConcurrent,
  fn
) {
  if (
    !Array.isArray(items) ||
    !items.length
  ) {
    return [];
  }

  const results = new Array(
    items.length
  );

  const workerCount = Math.max(
    1,
    Math.min(
      Math.floor(
        Number(maxConcurrent)
      ) || 1,
      items.length
    )
  );

  let index = 0;

  const worker = async () => {
    while (index < items.length) {
      const currentIndex = index++;

      results[currentIndex] =
        await fn(items[currentIndex]);
    }
  };

  await Promise.all(
    Array.from(
      { length: workerCount },
      worker
    )
  );

  return results;
}

function getCacheDescriptor(url) {
  const primaryHash =
    hashStringSeed(
      url,
      2166136261
    );

  return {
    key:
      `${CACHE_PREFIX}_${primaryHash}`,
    id: [
      url.length.toString(36),
      primaryHash,
      hashStringSeed(
        url,
        2246822507
      ),
      hashStringSeed(
        url,
        3266489909
      ),
    ].join("_"),
  };
}

function hashStringSeed(str, seed) {
  let h = seed >>> 0;

  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(
      h,
      16777619
    );
  }

  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;

  return (h >>> 0).toString(36);
}
