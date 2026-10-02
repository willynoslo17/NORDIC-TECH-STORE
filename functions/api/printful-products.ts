import { withQuotes } from "../_shared/quote";
import { STORE } from "../_shared/store";
import snapshotRows from "../_shared/catalog-data/printful-snapshot.json";

const BASE = "https://api.printful.com";

/**
 * Stable Printful catalog (2026-10-02). Every page view used to call Printful live (~60 requests: category lists +
 * one detail call per product) with no cache. All stores share the Printful rate limit, so under load the category
 * calls got rate-limited and the feed returned only part of the products (e.g. 4 or 23 of 50) and the grid shrank.
 * Now: the last good list is cached (isolate memory + Cache API, served at once, refreshed in the background), a
 * live result is merged with that list and with a bundled server-only snapshot (catalog-data/printful-snapshot.json:
 * the 50 products each store showed, cost basis = displayed price), so a product that was shown never disappears
 * because of a failed or partial Printful call. Calls are retried on 429 and detail calls run in small batches.
 */
const SNAPSHOT: any[] = Array.isArray(snapshotRows) ? (snapshotRows as any[]) : [];
const FRESH_MS = 30 * 60 * 1000;
const KEEP_SECONDS = 7 * 24 * 3600;
const LIVE_WAIT_MS = 6000;
const GOOD_KEY = `https://printful-catalog-cache.invalid/v2/${encodeURIComponent(STORE.slug)}`;
let memoryGood: { at: number; rows: any[] } | null = null;
let refreshing: Promise<any[]> | null = null;
let refreshStarted = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Printful GET with one retry on rate limiting (429) and a hard timeout. */
async function pfFetch(url: string | URL, headers: Record<string, string>): Promise<Response> {
  let response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
  if (response.status === 429) {
    await sleep(1500);
    response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
  }
  return response;
}

async function readGood(): Promise<{ at: number; rows: any[] } | null> {
  if (memoryGood) return memoryGood;
  try {
    const cache = (globalThis as any).caches?.default;
    const hit = cache ? await cache.match(GOOD_KEY) : null;
    if (hit) {
      const value = (await hit.json()) as { at: number; rows: any[] };
      if (value && Array.isArray(value.rows)) memoryGood = value;
    }
  } catch {
    /* best effort */
  }
  return memoryGood;
}

async function writeGood(rows: any[]) {
  memoryGood = { at: Date.now(), rows };
  try {
    const cache = (globalThis as any).caches?.default;
    if (cache) await cache.put(GOOD_KEY, new Response(JSON.stringify(memoryGood), {
      headers: { "content-type": "application/json", "cache-control": `public, max-age=${KEEP_SECONDS}` },
    }));
  } catch {
    /* best effort */
  }
}

