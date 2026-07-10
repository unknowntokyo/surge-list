/**
 * 机场订阅流量监控小组件
 *
 * 环境变量：
 *
 * NAME1 = 翻墙
 * URL1 = https://xxx.com/sub...
 * RESET1 = 1
 *
 * 参数：
 * - NAME1-5：机场名称，可选
 * - URL1-5：订阅地址，至少配置一项
 * - RESET1-5：流量重置日，1-31，可选
 *
 * 功能：
 * - 最多支持 5 个机场
 * - 中小尺寸显示前 2 个，大尺寸显示 5 个
 * - 30 分钟内使用新鲜缓存
 * - 网络失败时使用 10 天内旧缓存
 * - 自动清理删除或替换订阅产生的缓存
 * - 记忆上次成功的订阅请求策略
 * - 缓存不保存完整订阅 URL/token
 * - 订阅请求不携带 Egern Cookie
 *
 * 缓存说明：
 * - 缓存索引仅接受 v5，不读取或迁移 v4 及更早索引
 * - 流量缓存桶继续使用当前 v3 数据格式
 */

const COLORS = {
  textPrimary: {
    light: "#000000",
    dark: "#FFFFFF",
  },
  textSecondary: {
    light: "#555555",
    dark: "#EBEBF5",
  },
  textTertiary: {
    light: "#888888",
    dark: "#8E8E93",
  },
  accentGreen: {
    light: "#34C759",
    dark: "#30D158",
  },
  accentOrange: {
    light: "#FF9500",
    dark: "#FF9F0A",
  },
  accentRed: {
    light: "#FF3B30",
    dark: "#FF453A",
  },
  accentPurple: {
    light: "#D14FE2",
    dark: "#CA31E1",
  },
  divider: {
    light: "#E5E5EA",
    dark: "#48484A",
  },
  errorBg: {
    light: "#FFF5F5",
    dark: "#3B1F1F",
  },
  progressBg: {
    light: "#E8E8EA",
    dark: "#48484A",
  },
};

const WIDGET_BG_COLOR = {
  light: "#FFFFFF",
  dark: "#2C2C2E",
};

const CARD_BG_COLOR = {
  light: "#FFFFFF",
  dark: "#2B2B2D",
};

const REFRESH_INTERVAL_MS =
  60 * 60 * 1000;

const NETWORK_COOLDOWN_MS =
  30 * 60 * 1000;

const MAX_STALE_MS =
  10 * 24 * 60 * 60 * 1000;

const SCRIPT_SOFT_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 2000;
const MIN_REQUEST_TIMEOUT_MS = 500;

const CACHE_PREFIX = "sub_cache";
const CACHE_BUCKET_VERSION = 3;
const CACHE_INDEX_VERSION = 5;
const CACHE_INDEX_KEY =
  `${CACHE_PREFIX}__index`;

const MAX_FATAL_ERROR_TEXT_LENGTH = 120;

const UNITS = [
  "B",
  "KB",
  "MB",
  "GB",
  "TB",
  "PB",
];

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
    headers: {
      "User-Agent": "mihomo/1.19.3",
      Accept:
        "application/x-yaml,text/plain,*/*",
    },
  },
  {
    flag: "clash",
    headers: {
      "User-Agent": "Clash/1.18.0",
      Accept:
        "application/x-yaml,text/plain,*/*",
    },
  },
  {
    flag: null,
    headers: {
      "User-Agent":
        "clash-verge-rev/2.3.1",
      Accept:
        "application/x-yaml,text/plain,*/*",
    },
  },
];

export default async function (ctx) {
  try {
    return await main(ctx);
  } catch (err) {
    return buildStatusWidget({
      icon:
        "sf-symbol:exclamationmark.triangle.fill",
      iconSize: 28,
      title: "脚本异常",
      titleColor: COLORS.accentRed,
      message: normalizeFatalError(err),
      gap: 8,
    });
  }
}

