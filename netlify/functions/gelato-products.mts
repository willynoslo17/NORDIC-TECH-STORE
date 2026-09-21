const PRODUCT_BASE = "https://product.gelatoapis.com";
const ECOM_BASE = "https://ecommerce.gelatoapis.com";

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

/** Preferred Gelato catalog UIDs per sector (POD merch). Unknown UIDs are skipped. */
const SECTOR_CATALOGS: Record<string, string[]> = {
  beauty: ["apparel", "tote-bags", "mugs", "posters", "canvas"],
  toys: ["posters", "apparel", "canvas", "cards"],
  electronics: ["phone-cases", "apparel", "mugs", "posters"],
  "pet supplies": ["apparel", "tote-bags", "mugs", "posters"],
  "home living": ["posters", "canvas", "mugs", "tote-bags", "apparel", "pillows"],
  fitness: ["apparel", "tote-bags", "posters", "mugs"],
  "solar energy": ["posters", "tote-bags", "apparel", "canvas"],
  "car accessories": ["apparel", "tote-bags", "posters", "mugs"],
};

const FALLBACK_CATALOGS = ["posters", "apparel", "mugs", "canvas", "cards", "tote-bags", "phone-cases", "pillows", "calendars", "framed-posters"];

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
  return SECTOR_CATALOGS[key] ? key : "beauty";
}

function prettyTitle(productUid: string, catalogUid: string, product: any) {
  if (product?.title) return String(product.title);
  if (product?.name) return String(product.name);
  const bits = String(productUid || "").split("_").filter(Boolean);
  const human = bits
    .slice(0, 6)
    .map((b) => b.replace(/-/g, " "))
    .join(" · ");
  const cat = String(catalogUid || "Gelato").replace(/-/g, " ");
  return human ? `${cat}: ${human}` : `Gelato ${cat} product`;
}

function estimateRetail(catalogUid: string) {
  const c = String(catalogUid || "").toLowerCase();
  if (c.includes("mug")) return { cost: 6.5, retail: 18.9 };
  if (c.includes("tote")) return { cost: 7.1, retail: 22.5 };
  if (c.includes("poster") || c.includes("canvas")) return { cost: 8.2, retail: 24.9 };
  if (c.includes("phone") || c.includes("case")) return { cost: 8.8, retail: 24.9 };
  if (c.includes("pillow")) return { cost: 11, retail: 32.9 };
  if (c.includes("apparel") || c.includes("shirt") || c.includes("hoodie")) return { cost: 9.4, retail: 29.9 };
  return { cost: 9, retail: 26.9 };
}

function normalizeCatalogProduct(product: any, index: number, sector: string, catalogUid: string) {
  const uid = String(product?.productUid || product?.id || `gelato-${index}`);
  const prices = estimateRetail(catalogUid);
  const retail = money(product?.price?.basePrice ?? product?.price?.amount ?? product?.price) || prices.retail;
  const cost = money(product?.cost ?? product?.supplierPrice) || prices.cost;
  return {
    id: uid,
    sku: uid.slice(0, 48),
    supplier: "Gelato",
    provider: "gelato",
    gelatoProductUid: uid,
    name: prettyTitle(uid, catalogUid, product),
    category: String(product?.category || catalogUid || sector),
    brand: "Gelato",
    supplierPriceUsd: cost,
    suggestedRetailUsd: retail,
    image: String(product?.previewUrl || product?.imageUrl || product?.thumbnailUrl || product?.image || ""),
    sector,
    catalogUid,
    compliance: "EU/Nordic POD merch only — apparel/poster/mug/tote/case/cap; no cosmetics liquids, no toy CE claims, no health claims",
  };
}

function normalizeEcom(product: any, index: number, sector: string) {
  const retail = money(
    product?.price?.basePrice ?? product?.price?.amount ?? product?.price ?? product?.suggestedRetailUsd ?? product?.retailPrice
  );
  return {
    id: String(product?.id || product?.productUid || `gelato-ecom-${index}`),
    sku: String(product?.sku || product?.productUid || product?.id || ""),
    supplier: "Gelato",
    provider: "gelato",
    gelatoProductUid: String(product?.productUid || product?.id || ""),
    name: String(product?.title || product?.name || "Gelato product"),
    category: String(product?.category || sector),
    brand: "Gelato",
    supplierPriceUsd: retail,
    suggestedRetailUsd: retail,
    image: String(product?.previewUrl || product?.imageUrl || product?.image || product?.thumbnailUrl || ""),
    sector,
    compliance: "EU/Nordic POD merch only — apparel/poster/mug/tote/case/cap; no cosmetics liquids, no toy CE claims, no health claims",
  };
}

async function listCatalogUids(headers: Record<string, string>) {
  const response = await fetch(`${PRODUCT_BASE}/v3/catalogs`, { headers });
  if (!response.ok) return [] as string[];
  const result: any = await response.json().catch(() => []);
  const list = Array.isArray(result) ? result : Array.isArray(result?.catalogs) ? result.catalogs : [];
  return list.map((c: any) => String(c?.catalogUid || c?.uid || c?.id || "")).filter(Boolean);
}

