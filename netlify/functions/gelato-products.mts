const PRODUCT_BASE = "https://product.gelatoapis.com";
const ECOM_BASE = "https://ecommerce.gelatoapis.com";

const SECTOR_KEYWORDS: Record<string, string[]> = {
  "beauty": [
    "beauty",
    "perfume",
    "skincare",
    "cosmetic",
    "glow",
    "tote",
    "t-shirt",
    "tee",
    "mug",
    "crewneck"
  ],
  "toys": [
    "toy",
    "kid",
    "kids",
    "child",
    "poster",
    "t-shirt",
    "tee",
    "educational",
    "abc"
  ],
  "electronics": [
    "tech",
    "electronic",
    "phone",
    "case",
    "tough",
    "gadget",
    "circuit",
    "debug"
  ],
  "pet supplies": [
    "pet",
    "dog",
    "cat",
    "paw",
    "tote",
    "t-shirt",
    "tee",
    "animal"
  ],
  "home living": [
    "home",
    "living",
    "decor",
    "hygge",
    "tote",
    "poster",
    "mug",
    "kitchen",
    "pillow"
  ],
  "fitness": [
    "fitness",
    "outdoor",
    "trail",
    "sport",
    "hoodie",
    "zip",
    "t-shirt",
    "tee",
    "crewneck",
    "gym"
  ],
  "solar energy": [
    "solar",
    "energy",
    "watt",
    "green",
    "tote",
    "poster",
    "clean",
    "eco"
  ],
  "car accessories": [
    "car",
    "auto",
    "driver",
    "garage",
    "cap",
    "hat",
    "hoodie",
    "zip",
    "mobility",
    "route"
  ]
};

function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0;
}

function normalizeEcom(product: any, index: number) {
  const retail = money(
    product?.price?.basePrice ?? product?.price?.amount ?? product?.price ?? product?.suggestedRetailUsd ?? product?.retailPrice
  );
  return {
    id: String(product?.id || product?.productUid || `gelato-${index}`),
    sku: String(product?.sku || product?.productUid || product?.id || ""),
    supplier: "Gelato",
    provider: "gelato",
    name: String(product?.title || product?.name || "Gelato product"),
    category: String(product?.category || "Gelato"),
    supplierPriceUsd: retail,
    suggestedRetailUsd: retail,
    image: String(product?.previewUrl || product?.imageUrl || product?.image || product?.thumbnailUrl || ""),
  };
}

function matchesSector(p: any, sector: string) {
  const keys = SECTOR_KEYWORDS[sector] || SECTOR_KEYWORDS.beauty;
  const text = [p.name, p.category, p.sku].join(" ").toLowerCase();
  return keys.some((k) => text.includes(k));
}

async function loadStoreProducts(headers: Record<string, string>, storeId: string) {
  const response = await fetch(`${ECOM_BASE}/v1/stores/${storeId}/products`, { headers });
  const result: any = await response.json().catch(() => ({}));
  if (!response.ok) return [];
  const list = Array.isArray(result?.products) ? result.products : Array.isArray(result) ? result : [];
  return list.map(normalizeEcom).filter((p: any) => p.suggestedRetailUsd > 0);
}

export default async (req: Request) => {
  if (req.method !== "GET") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const apiKey = Netlify.env.get("GELATO_API_KEY");
  const url = new URL(req.url);
  const wanted = (url.searchParams.get("q") || url.searchParams.get("sector") || "beauty").toLowerCase().trim();
  const sector = SECTOR_KEYWORDS[wanted] ? wanted : "beauty";
  const headersOut = { "access-control-allow-origin": "*", "cache-control": "public, max-age=300" };
  if (!apiKey) return Response.json({ error: "Gelato is not configured", products: [], sector, query: sector }, { status: 503, headers: headersOut });
  const headers = { "X-API-KEY": apiKey, "content-type": "application/json" };
  try {
    let storeId = Netlify.env.get("GELATO_STORE_ID") || "";
    if (!storeId) {
      const storesRes = await fetch(`${ECOM_BASE}/v1/stores`, { headers });
      if (storesRes.ok) {
        const stores: any = await storesRes.json();
        const list = Array.isArray(stores?.stores) ? stores.stores : Array.isArray(stores) ? stores : [];
        storeId = String(list[0]?.id || list[0]?.storeId || "");
      }
    }
    if (storeId) {
      let products = await loadStoreProducts(headers, storeId);
      const filtered = products.filter((p) => matchesSector(p, sector));
      if (filtered.length >= 1) products = filtered;
      products = products.slice(0, 30);
      return Response.json({ ok: true, supplier: "gelato", sector, query: sector, products, storeId, markets: ["NO", "EU", "PE"] }, { headers: headersOut });
    }
    const catalogsRes = await fetch(`${PRODUCT_BASE}/v3/catalogs`, { headers });
    if (!catalogsRes.ok) {
      const err: any = await catalogsRes.json().catch(() => ({}));
      return Response.json({ error: err?.message || "Gelato request failed", products: [] }, { status: 502, headers: headersOut });
    }
    return Response.json({
      ok: true,
      supplier: "gelato",
      sector,
      query: sector,
      products: [],
      note: "API key valid. Add ecommerce store products in Gelato (or set GELATO_STORE_ID) for a live priced catalog.",
      markets: ["NO", "EU", "PE"],
    }, { headers: headersOut });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Gelato request failed", products: [] }, { status: 502, headers: headersOut });
  }
};
export const config = { path: "/api/gelato-products" };