async function main(ctx) {
  const slots = buildSlots(ctx.env);
  const cacheBucketMemo = new Map();

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

  const widgetFamily =
    ctx.widgetFamily ??
    "systemMedium";

  const isLarge =
    widgetFamily ===
      "systemLarge" ||
    widgetFamily ===
      "systemExtraLarge";

  const nowTime = Date.now();
  const now = new Date(nowTime);

  const deadlineTime =
    nowTime +
    SCRIPT_SOFT_TIMEOUT_MS;

  const cacheMemo = new Map();

  const slotStates = slots
    .slice(0, isLarge ? 5 : 2)
    .map((slot) =>
      buildSlotState(
        ctx,
        slot,
        now,
        nowTime,
        cacheMemo,
        cacheBucketMemo
      )
    );

  const maxConcurrent =
    slotStates.length > 2
      ? 3
      : 2;

  const results =
    new Array(
      slotStates.length
    );

  const remoteGroups = [];
  const remoteGroupMap =
    new Map();

  for (
    let i = 0;
    i < slotStates.length;
    i++
  ) {
    const state =
      slotStates[i];

    if (state.cache.fresh) {
      results[i] =
        attachSlotMeta(
          state.cache.fresh,
          state.slot,
          state.remainDays
        );

      continue;
    }

    let group =
      remoteGroupMap.get(
        state.slot.url
      );

    if (!group) {
      group = {
        cacheKey:
          state.slot.cacheKey,
        cacheId:
          state.slot.cacheId,
        url: state.slot.url,
        indexes: [],
        preferredStrategyIndex:
          state.cache.stale
            ?.strategyIndex ??
          null,
      };

      remoteGroupMap.set(
        state.slot.url,
        group
      );

      remoteGroups.push(group);
    }

    group.indexes.push(i);
  }

  if (remoteGroups.length) {
    const remoteGroupResults =
      await concurrentMap(
        remoteGroups,
        maxConcurrent,
        (group) =>
          fetchRemoteForGroup(
            ctx,
            group,
            deadlineTime
          )
      );

    for (
      const {
        group,
        remote,
      } of remoteGroupResults
    ) {
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

        for (
          const index of
            group.indexes
        ) {
          const state =
            slotStates[index];

          results[index] =
            attachSlotMeta(
              remote.data,
              state.slot,
              state.remainDays
            );
        }

        continue;
      }

      for (
        const index of
          group.indexes
      ) {
        const state =
          slotStates[index];

        if (state.cache.stale) {
          results[index] =
            attachSlotMeta(
              {
                ...state.cache.stale,
                isFallback: true,
                cacheAgeText:
                  formatCacheAge(
                    nowTime -
                      state.cache
                        .stale
                        .cacheTime
                  ),
              },
              state.slot,
              state.remainDays
            );
        } else {
          results[index] =
            buildErrorResult(
              state.slot,
              remote.errorMsg
            );
        }
      }
    }
  }

  const layout =
    getWidgetLayout(
      isLarge,
      results.length
    );

  const cardChildren =
    results.map((result) =>
      safeBuildCard(
        result,
        widgetFamily,
        nowTime,
        layout
      )
    );

  const timeStr =
    String(
      now.getHours()
    ).padStart(2, "0") +
    ":" +
    String(
      now.getMinutes()
    ).padStart(2, "0");

  return {
    type: "widget",
    backgroundColor:
      WIDGET_BG_COLOR,
    padding:
      layout.widgetPadding,
    gap: layout.widgetGap,
    refreshAfter: new Date(
      nowTime +
        REFRESH_INTERVAL_MS
    ).toISOString(),
    children: [
      {
        type: "stack",
        gap: 6,
        children: [
          {
            type: "image",
            src:
              "sf-symbol:gauge.with.dots.needle.67percent",
            width: 16,
            height: 16,
            color:
              COLORS.accentGreen,
          },
          {
            type: "text",
            text: "SubInfo",
            font: {
              size:
                "subheadline",
              weight: "bold",
            },
            textColor:
              COLORS.textPrimary,
          },
          {
            type: "spacer",
          },
          {
            type: "image",
            src:
              "sf-symbol:arrow.clockwise",
            width: 10,
            height: 10,
            color:
              COLORS.textTertiary,
          },
          {
            type: "text",
            text: timeStr,
            font: {
              size: "caption2",
              weight: "medium",
            },
            textColor:
              COLORS.textTertiary,
          },
        ],
      },
      {
        type: "stack",
        direction: "column",
        gap: layout.cardsGap,
        children:
          cardChildren,
      },
    ],
  };
}

function getWidgetLayout(
  isLarge,
  count
) {
  if (
    isLarge &&
    count > 2
  ) {
    return {
      widgetPadding: [8, 10],
      widgetGap: 4,
      cardsGap: 5,
      cardPadding: [5, 8],
      cardGap: 3,
      progressHeight: 4,
    };
  }

  return {
    widgetPadding: 10,
    widgetGap: 6,
    cardsGap: 10,
    cardPadding: [8, 10],
    cardGap: 5,
    progressHeight: 5,
  };
}

function buildSlots(env) {
  const slots = [];
  const descriptorMemo =
    new Map();

  for (
    let i = 1;
    i <= 5;
    i++
  ) {
    const url = (
      env[`URL${i}`] || ""
    ).trim();

    if (!url) {
      continue;
    }

    const name = (
      env[`NAME${i}`] || ""
    ).trim();

    let descriptor =
      descriptorMemo.get(url);

    if (!descriptor) {
      descriptor =
        getCacheDescriptor(url);

      descriptorMemo.set(
        url,
        descriptor
      );
    }

    slots.push({
      name:
        name ||
        "机场订阅",
      url,
      resetDay:
        parseResetDay(
          env[`RESET${i}`]
        ),
      cacheKey:
        descriptor.key,
      cacheId:
        descriptor.id,
    });
  }

  return slots;
}

