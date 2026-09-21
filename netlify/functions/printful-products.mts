const BASE = "https://api.printful.com";

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

function normalize(row: any, index: number) {
  const sync = row?.sync_product || row;
  const retail = money(sync?.retail_price || row?.retail_price);
  return {
    id: String(sync?.id || `printful-${index}`),
    sku: String(sync?.external_id || sync?.id || ""),
    supplier: "Printful",
    provider: "printful",
    name: String(sync?.name || "Printful product"),
    category: "Printful",
    supplierPriceUsd: retail,
    suggestedRetailUsd: retail,
    image: String(sync?.thumbnail_url || sync?.image || ""),
  };
}

function matchesSector(p: any, sector: string) {
  const keys = SECTOR_KEYWORDS[sector] || SECTOR_KEYWORDS.beauty;
  const text = [p.name, p.category, p.sku].join(" ").toLowerCase();
  return keys.some((k) => text.includes(k));
}

export default async (req: Request) => {
  if (req.method !== "GET") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const token = Netlify.env.get("PRINTFUL_API_TOKEN");
  const reqUrl = new URL(req.url);
  const wanted = (reqUrl.searchParams.get("q") || reqUrl.searchParams.get("sector") || "beauty").toLowerCase().trim();
  const sector = SECTOR_KEYWORDS[wanted] ? wanted : "beauty";
  const headersOut = { "access-control-allow-origin": "*", "cache-control": "public, max-age=300" };
  if (!token) return Response.json({ error: "Printful is not configured", products: [], sector, query: sector }, { status: 503, headers: headersOut });
  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    const pfStore = Netlify.env.get("PRINTFUL_STORE_ID"); if (pfStore) headers["X-PF-Store-Id"] = String(pfStore);
    const url = new URL(BASE + "/store/products");
    url.searchParams.set("limit", "20");
    url.searchParams.set("offset", "0");
    const response = await fetch(url, { headers });
    const result: any = await response.json();
    if (!response.ok) {
      return Response.json({ error: result?.error?.message || result?.result || "Printful product request failed", products: [] }, { status: 502, headers: headersOut });
    }
    const list = Array.isArray(result?.result) ? result.result : [];
    let products = list.map(normalize).filter((p: any) => p.name);
    const detailed = [];
    for (const product of products.slice(0, 20)) {
      try {
        const detailRes = await fetch(`${BASE}/store/products/${product.id}`, { headers });
        const detail: any = await detailRes.json();
        if (!detailRes.ok) { detailed.push(product); continue; }
        const variants = Array.isArray(detail?.result?.sync_variants) ? detail.result.sync_variants : [];
        const priced = variants.find((v: any) => money(v?.retail_price) > 0) || variants[0];
        const retail = money(priced?.retail_price);
        detailed.push({
          ...product,
          sku: String(priced?.sku || product.sku || ""),
          supplierPriceUsd: retail || product.supplierPriceUsd,
          suggestedRetailUsd: retail || product.suggestedRetailUsd,
          image: product.image || String(priced?.files?.find?.((f: any) => f?.type === "preview")?.preview_url || ""),
        });
      } catch (_) {
        detailed.push(product);
      }
    }
    let out = detailed.filter((p: any) => p.suggestedRetailUsd > 0);
    const filtered = out.filter((p) => matchesSector(p, sector));
    if (filtered.length >= 1) out = filtered;
    return Response.json({
      ok: true,
      supplier: "printful",
      sector,
      query: sector,
      products: out.slice(0, 30),
      markets: ["NO", "EU", "PE"],
    }, { headers: headersOut });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Printful request failed", products: [] }, { status: 502, headers: headersOut });
  }
};
export const config = { path: "/api/printful-products" };