/** fresh first (a fresh row whose cost lookup failed keeps the earlier known row), then earlier rows, then snapshot. */
function mergeRows(fresh: any[], good: any[], snap: any[]): any[] {
  const known = new Map<string, any>();
  for (const row of [...snap, ...good]) if (row?.id) known.set(String(row.id), row);
  const out: any[] = [];
  const seen = new Set<string>();
  for (const row of fresh) {
    const id = String(row?.id || "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row?._costKnown === false && known.has(id) ? known.get(id) : row);
  }
  for (const row of [...good, ...snap]) {
    const id = String(row?.id || "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

const SECTOR_ALIASES: Record<string, string> = {
  beauty: "beauty", perfume: "beauty", perfumes: "beauty", skincare: "beauty",
  toys: "toys", kids: "toys", kid: "toys", children: "toys",
  electronics: "electronics", tech: "electronics", technology: "electronics",
  "pet supplies": "pet supplies", pets: "pet supplies", pet: "pet supplies",
  "home living": "home living", home: "home living", living: "home living",
  fitness: "fitness", outdoor: "fitness", sports: "fitness",
  "solar energy": "solar energy", energy: "solar energy", solar: "solar energy",
  "car accessories": "car accessories", car: "car accessories", auto: "car accessories", automotive: "car accessories",
};

/** Printful catalog category IDs chosen per Nordic sector (POD merch only). */
const SECTOR_CATEGORIES: Record<string, number[]> = {
  beauty: [48, 195, 29, 2, 258, 202],
  toys: [3, 228, 55, 105, 202],
  electronics: [244, 245, 250, 243, 251, 198, 202],
  "pet supplies": [48, 49, 29, 16, 202],
  "home living": [55, 56, 195, 258, 252, 230, 198],
  fitness: [28, 7, 29, 98, 271, 221],
  "solar energy": [55, 56, 48, 21, 202],
  "car accessories": [42, 40, 15, 93, 28, 221],
};

const TYPE_MARKUP: Record<string, number> = {
  default: 2.35,
};

function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0;
}

function resolveSector(raw: string) {
  const key = String(raw || "").toLowerCase().trim();
  if (!key) return STORE.sector;
  if (SECTOR_ALIASES[key]) return SECTOR_ALIASES[key];
  for (const [alias, sector] of Object.entries(SECTOR_ALIASES)) {
    if (key.includes(alias) || alias.includes(key)) return sector;
  }
  return SECTOR_ALIASES[key] ? SECTOR_ALIASES[key] : (SECTOR_CATEGORIES[key] ? key : STORE.sector);
}

function printfulIds(product: any) {
  return {
    printful_product_id: product?.printfulProductId,
    printful_sync_variant_id: product?.printfulSyncVariantId,
    printful_variant_id: product?.printfulVariantId,
    printful_external_variant_id: product?.printfulExternalVariantId,
  };
}

function authHeaders(token?: string, storeId?: string) {
  const headers: Record<string, string> = { "User-Agent": "NordicStore/1.0" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (storeId) headers["X-PF-Store-Id"] = storeId;
  return headers;
}

function normalizeCatalog(row: any, index: number, sector: string, costHint = 0, variantId = "") {
  const cost = money(costHint);
  const retail = cost > 0 ? money(cost * (TYPE_MARKUP.default || 2.35)) : 0;
  return {
    id: String(row?.id || `printful-catalog-${index}`),
    sku: `PFL-${row?.id || index}`,
    supplier: "Printful",
    provider: "printful",
    printfulProductId: String(row?.id || ""),
    // Catalog (blank) variant. No design files are attached, so orders need manual artwork.
    printfulVariantId: String(variantId || ""),
    printfulSyncVariantId: "",
    printfulSource: "catalog",
    name: String(row?.title || row?.name || "Printful product"),
    category: String(row?.type_name || row?.type || sector),
    brand: String(row?.brand || "Printful"),
    supplierPriceUsd: cost || retail,
    suggestedRetailUsd: retail || cost,
    image: String(row?.image || ""),
    sector,
    compliance: "EU/Nordic POD merch only — apparel/poster/mug/tote/case/cap; no cosmetics liquids, no toy CE claims, no health claims",
  };
}

function normalizeStore(row: any, index: number, sector: string) {
  const sync = row?.sync_product || row;
  const retail = money(sync?.retail_price || row?.retail_price);
  return {
    id: String(sync?.id || `printful-store-${index}`),
    sku: String(sync?.external_id || sync?.id || ""),
    supplier: "Printful",
    provider: "printful",
    printfulProductId: String(sync?.id || ""),
    printfulSyncVariantId: "",
    printfulVariantId: "",
    printfulExternalVariantId: "",
    printfulSource: "store",
    name: String(sync?.name || "Printful product"),
    category: "Printful",
    brand: "Printful",
    supplierPriceUsd: retail,
    suggestedRetailUsd: retail,
    image: String(sync?.thumbnail_url || sync?.image || ""),
    sector,
    compliance: "EU/Nordic POD merch only — apparel/poster/mug/tote/case/cap; no cosmetics liquids, no toy CE claims, no health claims",
  };
}

async function loadStoreProducts(headers: Record<string, string>, sector: string) {
  const url = new URL(BASE + "/store/products");
  url.searchParams.set("limit", "50");
  url.searchParams.set("offset", "0");
  const response = await pfFetch(url, headers);
  if (!response.ok) return [] as any[];
  const result: any = await response.json().catch(() => ({}));
  const list = Array.isArray(result?.result) ? result.result : [];
  const out = [];
  for (const row of list.slice(0, 50)) {
    const base = normalizeStore(row, out.length, sector);
    try {
      const detailRes = await pfFetch(`${BASE}/store/products/${base.id}`, headers);
      const detail: any = await detailRes.json().catch(() => ({}));
      if (detailRes.ok) {
        const variants = Array.isArray(detail?.result?.sync_variants) ? detail.result.sync_variants : [];
        const priced = variants.find((v: any) => money(v?.retail_price) > 0) || variants[0];
        const retail = money(priced?.retail_price);
        if (retail > 0) {
          base.supplierPriceUsd = retail;
          base.suggestedRetailUsd = retail;
        }
        base.sku = String(priced?.sku || base.sku);
        // Keep the Printful IDs checkout needs for fulfillment (sync variant = store product with design).
        base.printfulSyncVariantId = priced?.id != null ? String(priced.id) : "";
        base.printfulVariantId = priced?.variant_id != null ? String(priced.variant_id) : "";
        base.printfulExternalVariantId = priced?.external_id != null ? String(priced.external_id) : "";
        const preview = priced?.files?.find?.((f: any) => f?.type === "preview")?.preview_url;
        if (preview) base.image = String(preview);
      }
    } catch (_) {}
    if (base.name && base.suggestedRetailUsd > 0) out.push(base);
  }
  return out;
}

async function loadCatalogByCategories(headers: Record<string, string>, sector: string) {
  const cats = SECTOR_CATEGORIES[sector] || SECTOR_CATEGORIES.beauty;
  const seen = new Set<string>();
  const collected: any[] = [];
  const fallbackCats = [229, 4, 5, 6, 1];
  const allCats = [...cats, ...fallbackCats.filter((c) => !cats.includes(c))];
  for (const categoryId of allCats) {
    if (collected.length >= 60) break;
    const url = new URL(BASE + "/products");
    url.searchParams.set("category_id", String(categoryId));
    const response = await pfFetch(url, headers);
    if (!response.ok) continue;
    const result: any = await response.json().catch(() => ({}));
    const list = Array.isArray(result?.result) ? result.result : [];
    for (const row of list) {
      const id = String(row?.id || "");
      if (!id || seen.has(id) || row?.is_discontinued) continue;
      seen.add(id);
      collected.push(row);
      if (collected.length >= 60) break;
    }
  }
  // Price a subset in parallel (first 50)
  const slice = collected.slice(0, 50);
  const priced: any[] = [];
  for (let start = 0; start < slice.length; start += 10) priced.push(...await Promise.all(
    slice.slice(start, start + 10).map(async (row, i) => {
      const index = start + i;
      let cost = 0;
      let variantId = "";
      try {
        const detailRes = await pfFetch(`${BASE}/products/${row.id}`, headers);
        if (detailRes.ok) {
          const detail: any = await detailRes.json();
          const variants = Array.isArray(detail?.result?.variants) ? detail.result.variants : [];
          const inStock = variants.find((v: any) => v?.in_stock && money(v?.price) > 0) || variants.find((v: any) => money(v?.price) > 0);
          cost = money(inStock?.price);
          variantId = inStock?.id != null ? String(inStock.id) : "";
          if (inStock?.image) row.image = inStock.image;
        }
      } catch (_) {}
      const item: any = normalizeCatalog(row, index, sector, cost, variantId);
      item._costKnown = cost > 0;
      if (!item.suggestedRetailUsd) {
        item.supplierPriceUsd = 12;
        item.suggestedRetailUsd = 28.9;
      }
      return item;
    })
  ));
  return priced.filter((p) => p.name && p.suggestedRetailUsd > 0).slice(0, 50);
}

export async function onRequestGet(context: any) {
  const url = new URL(context.request.url);
  const wanted = url.searchParams.get("q") || url.searchParams.get("sector") || "";
  // Each shop serves its own sector only (a missing or foreign ?q= used to fall back to "beauty").
  const sector = STORE.sector;
  const headersOut = { "access-control-allow-origin": "*", "cache-control": "public, max-age=300" };
  const token = context.env.PRINTFUL_API_TOKEN ? String(context.env.PRINTFUL_API_TOKEN) : "";
  const storeId = context.env.PRINTFUL_STORE_ID ? String(context.env.PRINTFUL_STORE_ID) : "";
  const headers = authHeaders(token || undefined, storeId || undefined);

  try {
    const live = async (): Promise<{ rows: any[]; source: string }> => {
      if (token) {
        const storeProducts = await loadStoreProducts(headers, sector);
        if (storeProducts.length >= 8) return { rows: storeProducts.slice(0, 50), source: "printful-live-store" };
      }
      return { rows: await loadCatalogByCategories(headers, sector), source: "printful-live-catalog" };
    };
    const good = await readGood();
    const stale = !good || Date.now() - good.at > FRESH_MS;
    let fresh: any[] = [];
    let source = good ? "printful-cache" : "printful-snapshot";
    if (stale && (!refreshing || Date.now() - refreshStarted > 60000)) {
      refreshStarted = Date.now();
      refreshing = live()
        .then(async (result) => {
          const merged = mergeRows(result.rows, good?.rows || [], SNAPSHOT);
          if (result.rows.length) await writeGood(merged);
          return result.rows;
        })
        .catch(() => [] as any[])
        .finally(() => { refreshing = null; });
      if (typeof context.waitUntil === "function") context.waitUntil(refreshing);
    }
    // No cached list yet in this data centre: wait briefly for Printful, otherwise answer from the snapshot.
    if (!good && refreshing) {
      const result = await Promise.race([refreshing, sleep(LIVE_WAIT_MS).then(() => null)]);
      if (result && result.length) { fresh = result; source = "printful-live-catalog"; }
    }
    const rows = mergeRows(fresh, memoryGood?.rows || good?.rows || [], SNAPSHOT);
    return Response.json({
      ok: true,
      supplier: "Printful",
      sector,
      query: sector,
      products: await withQuotes(context.env, "printful", rows, printfulIds),
      count: rows.length,
      source,
      markets: ["NO", "EU", "PE"],
      compliance: "EU/Nordic POD merch",
    }, { status: rows.length ? 200 : 503, headers: headersOut });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Printful request failed",
      products: [],
      supplier: "Printful",
      sector,
      source: "printful-error",
    }, { status: 502, headers: headersOut });
  }
}