function buildStatusWidget(
  options
) {
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
      textColor:
        options.titleColor,
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
      textColor:
        COLORS.textTertiary,
      maxLines: 2,
      textAlign: "center",
    });
  }

  return {
    type: "widget",
    backgroundColor:
      WIDGET_BG_COLOR,
    padding: 16,
    refreshAfter: new Date(
      Date.now() +
        REFRESH_INTERVAL_MS
    ).toISOString(),
    children: [
      {
        type: "stack",
        direction: "column",
        gap: options.gap,
        children,
      },
    ],
  };
}

function normalizeFatalError(
  err
) {
  const msg = String(
    err?.message ??
      err ??
      ""
  ).trim();

  if (!msg) {
    return "Unknown";
  }

  if (
    msg.length <=
    MAX_FATAL_ERROR_TEXT_LENGTH
  ) {
    return msg;
  }

  return (
    msg.slice(
      0,
      MAX_FATAL_ERROR_TEXT_LENGTH -
        1
    ) + "…"
  );
}

function buildSlotState(
  ctx,
  slot,
  now,
  nowTime,
  cacheMemo,
  cacheBucketMemo
) {
  const remainDays =
    slot.resetDay
      ? getRemainingDays(
          slot.resetDay,
          now
        )
      : null;

  let cache =
    cacheMemo.get(
      slot.url
    );

  if (!cache) {
    cache = readCache(
      ctx,
      slot.cacheKey,
      slot.cacheId,
      nowTime,
      cacheBucketMemo
    );

    cacheMemo.set(
      slot.url,
      cache
    );
  }

  return {
    slot,
    remainDays,
    cache,
  };
}

/**
 * 同步当前订阅配置与缓存索引。
 *
 * 配置签名未变化时：
 * - 不读取全部缓存桶
 * - 只重试清理待删除的缓存键
 *
 * 配置签名变化时：
 * - 清理已经删除的缓存键
 * - 修剪当前缓存桶中的无效 URL 指纹
 *
 * 仅接受 v5 索引，不读取或迁移旧索引。
 */
function syncCacheIndex(
  ctx,
  slots,
  cacheBucketMemo
) {
  const current =
    new Map();

  for (const slot of slots) {
    let ids =
      current.get(
        slot.cacheKey
      );

    if (!ids) {
      ids = new Set();

      current.set(
        slot.cacheKey,
        ids
      );
    }

    ids.add(
      slot.cacheId
    );
  }

  const currentSignature =
    buildCacheConfigSignature(
      current
    );

  const storedIndexState =
    safeReadStoredJSON(
      ctx,
      CACHE_INDEX_KEY
    );

  const previousIndex =
    storedIndexState.ok
      ? normalizeCacheIndex(
          storedIndexState.value
        )
      : null;

  const previousKeys =
    previousIndex?.keys ?? [];

  const pendingDeleteKeys =
    new Set();

  for (
    const key of previousKeys
  ) {
    if (current.has(key)) {
      continue;
    }

    if (
      !tryDeleteIndexedCache(
        ctx,
        key
      )
    ) {
      pendingDeleteKeys.add(
        key
      );
    }
  }

  const configChanged =
    previousIndex
      ?.signature !==
    currentSignature;

  let currentBucketsReady =
    true;

  if (configChanged) {
    for (
      const [key, ids] of
        current
    ) {
      if (
        !pruneCacheBucket(
          ctx,
          key,
          ids,
          cacheBucketMemo
        )
      ) {
        currentBucketsReady =
          false;
      }
    }
  }

  const nextKeys =
    new Set(
      current.keys()
    );

  for (
    const key of
      pendingDeleteKeys
  ) {
    nextKeys.add(key);
  }

  const nextIndex =
    buildCacheIndex(
      nextKeys,
      currentBucketsReady
        ? currentSignature
        : null
    );

  if (
    storedIndexState.ok &&
    !isSameCacheIndex(
      previousIndex,
      nextIndex
    )
  ) {
    try {
      ctx.storage.setJSON(
        CACHE_INDEX_KEY,
        nextIndex
      );
    } catch (e) {
    }
  }
}

function buildCacheIndex(
  keys,
  signature
) {
  return {
    version:
      CACHE_INDEX_VERSION,
    keys: Array.from(
      keys
    ).sort(),
    signature,
  };
}

