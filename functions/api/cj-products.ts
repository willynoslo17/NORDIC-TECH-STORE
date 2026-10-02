import { withQuotes } from "../_shared/quote";
import { retailNok } from "../_shared/pricing";
import { winnerRows, winnersStatus, WINNERS_ONLY, type WinnerDeps } from "../_shared/cj-winners";
/** Response fields that may be public. The cached payload keeps raw CJ rows (data.content, costs) server-side only. */
const PUBLIC_KEYS = ["ok", "supplier", "sector", "query", "page", "markets", "storefrontCap", "count", "source"];
function publicPayload(payload: any, products: any[]) {
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_KEYS) if (payload?.[key] !== undefined) out[key] = payload[key];
  return { ...out, count: products.length, products };
}
/**
 * Nordic CJ live curated catalog.
 * Fetches real CJ provider products, scores winners, returns boutique storefront set.
 * totalRecords stays high in meta; products[] / data.content are capped (~120–150).
 * CJ enforces QPS ≈ 1 req/sec — we pace + retry so curation never returns empty winners.
 */
const BASE = "https://developers.cjdropshipping.com/api2.0/v1";
const STOREFRONT_CAP = 150;
const FETCH_SIZE = 50; // fewer round-trips under QPS=1
const PAGES_PER_KEYWORD = 2;
const MAX_KEYWORDS = 3;
const CJ_GAP_MS = 1100;
const CJ_LIVE_FALLBACK = "https://nordic-beauty-perfumes.pages.dev/api/cj-products";
/**
 * All NORDIC-* stores share one CJ account (QPS = 1 req/s across stores). Without caching, every page view
 * re-authenticated and ran 5–8 live CJ calls, so concurrent visitors on different stores got
 * "Too Many Requests, QPS limit is 1 time/1second" → 502. The curated set is now cached (isolate memory +
 * Cloudflare Cache API) and the CJ access token is reused, so CJ is only called when the cache is older
 * than CACHE_FRESH_MS. A stale copy is served if a refresh fails. Price quotes are signed per response.
 */
const CACHE_FRESH_MS = 30 * 60 * 1000;
const CACHE_KEEP_SECONDS = 12 * 3600;
const EMPTY_RETRY_MS = 30 * 60 * 1000; // genuinely empty after filtering (not a QPS failure)
/** A CJ call that hangs must not hold the shared in-flight refresh (and every visitor waiting on it) forever. */
const CJ_FETCH_TIMEOUT_MS = 10000;
type CachedCatalog = { at: number; payload: any | null };
const memoryCatalog = new Map<string, CachedCatalog>();
const inflight = new Map<string, Promise<CachedCatalog | null>>();
let tokenCache: { key: string; token: string; until: number } | null = null;

type StoreProfile = {
  sector: string;
  defaultQuery: string;
  keywords: string[];
  preferCertified: boolean;
  compliance: "general" | "beauty" | "kids" | "health_adjacent";
  enableFallback: boolean;
};

const PROFILE: StoreProfile = {
  "sector": "technology",
  "defaultQuery": "phone accessories",
  "keywords": [
    "smart home",
    "computer accessories",
    "wearable technology"
  ],
  "preferCertified": true,
  "compliance": "general",
  "enableFallback": false
} as StoreProfile;

const SECTOR_KEYWORDS: Record<string, string[]> = {
  beauty: ["beauty", "skincare", "perfume", "facial", "cosmetic"],
  skincare: ["skincare", "facial", "cosmetic", "beauty"],
  perfume: ["perfume", "beauty", "cosmetic"],
  facial: ["facial", "skincare", "beauty"],
  cosmetic: ["cosmetic", "beauty", "skincare"],
  "hair care": ["hair care", "beauty"],
  electronics: ["phone accessories", "smart home", "computer accessories", "wearable technology"],
  technology: ["phone accessories", "smart home", "computer accessories", "wearable technology"],
  "smart home": ["smart home", "phone accessories", "computer accessories"],
  "mobile accessories": ["mobile accessories", "phone accessories", "electronics"],
  "phone accessories": ["phone accessories", "computer accessories", "smart home", "wearable technology"],
  "computer accessories": ["computer accessories", "phone accessories", "smart home"],
  "wearable technology": ["wearable technology", "phone accessories", "smart home"],
  wearables: ["wearable technology", "phone accessories"],
  toys: ["educational toys", "montessori toys", "stem toys", "toys"],
  "educational toys": ["educational toys", "montessori toys", "stem toys", "toys"],
  "montessori toys": ["montessori toys", "educational toys", "toys"],
  "stem toys": ["stem toys", "educational toys", "toys"],
  "baby toys": ["baby toys", "toys", "educational toys"],
  "home living": ["home living", "home decor", "kitchen organizer", "storage box"],
  fitness: ["fitness", "yoga mat", "resistance band", "dumbbell"],
  "pet supplies": ["pet supplies", "dog toys", "cat toy", "pet bed"],
  "car accessories": ["car accessories", "car organizer", "car charger", "phone holder car"],
  "solar energy": ["solar energy", "solar panel", "solar light", "solar charger"],
};

