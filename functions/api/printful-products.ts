const BASE = "https://api.printful.com";

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
  if (!key) return "beauty";
  if (SECTOR_ALIASES[key]) return SECTOR_ALIASES[key];
  for (const [alias, sector] of Object.entries(SECTOR_ALIASES)) {
    if (key.includes(alias) || alias.includes(key)) return sector;
  }
  return SECTOR_ALIASES[key] ? SECTOR_ALIASES[key] : (SECTOR_CATEGORIES[key] ? key : "beauty");
}

function authHeaders(token?: string, storeId?: string) {
  const headers: Record<string, string> = { "User-Agent": "NordicStore/1.0" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (storeId) headers["X-PF-Store-Id"] = storeId;
  return headers;
}

function normalizeCatalog(row: any, index: number, sector: string, costHint = 0) {
  const cost = money(costHint);
  const retail = cost > 0 ? money(cost * (TYPE_MARKUP.default || 2.35)) : 0;
  return {
    id: String(row?.id || `printful-catalog-${index}`),
    sku: `PFL-${row?.id || index}`,
    supplier: "Printful",
    provider: "printful",
    printfulProductId: String(row?.id || ""),
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
  const response = await fetch(url, { headers });
  if (!response.ok) return [] as any[];
  const result: any = await response.json().catch(() => ({}));
  const list = Array.isArray(result?.result) ? result.result : [];
  const out = [];
  for (const row of list.slice(0, 50)) {
    const base = normalizeStore(row, out.length, sector);
    try {
      const detailRes = await fetch(`${BASE}/store/products/${base.id}`, { headers });
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
    const response = await fetch(url, { headers });
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
  const priced = await Promise.all(
    slice.map(async (row, index) => {
      let cost = 0;
      try {
        const detailRes = await fetch(`${BASE}/products/${row.id}`, { headers });
        if (detailRes.ok) {
          const detail: any = await detailRes.json();
          const variants = Array.isArray(detail?.result?.variants) ? detail.result.variants : [];
          const inStock = variants.find((v: any) => v?.in_stock && money(v?.price) > 0) || variants.find((v: any) => money(v?.price) > 0);
          cost = money(inStock?.price);
          if (inStock?.image) row.image = inStock.image;
        }
      } catch (_) {}
      const item = normalizeCatalog(row, index, sector, cost);
      if (!item.suggestedRetailUsd) {
        item.supplierPriceUsd = 12;
        item.suggestedRetailUsd = 28.9;
      }
      return item;
    })
  );
  return priced.filter((p) => p.name && p.suggestedRetailUsd > 0).slice(0, 50);
}

export async function onRequestGet(context: any) {
  const url = new URL(context.request.url);
  const wanted = url.searchParams.get("q") || url.searchParams.get("sector") || "";
  const sector = resolveSector(wanted || "beauty");
  const headersOut = { "access-control-allow-origin": "*", "cache-control": "public, max-age=300" };
  const token = context.env.PRINTFUL_API_TOKEN ? String(context.env.PRINTFUL_API_TOKEN) : "";
  const storeId = context.env.PRINTFUL_STORE_ID ? String(context.env.PRINTFUL_STORE_ID) : "";
  const headers = authHeaders(token || undefined, storeId || undefined);

  try {
    if (token) {
      const storeProducts = await loadStoreProducts(headers, sector);
      if (storeProducts.length >= 8) {
        return Response.json({
          ok: true,
          supplier: "Printful",
          sector,
          query: sector,
          products: storeProducts.slice(0, 50),
          count: Math.min(storeProducts.length, 50),
          source: "printful-live-store",
          markets: ["NO", "EU", "PE"],
          compliance: "EU/Nordic POD merch",
        }, { headers: headersOut });
      }
    }

    const catalog = await loadCatalogByCategories(headers, sector);
    return Response.json({
      ok: true,
      supplier: "Printful",
      sector,
      query: sector,
      products: catalog,
      count: catalog.length,
      source: "printful-live-catalog",
      markets: ["NO", "EU", "PE"],
      compliance: "EU/Nordic POD merch",
    }, { status: catalog.length ? 200 : 503, headers: headersOut });
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
