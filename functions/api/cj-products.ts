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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getToken(apiKey: string) {
  const response = await fetch(BASE + "/authentication/getAccessToken", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  const result: any = await response.json();
  if (!response.ok || !result?.data?.accessToken) {
    throw new Error(result?.message || "CJ authentication failed");
  }
  return result.data.accessToken as string;
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

function toProduct(item: any, index: number, sector: string) {
  const cost = parsePrice(item.sellPrice || item.nowPrice);
  const retail = cost > 0 ? Math.round(cost * 2.2 * 100) / 100 : 0;
  return {
    id: String(item.id || item.sku || index),
    name: String(item.nameEn || item.name || "CJ product").slice(0, 160),
    category: sector,
    cat: sector,
    sku: String(item.sku || ""),
    image: String(item.bigImage || ""),
    supplierPriceUsd: cost,
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
    const prev = byId.get(id);
    if (!prev || score(item) > score(prev)) byId.set(id, item);
  }
}

async function fetchPage(token: string, keyword: string, page: number, attempt = 1): Promise<any> {
  const productsUrl = new URL(BASE + "/product/listV2");
  productsUrl.searchParams.set("page", String(page));
  productsUrl.searchParams.set("size", String(FETCH_SIZE));
  productsUrl.searchParams.set("keyWord", keyword);
  const response = await fetch(productsUrl, { headers: { "CJ-Access-Token": token } });
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

  async function pacedFetch(keyword: string, page: number) {
    if (paced) await sleep(CJ_GAP_MS);
    paced = true;
    return fetchPage(token, keyword, page);
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
      totalRecords = Number(data?.totalRecords) || totalRecords;
      ingest(byId, data);
    } catch (_) {}
  }

  const ranked = Array.from(byId.values()).sort((a, b) => score(b) - score(a));
  const winners = ranked.slice(0, STOREFRONT_CAP);
  return { winners, totalRecords: totalRecords || winners.length, scanned: byId.size };
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

async function viaFallback(query: string, page: number, headers: Record<string, string>) {
  const proxy = new URL(CJ_LIVE_FALLBACK);
  proxy.searchParams.set("q", query);
  proxy.searchParams.set("page", String(page));
  proxy.searchParams.set("curate", "1");
  const response = await fetch(proxy.toString(), {
    headers: { "user-agent": "Mozilla/5.0 nordic-cj-fallback" },
  });
  const result: any = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    return Response.json({ error: result?.error || "CJ fallback failed" }, { status: 502, headers });
  }
  return Response.json(
    {
      ...result,
      sector: PROFILE.sector,
      query,
      page,
      markets: ["NO", "EU", "PE"],
      source: result.source || "cj-live-curated-fallback",
    },
    { headers }
  );
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

  if (!apiKey) {
    if (!PROFILE.enableFallback) {
      return Response.json({ error: "CJ is not configured" }, { status: 503, headers });
    }
    try {
      return await viaFallback(query, page, headers);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "CJ request failed" },
        { status: 502, headers }
      );
    }
  }

  try {
    const token = await getToken(apiKey);
    await sleep(CJ_GAP_MS); // QPS: auth counts as a request
    const { winners, totalRecords, scanned } = await collectWinners(token, query);
    if (!winners.length) {
      // Never advertise empty curated boutique — surface real failure for retry/failover.
      if (PROFILE.enableFallback) {
        try {
          return await viaFallback(query, page, headers);
        } catch (_) {}
      }
      return Response.json(
        { error: "CJ curated catalog empty after QPS-paced fetch", ok: false, supplier: "cj", query },
        { status: 502, headers }
      );
    }
    return Response.json(curatedPayload(PROFILE.sector, query, winners, totalRecords, scanned, page), {
      headers,
    });
  } catch (error) {
    if (PROFILE.enableFallback) {
      try {
        return await viaFallback(query, page, headers);
      } catch (_) {}
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "CJ request failed" },
      { status: 502, headers }
    );
  }
}
