const BASE = "https://api.printify.com/v1";

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

const PRODUCT_TYPE_KEYWORDS: Record<string, string[]> = {
  "cap": [
    "cap",
    "hat",
    "beanie"
  ],
  "poster": [
    "poster",
    "print",
    "canvas",
    "wall"
  ],
  "case": [
    "case",
    "phone",
    "tough"
  ],
  "hoodie": [
    "hoodie",
    "zip hoodie",
    "zip-up"
  ],
  "tote": [
    "tote",
    "bag"
  ],
  "crewneck": [
    "crewneck",
    "crew neck",
    "sweatshirt"
  ],
  "tee": [
    "t-shirt",
    "tshirt",
    "tee",
    "shirt"
  ],
  "mug": [
    "mug",
    "cup",
    "coffee"
  ]
};

function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0;
}

function normalize(product: any, index: number) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const enabled = variants.find((v: any) => v?.is_enabled !== false) || variants[0] || {};
  const images = Array.isArray(product?.images) ? product.images : [];
  const image = images.find((img: any) => img?.is_default)?.src || images[0]?.src || "";
  const cost = money(enabled.cost);
  const retail = money(enabled.price) || (cost > 0 ? Math.round(cost * 2.2 * 100) / 100 : 0);
  const tags = Array.isArray(product?.tags) ? product.tags.map((t: any) => String(t).toLowerCase()) : [];
  return {
    id: String(product?.id || `printify-${index}`),
    sku: String(enabled.sku || product?.id || ""),
    supplier: "Printify",
    provider: "printify",
    printifyProductId: String(product?.id || ""),
    printifyVariantId: String(enabled.id || ""),
    name: String(product?.title || "Printify product"),
    category: String(tags[0] || product?.tags?.[0] || "Printify"),
    tags,
    supplierPriceUsd: cost || retail,
    suggestedRetailUsd: retail,
    image,
  };
}

function haystack(p: any) {
  return [p.name, p.category, ...(p.tags || []), p.sku].join(" ").toLowerCase();
}

function matchesSector(p: any, sector: string) {
  const keys = SECTOR_KEYWORDS[sector] || SECTOR_KEYWORDS.beauty;
  const text = haystack(p);
  return keys.some((k) => text.includes(k));
}

function matchesTypes(p: any, types: string[]) {
  if (!types.length) return true;
  const text = haystack(p);
  return types.some((t) => {
    const words = PRODUCT_TYPE_KEYWORDS[t] || [t];
    return words.some((w) => text.includes(w));
  });
}

async function loadSelected(origin: string) {
  try {
    const res = await fetch(new URL("/catalog/printify-selected.json", origin).toString(), { cache: "no-store" });
    if (!res.ok) return [];
    const data: any = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.products)) return data.products;
    return [];
  } catch (_) {
    return [];
  }
}

function curatedFromSelected(selected: any[], sector: string) {
  return selected
    .filter((p: any) => !p.sector || String(p.sector).toLowerCase() === sector || matchesSector(p, sector))
    .map((p: any, i: number) => ({
      id: String(p.id || p.printifyProductId || `selected-${i}`),
      sku: String(p.sku || ""),
      supplier: "Printify",
      provider: "printify",
      printifyProductId: String(p.printifyProductId || p.id || ""),
      printifyVariantId: String(p.printifyVariantId || ""),
      name: String(p.name || "Printify product"),
      category: String(p.category || sector),
      supplierPriceUsd: money(p.supplierPriceUsd) || money(p.suggestedRetailUsd),
      suggestedRetailUsd: money(p.suggestedRetailUsd) || money(p.supplierPriceUsd),
      image: String(p.image || ""),
    }))
    .filter((p: any) => p.suggestedRetailUsd > 0);
}

export default async (req: Request) => {
  if (req.method !== "GET") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const token = Netlify.env.get("PRINTIFY_API_TOKEN");
  const url = new URL(req.url);
  const wanted = (url.searchParams.get("q") || url.searchParams.get("sector") || "beauty").toLowerCase().trim();
  const sector = SECTOR_KEYWORDS[wanted] ? wanted : "beauty";
  const headers = { "access-control-allow-origin": "*", "cache-control": "public, max-age=300" };
  const selected = await loadSelected(url.origin);

  if (!token) {
    const curated = curatedFromSelected(selected, sector).slice(0, 30);
    return Response.json(
      { ok: true, supplier: "printify", sector, query: sector, products: curated, source: "selected-json", markets: ["NO", "EU", "PE"] },
      { status: curated.length ? 200 : 503, headers }
    );
  }

  const shopId = Netlify.env.get("PRINTIFY_SHOP_ID") || "28847802";
  try {
    const preferredIds = new Set(
      selected
        .map((p: any) => String(p.printifyProductId || p.id || "").trim())
        .filter((id: string) => id && !id.startsWith("placeholder") && !id.startsWith("printify-") && !id.startsWith("selected-"))
    );
    const preferredTypes = [
      ...new Set(
        selected
          .flatMap((p: any) => (Array.isArray(p.matchTypes) ? p.matchTypes : p.matchType ? [p.matchType] : []))
          .map((t: any) => String(t).toLowerCase())
      ),
    ];

    const apiUrl = new URL(BASE + `/shops/${shopId}/products.json`);
    apiUrl.searchParams.set("limit", "50");
    const response = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "NordicStore/1.0" },
    });
    const result: any = await response.json();
    if (!response.ok) {
      return Response.json({ error: result?.message || "Printify product request failed", products: [] }, { status: 502, headers });
    }
    const list = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
    const all = list.map(normalize).filter((p: any) => p.suggestedRetailUsd > 0);

    let products = all.filter((p) => preferredIds.has(p.printifyProductId) || preferredIds.has(p.id));
    if (products.length < 3 && preferredTypes.length) {
      const byType = all.filter((p) => matchesTypes(p, preferredTypes));
      const seen = new Set(products.map((p) => p.id));
      for (const p of byType) if (!seen.has(p.id)) { products.push(p); seen.add(p.id); }
    }
    if (products.length < 3) {
      const bySector = all.filter((p) => matchesSector(p, sector));
      const seen = new Set(products.map((p) => p.id));
      for (const p of bySector) if (!seen.has(p.id)) { products.push(p); seen.add(p.id); }
    }
    if (products.length < 3 && selected.length) {
      const curated = curatedFromSelected(selected, sector);
      const seen = new Set(products.map((p) => p.id));
      for (const p of curated) if (!seen.has(p.id)) { products.push(p); seen.add(p.id); }
    }

    products = products.slice(0, 30);
    return Response.json(
      { ok: true, supplier: "printify", sector, query: sector, products, count: products.length, markets: ["NO", "EU", "PE"] },
      { headers }
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Printify request failed", products: [] },
      { status: 502, headers }
    );
  }
};
export const config = { path: "/api/printify-products" };