const ALLOWED_Q = new Set(
  [
    PROFILE.defaultQuery,
    ...PROFILE.keywords,
    ...Object.keys(SECTOR_KEYWORDS),
    ...Object.values(SECTOR_KEYWORDS).flat(),
  ].map((s) => s.toLowerCase())
);

const BLOCK_GENERAL =
  /\b(prescription|rx\b|viagra|steroid|cannabis|cbd oil|weapon|firearm|ammunition|explosive)\b/i;
const BLOCK_BEAUTY =
  /\b(cure\b|cures\b|treats\b|prescription|drug\b|fda approved|anti[- ]?cancer|diagnos)\b/i;
const BLOCK_KIDS =
  /\b(ce\s*certified\s*toy|en71\s*certified|medical device)\b/i;
/** Listings whose supplier title makes health, medical, safety or performance claims are not shown. */
const BLOCK_CLAIMS =
  /\b(cures?|cured|healing|heals?|therap(?:y|eutic)|medical|medicine|clinically|pain relief|relieves? pain|anti[- ]?(?:anxiety|aging|ageing|wrinkle|inflammatory|bacterial|viral|choke|snoring)|anxiety relief|detox|weight loss|slimming|fat burn(?:ing|er)?|immune|disinfect\w*|sterili[sz]\w*|orthop(?:a)?edic|posture correct\w*|fuel sav\w*|save fuel|power sav\w*|energy sav\w*|electricity sav\w*|horsepower|performance chip)\b/i;