async function searchCatalog(headers: Record<string, string>, catalogUid: string, limit: number) {
  const response = await fetch(`${PRODUCT_BASE}/v3/catalogs/${encodeURIComponent(catalogUid)}/products:search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ offset: 0, limit }),
  });
  if (!response.ok) return [] as any[];
  const result: any = await response.json().catch(() => ({}));
  if (Array.isArray(result?.products)) return result.products;
  if (Array.isArray(result)) return result;
  return [];
}

async function loadStoreProducts(headers: Record<string, string>, storeId: string, sector: string) {
  const url = new URL(`${ECOM_BASE}/v1/stores/${storeId}/products`);
  url.searchParams.set("limit", "100");
  url.searchParams.set("offset", "0");
  const response = await fetch(url.toString(), { headers });
  if (!response.ok) return [] as any[];
  const result: any = await response.json().catch(() => ({}));
  const list = Array.isArray(result?.products) ? result.products : Array.isArray(result) ? result : [];
  return list.map((p: any, i: number) => normalizeEcom(p, i, sector)).filter((p: any) => p.name && p.suggestedRetailUsd > 0);
}

async function loadCatalogProducts(headers: Record<string, string>, sector: string) {
  const available = await listCatalogUids(headers);
  const preferred = SECTOR_CATALOGS[sector] || SECTOR_CATALOGS.beauty;
  const ordered = [
    ...preferred.filter((c) => !available.length || available.includes(c)),
    ...available.filter((c) => !preferred.includes(c)),
    ...FALLBACK_CATALOGS.filter((c) => !preferred.includes(c) && !available.includes(c)),
  ];
  const uniqueCatalogs = [...new Set(ordered)];
  const seen = new Set<string>();
  const out: any[] = [];
  for (const catalogUid of uniqueCatalogs) {
    if (out.length >= 50) break;
    const need = Math.min(25, 50 - out.length);
    const products = await searchCatalog(headers, catalogUid, need + 5);
    for (const product of products) {
      const item = normalizeCatalogProduct(product, out.length, sector, catalogUid);
      if (!item.id || seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
      if (out.length >= 50) break;
    }
  }
  return out.slice(0, 50);
}

async function onRequestGet(context: any) {
  const url = new URL(context.request.url);
  const wanted = url.searchParams.get("q") || url.searchParams.get("sector") || "";
  const sector = resolveSector(wanted || "beauty");
  const headersOut = { "access-control-allow-origin": "*", "cache-control": "public, max-age=300" };
  const apiKey = context.env.GELATO_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Gelato is not configured", products: [], supplier: "Gelato", sector, source: "gelato-unconfigured" }, { status: 503, headers: headersOut });
  }
  const headers = { "X-API-KEY": String(apiKey), "content-type": "application/json", "User-Agent": "NordicStore/1.0" };

  try {
    let storeId = context.env.GELATO_STORE_ID ? String(context.env.GELATO_STORE_ID) : "";
    if (!storeId) {
      const storesRes = await fetch(`${ECOM_BASE}/v1/stores`, { headers });
      if (storesRes.ok) {
        const stores: any = await storesRes.json().catch(() => ({}));
        const list = Array.isArray(stores?.stores) ? stores.stores : Array.isArray(stores) ? stores : [];
        storeId = String(list[0]?.id || list[0]?.storeId || "");
      }
    }
    if (storeId) {
      const storeProducts = await loadStoreProducts(headers, storeId, sector);
      if (storeProducts.length >= 8) {
        return Response.json({
          ok: true,
          supplier: "Gelato",
          sector,
          query: sector,
          products: storeProducts.slice(0, 50),
          count: Math.min(storeProducts.length, 50),
          source: "gelato-live-store",
          storeId,
          markets: ["NO", "EU", "PE"],
          compliance: "EU/Nordic POD merch",
        }, { headers: headersOut });
      }
    }

    const catalog = await loadCatalogProducts(headers, sector);
    return Response.json({
      ok: true,
      supplier: "Gelato",
      sector,
      query: sector,
      products: catalog,
      count: catalog.length,
      source: "gelato-live-catalog",
      markets: ["NO", "EU", "PE"],
      compliance: "EU/Nordic POD merch",
    }, { status: catalog.length ? 200 : 503, headers: headersOut });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Gelato request failed",
      products: [],
      supplier: "Gelato",
      sector,
      source: "gelato-error",
    }, { status: 502, headers: headersOut });
  }
}


export default async (req: Request) => {
  if (req.method !== "GET") return Response.json({ error: "Method not allowed" }, { status: 405 });
  return onRequestGet({
    request: req,
    env: { GELATO_API_KEY: Netlify.env.get("GELATO_API_KEY"), GELATO_STORE_ID: Netlify.env.get("GELATO_STORE_ID") },
  });
};
export const config = { path: "/api/gelato-products" };