function normalizeCacheIndex(
  index
) {
  if (
    !index ||
    index.version !==
      CACHE_INDEX_VERSION ||
    !Array.isArray(
      index.keys
    )
  ) {
    return null;
  }

  const keys = new Set();

  for (
    const key of index.keys
  ) {
    if (
      !isCacheBucketKey(key)
    ) {
      return null;
    }

    keys.add(key);
  }

  let signature = null;

  if (index.signature != null) {
    if (
      typeof index.signature !==
        "string" ||
      !/^[0-9a-z]+_[0-9a-z]+$/.test(
        index.signature
      )
    ) {
      return null;
    }

    signature =
      index.signature;
  }

  return {
    keys: Array.from(
      keys
    ).sort(),
    signature,
  };
}

function isSameCacheIndex(
  previous,
  next
) {
  if (
    !previous ||
    previous.signature !==
      next.signature ||
    previous.keys.length !==
      next.keys.length
  ) {
    return false;
  }

  for (
    let i = 0;
    i < next.keys.length;
    i++
  ) {
    if (
      previous.keys[i] !==
      next.keys[i]
    ) {
      return false;
    }
  }

  return true;
}

function buildCacheConfigSignature(
  current
) {
  const parts = [];

  const keys = Array.from(
    current.keys()
  ).sort();

  for (const key of keys) {
    parts.push(key);

    const ids = Array.from(
      current.get(key)
    ).sort();

    for (const id of ids) {
      parts.push(id);
    }
  }

  const source =
    parts.join("|");

  return (
    hashStringSeed(
      source,
      2166136261
    ) +
    "_" +
    hashStringSeed(
      source,
      2246822507
    )
  );
}

function isCacheBucketKey(
  key
) {
  if (
    typeof key !==
    "string"
  ) {
    return false;
  }

  const prefix =
    `${CACHE_PREFIX}_`;

  if (
    !key.startsWith(
      prefix
    )
  ) {
    return false;
  }

  const suffix =
    key.slice(
      prefix.length
    );

  return (
    suffix.length >= 1 &&
    suffix.length <= 7 &&
    /^[0-9a-z]+$/.test(
      suffix
    )
  );
}

function safeReadStoredJSON(
  ctx,
  key
) {
  try {
    return {
      ok: true,
      value:
        ctx.storage.getJSON(
          key
        ),
    };
  } catch (e) {
    return {
      ok: false,
    };
  }
}

function tryDeleteIndexedCache(
  ctx,
  cacheKey
) {
  try {
    ctx.storage.delete(
      cacheKey
    );
  } catch (e) {
    return false;
  }

  try {
    return (
      ctx.storage.getJSON(
        cacheKey
      ) == null
    );
  } catch (e) {
    return false;
  }
}

function readCacheBucket(
  ctx,
  cacheKey,
  cacheBucketMemo
) {
  if (
    cacheBucketMemo.has(
      cacheKey
    )
  ) {
    return cacheBucketMemo.get(
      cacheKey
    );
  }

  let state;

  try {
    state = {
      ok: true,
      bucket:
        ctx.storage.getJSON(
          cacheKey
        ),
    };
  } catch (e) {
    state = {
      ok: false,
    };
  }

  cacheBucketMemo.set(
    cacheKey,
    state
  );

  return state;
}