/** Kids shop: items that are toys may only be listed when CJ reports a CE certification. */
const KIDS_TOY =
  /\b(toys?|montessori|puzzles?|building blocks?|plush|dolls?|rattles?|teethers?|games?)\b/i;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getToken(apiKey: string, forceNew = false): Promise<{ token: string; fresh: boolean }> {
  if (!forceNew && tokenCache && tokenCache.key === apiKey && tokenCache.until > Date.now()) {
    return { token: tokenCache.token, fresh: false };
  }
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(BASE + "/authentication/getAccessToken", {
      signal: AbortSignal.timeout(CJ_FETCH_TIMEOUT_MS),
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    const result: any = await response.json().catch(() => ({}));
    const qps = response.status === 429 || /too many requests|qps/i.test(String(result?.message || ""));
    if (qps && attempt < 4) {
      await sleep(CJ_GAP_MS * attempt);
      continue;
    }
    if (!response.ok || !result?.data?.accessToken) {
      throw new Error(result?.message || "CJ authentication failed");
    }
    const token = String(result.data.accessToken);
    const expiry = Date.parse(String(result.data.accessTokenExpiryDate || ""));
    const until = Number.isFinite(expiry)
      ? Math.min(expiry - 3600_000, Date.now() + 12 * 3600_000)
      : Date.now() + 3600_000;
    tokenCache = { key: apiKey, token, until };
    return { token, fresh: true };
  }
}

function catalogCacheUrl(origin: string, query: string, page: number) {
  return `${origin}/__cache/cj-products/v1?sector=${encodeURIComponent(PROFILE.sector)}&q=${encodeURIComponent(query)}&page=${page}`;
}

async function readCatalog(key: string): Promise<CachedCatalog | null> {
  const mem = memoryCatalog.get(key);
  if (mem) return mem;
  try {
    const cache = (globalThis as any).caches?.default;
    const hit = cache ? await cache.match(key) : null;
    if (!hit) return null;
    const value = (await hit.json()) as CachedCatalog;
    if (!value || typeof value.at !== "number") return null;
    memoryCatalog.set(key, value);
    return value;
  } catch {
    return null;
  }
}

async function writeCatalog(key: string, payload: any | null): Promise<CachedCatalog> {
  const value: CachedCatalog = { at: Date.now(), payload };
  memoryCatalog.set(key, value);
  try {
    const cache = (globalThis as any).caches?.default;
    if (cache) {
      await cache.put(
        key,
        new Response(JSON.stringify(value), {
          headers: { "content-type": "application/json", "cache-control": `public, max-age=${CACHE_KEEP_SECONDS}` },
        })
      );
    }
  } catch {
    /* best effort */
  }
  return value;
}

function parsePrice(value: unknown): number {
  const amount = Number.parseFloat(String(value || "").split("-")[0].trim());
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function flatten(data: any): any[] {
  const content = data?.content;
  if (!Array.isArray(content)) return [];
  return content.flatMap((group: any) => (Array.isArray(group?.productList) ? group.productList : []));
}

function blocked(name: string): boolean {
  if (BLOCK_GENERAL.test(name)) return true;
  if (BLOCK_CLAIMS.test(name)) return true;
  if (PROFILE.compliance === "beauty" && BLOCK_BEAUTY.test(name)) return true;
  if (PROFILE.compliance === "kids" && BLOCK_KIDS.test(name)) return true;
  if (PROFILE.compliance === "health_adjacent" && BLOCK_BEAUTY.test(name)) return true;
  return false;
}

function score(item: any): number {
  const listed = Number(item.listedNum) || 0;
  const inv = Math.min(Number(item.warehouseInventoryNum) || 0, 5000);
  const price = parsePrice(item.sellPrice || item.nowPrice);
  let s = listed + inv / 10;
  if (item.bigImage) s += 80;
  if (price >= 2 && price <= 180) s += 60;
  else if (price > 0 && price <= 400) s += 20;
  else s -= 40;
  if (PROFILE.preferCertified && (item.hasCECertification === true || item.hasCECertification === "true")) s += 50;
  if (item.verifiedWarehouse) s += 25;
  if (Number(item.totalVerifiedInventory) > 0) s += 15;
  const zone = JSON.stringify(item.zoneRecommendJson || "");
  if (/EU|Europe|DE|PL|CZ|NL|NO|SE|DK|FI/i.test(zone)) s += 35;
  if (blocked(String(item.nameEn || item.name || ""))) s -= 10000;
  return s;
}

/** Highest variant price in a CJ "min -- max" sellPrice (= min for single-price products). */
function parseMaxPrice(value: unknown): number {
  const parts = String(value || "").split(/\s*-+\s*/).map((v) => Number.parseFloat(v)).filter((n) => Number.isFinite(n) && n > 0);
  return parts.length ? Math.max(...parts) : 0;
}

/** Adds supplierPriceMaxUsd (variant price range) to products, also for cached payloads built before it existed. */
function withCostRange(payload: any) {
  const raw = new Map<string, any>();
  for (const item of flatten(payload?.data)) raw.set(String(item?.id || item?.sku || ""), item);
  const products = (Array.isArray(payload?.products) ? payload.products : []).map((product: any) => {
    if (product?.supplierPriceMaxUsd != null) return product;
    const source = raw.get(String(product?.id ?? ""));
    const max = source ? parseMaxPrice(source.sellPrice || source.nowPrice) : 0;
    return max > 0 ? { ...product, supplierPriceMaxUsd: max } : product;
  });
  return { ...payload, products };
}

function toProduct(item: any, index: number, sector: string) {
  const cost = parsePrice(item.sellPrice || item.nowPrice);
  const retail = cost > 0 ? Math.round(cost * 2.2 * 100) / 100 : 0;
  const costMax = parseMaxPrice(item.sellPrice || item.nowPrice) || cost;
  return {
    id: String(item.id || item.sku || index),
    name: String(item.nameEn || item.name || "CJ product").slice(0, 160),
    category: sector,
    cat: sector,
    sku: String(item.sku || ""),
    image: String(item.bigImage || ""),
    supplierPriceUsd: cost,
    supplierPriceMaxUsd: costMax,
    suggestedRetailUsd: retail,
    base: retail,
    brand: "CJ Dropshipping",
    supplier: "CJ Dropshipping",
    provider: "cj",
    listedNum: Number(item.listedNum) || 0,
    warehouseInventoryNum: Number(item.warehouseInventoryNum) || 0,
    hasCECertification: !!item.hasCECertification,
    compliance: "EU/Nordic curated — no fake medical/drug/CE-toy claims",
  };
}

function ingest(byId: Map<string, any>, data: any) {
  for (const item of flatten(data)) {
    const id = String(item?.id || item?.sku || "");
    if (!id) continue;
    if (!item.bigImage) continue;
    const price = parsePrice(item.sellPrice || item.nowPrice);
    if (price <= 0 || price > 1000) continue;
    if (blocked(String(item.nameEn || item.name || ""))) continue;
    if (PROFILE.compliance === "kids" && KIDS_TOY.test(String(item.nameEn || item.name || "")) && !(item.hasCECertification === true || item.hasCECertification === "true")) continue;
    const prev = byId.get(id);
    if (!prev || score(item) > score(prev)) byId.set(id, item);
  }
}

async function fetchPage(token: string, keyword: string, page: number, attempt = 1): Promise<any> {
  const productsUrl = new URL(BASE + "/product/listV2");
  productsUrl.searchParams.set("page", String(page));
  productsUrl.searchParams.set("size", String(FETCH_SIZE));
  productsUrl.searchParams.set("keyWord", keyword);
  const response = await fetch(productsUrl, { headers: { "CJ-Access-Token": token }, signal: AbortSignal.timeout(CJ_FETCH_TIMEOUT_MS) });
  const result: any = await response.json().catch(() => ({}));
  const msg = String(result?.message || result?.errorCode || "");
  const qps = response.status === 429 || /too many requests|qps/i.test(msg);
  if (qps && attempt < 4) {
    await sleep(CJ_GAP_MS * attempt);
    return fetchPage(token, keyword, page, attempt + 1);
  }
  if (!response.ok || result?.success === false) {
    throw new Error(result?.message || "CJ product request failed");
  }
  return result.data;
}

async function collectWinners(token: string, primaryQuery: string) {
  const fromMap = SECTOR_KEYWORDS[primaryQuery] || SECTOR_KEYWORDS[PROFILE.sector] || PROFILE.keywords;
  const keywords = Array.from(
    new Set([primaryQuery, ...fromMap].map((k) => k.trim().toLowerCase()).filter(Boolean))
  ).slice(0, MAX_KEYWORDS);

  let totalRecords = 0;
  const byId = new Map<string, any>();
  let paced = false;
  let fetched = 0;

  async function pacedFetch(keyword: string, page: number) {
    if (paced) await sleep(CJ_GAP_MS);
    paced = true;
    const data = await fetchPage(token, keyword, page);
    fetched++;
    return data;
  }

  // Primary query first — guarantee a non-empty boutique set even if later keywords fail.
  for (let page = 1; page <= Math.max(PAGES_PER_KEYWORD, 3); page++) {
    try {
      const data = await pacedFetch(primaryQuery, page);
      if (page === 1) totalRecords = Number(data?.totalRecords) || totalRecords;
      ingest(byId, data);
      const pages = Number(data?.totalPages) || 1;
      if (page >= pages) break;
      if (byId.size >= STOREFRONT_CAP) break;
    } catch (_) {
      break;
    }
  }

  // Extra sector keywords to diversify toward ~120–150.
  for (const keyword of keywords) {
    if (keyword === primaryQuery) continue;
    if (byId.size >= STOREFRONT_CAP) break;
    for (let page = 1; page <= PAGES_PER_KEYWORD; page++) {
      try {
        const data = await pacedFetch(keyword, page);
        if (!totalRecords && data?.totalRecords) totalRecords = Number(data.totalRecords) || 0;
        ingest(byId, data);
        const pages = Number(data?.totalPages) || 1;
        if (page >= pages) break;
        if (byId.size >= STOREFRONT_CAP) break;
      } catch (_) {
        break;
      }
    }
  }

  // Last-resort single page if somehow empty (should be rare with pacing).
  if (!byId.size) {
    try {
      await sleep(CJ_GAP_MS);
      const data = await fetchPage(token, primaryQuery, 1);
      fetched++;
      totalRecords = Number(data?.totalRecords) || totalRecords;
      ingest(byId, data);
    } catch (_) {}
  }

  const ranked = Array.from(byId.values()).sort((a, b) => score(b) - score(a));
  const winners = ranked.slice(0, STOREFRONT_CAP);
  return { winners, totalRecords: totalRecords || winners.length, scanned: byId.size, fetched };
}

function curatedPayload(
  sector: string,
  query: string,
  winners: any[],
  totalRecords: number,
  scanned: number,
  page: number
) {
  const products = winners.map((item, index) => toProduct(item, index, sector));
  const pageSize = STOREFRONT_CAP;
  const start = (page - 1) * pageSize;
  const pageProducts = products.slice(start, start + pageSize);
  const pageRaw = winners.slice(start, start + pageSize);
  return {
    ok: true,
    supplier: "cj",
    sector,
    query,
    page,
    markets: ["NO", "EU", "PE"],
    storefrontCap: STOREFRONT_CAP,
    count: pageProducts.length,
    scanned,
    source: "cj-live-curated",
    products: pageProducts,
    data: {
      pageSize: pageProducts.length,
      pageNumber: page,
      totalRecords,
      totalPages: Math.max(1, Math.ceil(Math.min(Math.max(products.length, 1), STOREFRONT_CAP) / pageSize)),
      content: [{ productList: pageRaw }],
      curatedCount: products.length,
    },
  };
}

/** CJ product id for checkout (kept as a string: 19-digit ids must not be rounded). */
function cjIds(product: any) {
  const id = String(product?.id ?? "");
  return { cj_pid: /^[A-Za-z0-9-]{6,64}$/.test(id) && id !== String(product?.sku ?? "") ? id : "" };
}

async function viaFallback(query: string, page: number, headers: Record<string, string>, env: any) {
  const proxy = new URL(CJ_LIVE_FALLBACK);
  proxy.searchParams.set("q", query);
  proxy.searchParams.set("page", String(page));
  proxy.searchParams.set("curate", "1");
  const response = await fetch(proxy.toString(), {
    headers: { "user-agent": "Mozilla/5.0 nordic-cj-fallback" },
  });
  const fetched: any = await response.json().catch(() => null);
  if (!response.ok || !fetched?.ok) {
    return Response.json({ error: fetched?.error || "CJ fallback failed" }, { status: 502, headers });
  }
  // The proxied store no longer publishes costs, so its rows come back unpriced (hidden) unless they carry a cost.
  const result = withCostRange(fetched);
  return Response.json(
    {
      ...publicPayload(result, await withQuotes(env, "cj", Array.isArray(result.products) ? result.products : [], cjIds)),
      sector: PROFILE.sector,
      query,
      page,
      markets: ["NO", "EU", "PE"],
      source: result.source || "cj-live-curated-fallback",
    },
    { headers }
  );
}

/** Trend-researched CJ winners (../_shared/cj-winners, data in catalog-data/cj-winners.json), same filters as above. */
function winnerDeps(context: any, origin: string): WinnerDeps {
  return {
    apiKey: String(context.env.CJ_API_KEY || ""),
    origin,
    sector: PROFILE.sector,
    getToken: (key, forceNew) => getToken(key, forceNew),
    fetchPage: (token, keyword, page) => fetchPage(token, keyword, page),
    flatten,
    accept: (item) => {
      const name = String(item?.nameEn || item?.name || "");
      const price = parsePrice(item?.sellPrice || item?.nowPrice);
      if (price <= 0 || price > 1000 || blocked(name)) return false;
      if (PROFILE.compliance === "kids" && KIDS_TOY.test(name) && !(item.hasCECertification === true || item.hasCECertification === "true")) return false;
      return true;
    },
    toProduct,
    waitUntil: typeof context.waitUntil === "function" ? (promise) => context.waitUntil(promise) : undefined,
  };
}

export async function onRequestGet(context: any) {
  const url = new URL(context.request.url);
  const wanted = (url.searchParams.get("q") || PROFILE.defaultQuery).toLowerCase();
  const knownSector =
    Boolean(SECTOR_KEYWORDS[wanted]) ||
    Array.from(Object.values(SECTOR_KEYWORDS)).some((arr) => arr.includes(wanted));
  const query = ALLOWED_Q.has(wanted) || knownSector ? wanted : PROFILE.defaultQuery;
  const requestedPage = Number.parseInt(url.searchParams.get("page") || "1", 10);
  const page = Number.isFinite(requestedPage) ? Math.min(3, Math.max(1, requestedPage)) : 1;
  const headers = {
    "access-control-allow-origin": "*",
    "cache-control": "public, max-age=120",
  };
  const apiKey = context.env.CJ_API_KEY;

  // Review list of winner candidates (no costs, no quotes) and the winners-only storefront (cj-winners.json).
  if (apiKey && url.searchParams.get("winners") === "review") {
    const rows = await winnerRows(winnerDeps(context, url.origin), "review");
    return Response.json(
      {
        ok: true,
        supplier: "cj",
        sector: PROFILE.sector,
        source: "cj-winners-review",
        count: rows.length,
        keywordsCached: new Set(rows.map((row) => row.keyword)).size,
        status: winnersStatus(),
        products: rows.map((row) => ({
          id: row.id, sku: row.sku, name: row.name, image: row.image, priceNok: retailNok("cj", row),
          listedNum: row.listedNum, warehouseInventoryNum: row.warehouseInventoryNum, keyword: row.keyword, vetted: row.vetted, ce: row.hasCECertification === true,
        })),
      },
      { headers: { ...headers, "cache-control": "no-store" } }
    );
  }
  if (apiKey && WINNERS_ONLY) {
    const rows = page === 1 ? await winnerRows(winnerDeps(context, url.origin), "grid") : [];
    const products = await withQuotes(context.env, "cj", rows, cjIds);
    return Response.json(
      { ok: true, supplier: "cj", sector: PROFILE.sector, query, page, markets: ["NO", "EU", "PE"], count: products.length, source: "cj-winners", products },
      { headers }
    );
  }

  if (!apiKey) {
    if (!PROFILE.enableFallback) {
      return Response.json({ error: "CJ is not configured" }, { status: 503, headers });
    }
    try {
      return await viaFallback(query, page, headers, context.env);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "CJ request failed" },
        { status: 502, headers }
      );
    }
  }

  const emptyResponse = (state: string) =>
    Response.json(
      { error: "CJ curated catalog empty after QPS-paced fetch", ok: false, supplier: "cj", query },
      { status: 502, headers: { ...headers, "x-catalog-cache": state } }
    );
  const serve = async (payload: any, state: string) => {
    const ranged = withCostRange(payload);
    const shown = new Set<string>((ranged.products || []).map((product: any) => String(product?.id ?? "")));
    const extra = page === 1 && query === PROFILE.defaultQuery ? await winnerRows(winnerDeps(context, url.origin), "grid", shown) : [];
    const body = publicPayload(ranged, await withQuotes(context.env, "cj", [...(ranged.products || []), ...extra], cjIds));
    return Response.json(body, { headers: { ...headers, "x-catalog-cache": state } });
  };

  const cacheKey = catalogCacheUrl(url.origin, query, page);
  const cached = await readCatalog(cacheKey);
  const age = cached ? Date.now() - cached.at : Number.POSITIVE_INFINITY;
  if (cached?.payload && age < CACHE_FRESH_MS) return serve(cached.payload, "hit");
  if (cached && !cached.payload && age < EMPTY_RETRY_MS) return emptyResponse("hit-empty");

  let refreshError: unknown = null;
  let refresh = inflight.get(cacheKey);
  if (!refresh) {
    refresh = (async () => {
      let auth = await getToken(apiKey);
      if (auth.fresh) await sleep(CJ_GAP_MS); // QPS: auth counts as a request
      let result = await collectWinners(auth.token, query);
      if (!result.fetched && !auth.fresh) {
        // Reused token may have been replaced/expired: retry once with a new one.
        auth = await getToken(apiKey, true);
        await sleep(CJ_GAP_MS);
        result = await collectWinners(auth.token, query);
      }
      if (result.winners.length) {
        return writeCatalog(cacheKey, curatedPayload(PROFILE.sector, query, result.winners, result.totalRecords, result.scanned, page));
      }
      // CJ answered but every listing was filtered out: remember briefly instead of re-querying on each view.
      if (result.fetched && !cached?.payload) return writeCatalog(cacheKey, null);
      return null;
    })();
    inflight.set(cacheKey, refresh);
    refresh.finally(() => inflight.delete(cacheKey)).catch(() => {});
  }
  // Stale copy available: answer at once and let the refresh finish in the background (stale-while-revalidate).
  if (cached?.payload) {
    if (typeof context.waitUntil === "function") context.waitUntil(refresh.catch(() => null));
    return serve(cached.payload, "stale-revalidate");
  }
  let fresh: CachedCatalog | null = null;
  try {
    fresh = await refresh;
  } catch (error) {
    refreshError = error;
  }
  if (fresh?.payload) return serve(fresh.payload, "miss");
  if (cached?.payload) return serve(cached.payload, "stale");

  if (PROFILE.enableFallback) {
    try {
      return await viaFallback(query, page, headers, context.env);
    } catch (_) {}
  }
  if (!refreshError) return emptyResponse(fresh ? "miss-empty" : "miss");
  return Response.json(
    { error: refreshError instanceof Error ? refreshError.message : "CJ request failed" },
    { status: 502, headers }
  );
}