function rememberCacheBucket(
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

function writeCacheBucket(
  ctx,
  cacheKey,
  bucket,
  cacheBucketMemo
) {
  try {
    ctx.storage.setJSON(
      cacheKey,
      bucket
    );
  } catch (e) {
    return false;
  }

  rememberCacheBucket(
    cacheBucketMemo,
    cacheKey,
    bucket
  );

  return true;
}

function deleteCacheBucket(
  ctx,
  cacheKey,
  cacheBucketMemo
) {
  try {
    ctx.storage.delete(
      cacheKey
    );
  } catch (e) {
    return false;
  }

  rememberCacheBucket(
    cacheBucketMemo,
    cacheKey,
    null
  );

  return true;
}

function pruneCacheBucket(
  ctx,
  cacheKey,
  validIds,
  cacheBucketMemo
) {
  const cacheState =
    readCacheBucket(
      ctx,
      cacheKey,
      cacheBucketMemo
    );

  if (!cacheState.ok) {
    return false;
  }

  const bucket =
    cacheState.bucket;

  if (!bucket) {
    return true;
  }

  if (
    bucket.version !==
      CACHE_BUCKET_VERSION ||
    !Array.isArray(
      bucket.entries
    )
  ) {
    return deleteCacheBucket(
      ctx,
      cacheKey,
      cacheBucketMemo
    );
  }

  const entries =
    bucket.entries.filter(
      (entry) =>
        entry &&
        typeof entry.id ===
          "string" &&
        validIds.has(
          entry.id
        )
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

  return writeCacheBucket(
    ctx,
    cacheKey,
    {
      version:
        CACHE_BUCKET_VERSION,
      entries,
    },
    cacheBucketMemo
  );
}

function emptyCacheResult() {
  return {
    fresh: null,
    stale: null,
  };
}

function readCache(
  ctx,
  cacheKey,
  cacheId,
  nowTime,
  cacheBucketMemo
) {
  const cacheState =
    readCacheBucket(
      ctx,
      cacheKey,
      cacheBucketMemo
    );

  if (!cacheState.ok) {
    return emptyCacheResult();
  }

  const bucket =
    cacheState.bucket;

  if (!bucket) {
    return emptyCacheResult();
  }

  if (
    bucket.version !==
      CACHE_BUCKET_VERSION ||
    !Array.isArray(
      bucket.entries
    )
  ) {
    deleteCacheBucket(
      ctx,
      cacheKey,
      cacheBucketMemo
    );

    return emptyCacheResult();
  }

  const entry =
    bucket.entries.find(
      (item) =>
        item &&
        item.id === cacheId
    );

  if (!entry) {
    return emptyCacheResult();
  }

  const cacheTime =
    Number(entry.time);

  if (
    !entry.data ||
    !Number.isFinite(
      cacheTime
    )
  ) {
    removeCacheEntry(
      ctx,
      cacheKey,
      cacheId,
      bucket,
      cacheBucketMemo
    );

    return emptyCacheResult();
  }

  const age =
    nowTime -
    cacheTime;

  if (
    age < 0 ||
    age >= MAX_STALE_MS
  ) {
    removeCacheEntry(
      ctx,
      cacheKey,
      cacheId,
      bucket,
      cacheBucketMemo
    );

    return emptyCacheResult();
  }

  const cachedData = {
    ...entry.data,
    cacheTime,
    strategyIndex:
      normalizeStrategyIndex(
        entry.strategyIndex
      ),
  };

  if (
    age <
    NETWORK_COOLDOWN_MS
  ) {
    return {
      fresh: cachedData,
      stale: null,
    };
  }

  return {
    fresh: null,
    stale: cachedData,
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
  let cacheState =
    readCacheBucket(
      ctx,
      cacheKey,
      cacheBucketMemo
    );

  /*
   * 正常路径直接使用内存中的缓存桶。
   * 仅在本轮首次读取失败时重试一次 Storage。
   */
  if (!cacheState.ok) {
    try {
      const bucket =
        ctx.storage.getJSON(
          cacheKey
        );

      rememberCacheBucket(
        cacheBucketMemo,
        cacheKey,
        bucket
      );

      cacheState = {
        ok: true,
        bucket,
      };
    } catch (e) {
      return;
    }
  }

  const current =
    cacheState.bucket;

  let entries = [];

  if (
    current &&
    current.version ===
      CACHE_BUCKET_VERSION &&
    Array.isArray(
      current.entries
    )
  ) {
    entries =
      current.entries.filter(
        (entry) =>
          entry &&
          entry.id !==
            cacheId
      );
  }

  entries.push({
    id: cacheId,
    time: cacheTime,
    strategyIndex,
    data,
  });

  writeCacheBucket(
    ctx,
    cacheKey,
    {
      version:
        CACHE_BUCKET_VERSION,
      entries,
    },
    cacheBucketMemo
  );
}

function removeCacheEntry(
  ctx,
  cacheKey,
  cacheId,
  bucket,
  cacheBucketMemo
) {
  if (
    !bucket ||
    bucket.version !==
      CACHE_BUCKET_VERSION ||
    !Array.isArray(
      bucket.entries
    )
  ) {
    deleteCacheBucket(
      ctx,
      cacheKey,
      cacheBucketMemo
    );

    return;
  }

  const entries =
    bucket.entries.filter(
      (entry) =>
        entry &&
        entry.id !== cacheId
    );

  if (!entries.length) {
    deleteCacheBucket(
      ctx,
      cacheKey,
      cacheBucketMemo
    );

    return;
  }

  writeCacheBucket(
    ctx,
    cacheKey,
    {
      version:
        CACHE_BUCKET_VERSION,
      entries,
    },
    cacheBucketMemo
  );
}

async function fetchRemoteForGroup(
  ctx,
  group,
  deadlineTime
) {
  try {
    const remote =
      await fetchRemoteInfo(
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
          normalizeRequestError(
            err
          ),
      },
    };
  }
}

async function fetchRemoteInfo(
  ctx,
  url,
  deadlineTime,
  preferredStrategyIndex
) {
  let lastErrorMsg =
    "Unknown";

  const strategyIndexes =
    getStrategyIndexes(
      preferredStrategyIndex
    );

  for (
    const strategyIndex of
      strategyIndexes
  ) {
    const timeout =
      getRequestTimeout(
        deadlineTime
      );

    if (timeout <= 0) {
      lastErrorMsg =
        "Timeout";

      break;
    }

    const strategy =
      STRATEGIES[
        strategyIndex
      ];

    try {
      const resp =
        await ctx.http.get(
          buildUrl(
            url,
            strategy.flag
          ),
          {
            headers:
              strategy.headers,
            timeout,
            credentials:
              "omit",
          }
        );

      const status =
        resp.status;

      const userInfoHeader =
        resp.headers.get(
          "subscription-userinfo"
        );

      cancelResponseBody(
        resp
      );

      if (
        status < 200 ||
        status >= 300
      ) {
        lastErrorMsg =
          `HTTP ${status}`;

        continue;
      }

      const info =
        parseUserInfo(
          userInfoHeader
        );

      if (info?.total > 0) {
        return {
          ok: true,
          strategyIndex,
          data:
            buildSuccessResult(
              info
            ),
        };
      }

      lastErrorMsg =
        "No Data";
    } catch (err) {
      lastErrorMsg =
        normalizeRequestError(
          err
        );
    }
  }

  return {
    ok: false,
    errorMsg:
      lastErrorMsg,
  };
}

function getStrategyIndexes(
  preferredStrategyIndex
) {
  const indexes = [];

  if (
    preferredStrategyIndex !=
    null
  ) {
    indexes.push(
      preferredStrategyIndex
    );
  }

  for (
    let i = 0;
    i < STRATEGIES.length;
    i++
  ) {
    if (
      i !==
      preferredStrategyIndex
    ) {
      indexes.push(i);
    }
  }

  return indexes;
}

function normalizeStrategyIndex(
  value
) {
  if (value == null) {
    return null;
  }

  if (
    typeof value !==
      "number" &&
    typeof value !==
      "string"
  ) {
    return null;
  }

  if (
    typeof value ===
      "string" &&
    !value.trim()
  ) {
    return null;
  }

  const index =
    Number(value);

  return (
    Number.isInteger(
      index
    ) &&
    index >= 0 &&
    index <
      STRATEGIES.length
      ? index
      : null
  );
}

function cancelResponseBody(
  resp
) {
  try {
    const result =
      resp.body?.cancel?.();

    if (
      result &&
      typeof result.catch ===
        "function"
    ) {
      result.catch(
        () => {}
      );
    }
  } catch (e) {
  }
}

function getRequestTimeout(
  deadlineTime
) {
  const remaining =
    deadlineTime -
    Date.now() -
    100;

  if (
    remaining <
    MIN_REQUEST_TIMEOUT_MS
  ) {
    return 0;
  }

  return Math.min(
    REQUEST_TIMEOUT_MS,
    remaining
  );
}

function normalizeRequestError(
  err
) {
  const msg = String(
    err?.message ??
      err ??
      ""
  ).toLowerCase();

  if (
    msg.includes(
      "timeout"
    ) ||
    msg.includes(
      "timed out"
    )
  ) {
    return "Timeout";
  }

  if (
    msg.includes("dns")
  ) {
    return "DNS Error";
  }

  return "Network";
}

function parseUserInfo(
  header
) {
  if (
    header == null ||
    !header.trim()
  ) {
    return null;
  }

  const info = {};
  let found = false;

  REGEX_USERINFO.lastIndex =
    0;

  let match;

  while (
    (match =
      REGEX_USERINFO.exec(
        header
      )) !== null
  ) {
    const key =
      match[1].toLowerCase();

    if (
      !USERINFO_KEYS.has(
        key
      )
    ) {
      continue;
    }

    const value =
      Number(match[2]);

    if (
      Number.isFinite(
        value
      ) &&
      value >= 0
    ) {
      info[key] = value;
      found = true;
    }
  }

  return found
    ? info
    : null;
}

function buildSuccessResult(
  info
) {
  const upload =
    info.upload ?? 0;

  const download =
    info.download ?? 0;

  const used =
    upload + download;

  const totalBytes =
    info.total;

  return {
    used,
    totalBytes,
    percent:
      (used / totalBytes) *
      100,
    expire:
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
      gap: 6,
      padding:
        layout.cardPadding,
      backgroundColor:
        COLORS.errorBg,
      borderRadius: 8,
      children: [
        {
          type: "image",
          src:
            "sf-symbol:exclamationmark.circle.fill",
          width: 12,
          height: 12,
          color:
            COLORS.accentRed,
        },
        {
          type: "text",
          text: name,
          font: {
            size: "caption2",
            weight: "semibold",
          },
          textColor:
            COLORS.accentRed,
          flex: 1,
          maxLines: 1,
          minScale: 0.7,
        },
        {
          type: "text",
          text:
            `失败 | ${
              errorMsg ||
              "异常"
            }`,
          font: {
            size: "caption2",
            weight: "bold",
          },
          textColor:
            COLORS.accentRed,
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
    padding:
      layout.cardPadding,
    backgroundColor:
      CARD_BG_COLOR,
    borderRadius: 8,
    borderWidth: 1,
    borderColor:
      COLORS.divider,
    children: [
      {
        type: "stack",
        gap: 5,
        children: [
          {
            type: "image",
            src:
              "sf-symbol:circle.fill",
            width: 6,
            height: 6,
            color:
              displayState
                .dotColor,
          },
          {
            type: "text",
            text:
              displayState
                .displayName,
            font: {
              size: "caption2",
              weight:
                "semibold",
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
                displayState
                  .displayPercent
              )}%`,
            font: {
              size: "caption2",
              weight: "bold",
            },
            textColor:
              displayState
                .statusColor,
            maxLines: 1,
          },
        ],
      },
      {
        type: "stack",
        height:
          layout.progressHeight,
        borderRadius: 3,
        children: [
          {
            type: "stack",
            flex: Math.max(
              displayState
                .progressPercent,
              0.01
            ),
            height:
              layout.progressHeight,
            backgroundColor:
              displayState
                .statusColor,
            borderRadius: 3,
          },
          {
            type: "stack",
            flex: Math.max(
              100 -
                displayState
                  .progressPercent,
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
              COLORS
                .textSecondary,
            flex: 1,
            maxLines: 1,
            minScale: 0.65,
          },
          ...(widgetFamily ===
          "systemSmall"
            ? []
            : [
                {
                  type: "text",
                  text:
                    displayState
                      .expireText,
                  font: {
                    size:
                      "caption2",
                    weight:
                      "medium",
                  },
                  textColor:
                    displayState
                      .isExpired
                      ? COLORS
                          .accentRed
                      : COLORS
                          .textTertiary,
                  maxLines: 1,
                  minScale: 0.65,
                },
              ]),
          {
            type: "text",
            text:
              `剩${formatBytes(
                Math.max(
                  0,
                  totalBytes -
                    used
                )
              )}`,
            font: {
              size: "caption2",
              weight: "semibold",
            },
            textColor:
              displayState
                .statusColor,
            flex: 1,
            textAlign: "right",
            maxLines: 1,
            minScale: 0.65,
          },
        ],
      },
    ],
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
          result?.name ||
          "未知",
        error: true,
        errorMsg:
          "Render Error",
      },
      widgetFamily,
      nowTime,
      layout
    );
  }
}

function getCardDisplayState(
  result,
  nowTime
) {
  const safePercent =
    Number.isFinite(
      result.percent
    )
      ? result.percent
      : 0;

  let statusColor =
    getUsageColor(
      safePercent
    );

  const expireState =
    getExpireState(
      result.expire,
      nowTime
    );

  const isExpired =
    expireState.isExpired;

  if (isExpired) {
    statusColor =
      COLORS.accentRed;
  }

  let expireText =
    expireState.text;

  if (
    !isExpired &&
    result.remainDays != null
  ) {
    expireText =
      result.remainDays === 0
        ? "今天重置"
        : `${result.remainDays}天后重置`;
  }

  const displayPercent =
    Math.max(
      0,
      safePercent
    );

  return {
    statusColor,
    dotColor:
      result.isFallback ||
      isExpired
        ? COLORS.accentRed
        : statusColor,
    displayName:
      result.isFallback
        ? `${result.name} · ${
            result.cacheAgeText ||
            "缓存"
          }`
        : result.name,
    displayPercent,
    progressPercent:
      Math.min(
        displayPercent,
        100
      ),
    expireText,
    isExpired,
  };
}

function getUsageColor(
  percent
) {
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
  const rawExpire =
    Number(expire);

  if (
    !Number.isFinite(
      rawExpire
    ) ||
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

  const date =
    new Date(expireMs);

  const expireTime =
    date.getTime();

  if (
    !Number.isFinite(
      expireTime
    )
  ) {
    return {
      text: "有效期未知",
      isExpired: false,
    };
  }

  if (
    expireTime < nowTime
  ) {
    return {
      text: "已过期",
      isExpired: true,
    };
  }

  return {
    text:
      `${date.getFullYear()}-` +
      `${String(
        date.getMonth() + 1
      ).padStart(2, "0")}-` +
      String(
        date.getDate()
      ).padStart(2, "0"),
    isExpired: false,
  };
}

function buildUrl(
  base,
  flag
) {
  if (!flag) {
    return base;
  }

  const hashIndex =
    base.indexOf("#");

  const urlPart =
    hashIndex >= 0
      ? base.slice(
          0,
          hashIndex
        )
      : base;

  const hashPart =
    hashIndex >= 0
      ? base.slice(
          hashIndex
        )
      : "";

  const queryIndex =
    urlPart.indexOf("?");

  const path =
    queryIndex >= 0
      ? urlPart.slice(
          0,
          queryIndex
        )
      : urlPart;

  const query =
    queryIndex >= 0
      ? urlPart.slice(
          queryIndex + 1
        )
      : "";

  const params = query
    .split("&")
    .filter(
      isNonFlagParam
    );

  params.push(
    `flag=${flag}`
  );

  return (
    `${path}?${params.join(
      "&"
    )}` +
    hashPart
  );
}

function isNonFlagParam(
  param
) {
  if (!param) {
    return false;
  }

  const eqIndex =
    param.indexOf("=");

  const rawKey =
    eqIndex >= 0
      ? param.slice(
          0,
          eqIndex
        )
      : param;

  if (
    rawKey.toLowerCase() ===
    "flag"
  ) {
    return false;
  }

  if (
    rawKey.includes("%") ||
    rawKey.includes("+")
  ) {
    try {
      const decodedKey =
        decodeURIComponent(
          rawKey.replace(
            /\+/g,
            "%20"
          )
        );

      return (
        decodedKey
          .toLowerCase() !==
        "flag"
      );
    } catch (e) {
    }
  }

  return true;
}

function formatBytes(
  bytes
) {
  if (
    !Number.isFinite(
      bytes
    ) ||
    bytes <= 0
  ) {
    return "0B";
  }

  let unitIndex = 0;
  let value = bytes;

  while (
    value >= 1024 &&
    unitIndex <
      UNITS.length - 1
  ) {
    value /= 1024;
    unitIndex++;
  }

  let displayValue =
    value >= 10 ||
    unitIndex === 0
      ? Math.round(value)
      : Math.round(
          value * 10
        ) / 10;

  if (
    displayValue >= 1024 &&
    unitIndex <
      UNITS.length - 1
  ) {
    displayValue = 1;
    unitIndex++;
  }

  return (
    `${displayValue}${
      UNITS[unitIndex]
    }`
  );
}

function formatCacheAge(
  ms
) {
  if (
    !Number.isFinite(ms) ||
    ms < 0
  ) {
    return "缓存";
  }

  const minutes =
    Math.max(
      1,
      Math.floor(
        ms / 60000
      )
    );

  if (minutes < 60) {
    return `缓存${minutes}分`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  if (hours < 24) {
    return `缓存${hours}小时`;
  }

  return (
    `缓存${Math.floor(
      hours / 24
    )}天`
  );
}

function getMonthDays(
  year,
  month
) {
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

  let targetYear =
    currentYear;

  let targetMonth =
    currentMonth;

  let safeDay =
    Math.min(
      resetDay,
      getMonthDays(
        targetYear,
        targetMonth
      )
    );

  if (
    currentDate > safeDay
  ) {
    targetMonth++;

    if (
      targetMonth > 11
    ) {
      targetMonth = 0;
      targetYear++;
    }

    safeDay =
      Math.min(
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
    Math.ceil(
      diffMs / 86400000
    )
  );
}

function parseResetDay(
  value
) {
  const raw =
    value?.trim();

  if (!raw) {
    return null;
  }

  const number =
    Number(raw);

  return (
    Number.isInteger(
      number
    ) &&
    number >= 1 &&
    number <= 31
      ? number
      : null
  );
}

async function concurrentMap(
  items,
  maxConcurrent,
  fn
) {
  if (!items.length) {
    return [];
  }

  const results =
    new Array(
      items.length
    );

  const workerCount =
    Math.min(
      maxConcurrent,
      items.length
    );

  let nextIndex = 0;

  const worker =
    async () => {
      while (
        nextIndex <
        items.length
      ) {
        const currentIndex =
          nextIndex++;

        results[
          currentIndex
        ] = await fn(
          items[
            currentIndex
          ]
        );
      }
    };

  await Promise.all(
    Array.from(
      {
        length:
          workerCount,
      },
      worker
    )
  );

  return results;
}

/**
 * 主哈希同时用于缓存键和第一个 URL 指纹，
 * 避免使用相同 seed 重复遍历 URL。
 */
function getCacheDescriptor(
  url
) {
  const primaryHash =
    hashStringSeed(
      url,
      2166136261
    );

  return {
    key:
      `${CACHE_PREFIX}_` +
      primaryHash,
    id: [
      url.length.toString(
        36
      ),
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

function hashStringSeed(
  string,
  seed
) {
  let hash =
    seed >>> 0;

  for (
    let i = 0;
    i < string.length;
    i++
  ) {
    hash ^=
      string.charCodeAt(i);

    hash = Math.imul(
      hash,
      16777619
    );
  }

  hash ^= hash >>> 16;

  hash = Math.imul(
    hash,
    2246822507
  );

  hash ^= hash >>> 13;

  hash = Math.imul(
    hash,
    3266489909
  );

  hash ^= hash >>> 16;

  return (
    hash >>> 0
  ).toString(36);
}
