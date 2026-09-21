const BASE = "https://api.printify.com/v1";

// Per-store curated catalog — PRIMARY source for storefront (never replace with shared shop dump)
const SELECTED: any[] = [
  {
    "id": "printify-electronics-1",
    "sku": "PFY-TECH-CASE-GRID",
    "supplier": "Printify",
    "provider": "printify",
    "printifyProductId": "",
    "printifyVariantId": "",
    "name": "Tough Case \u2014 Minimal Grid",
    "category": "Accessories",
    "supplierPriceUsd": 8.8,
    "suggestedRetailUsd": 24.9,
    "image": "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80",
    "matchType": "case",
    "sector": "electronics"
  },
  {
    "id": "printify-electronics-2",
    "sku": "PFY-TECH-CASE-CIRCUIT",
    "supplier": "Printify",
    "provider": "printify",
    "printifyProductId": "",
    "printifyVariantId": "",
    "name": "Tough Case \u2014 Circuit Trace",
    "category": "Accessories",
    "supplierPriceUsd": 8.8,
    "suggestedRetailUsd": 25.9,
    "image": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
    "matchType": "case",
    "sector": "electronics"
  },
  {
    "id": "printify-electronics-3",
    "sku": "PFY-TECH-CASE-PIXEL",
    "supplier": "Printify",
    "provider": "printify",
    "printifyProductId": "",
    "printifyVariantId": "",
    "name": "Tough Case \u2014 Nordic Pixel",
    "category": "Accessories",
    "supplierPriceUsd": 8.8,
    "suggestedRetailUsd": 23.9,
    "image": "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=800&q=80",
    "matchType": "case",
    "sector": "electronics"
  },
  {
    "id": "printify-electronics-4",
    "sku": "PFY-TECH-CASE-UI",
    "supplier": "Printify",
    "provider": "printify",
    "printifyProductId": "",
    "printifyVariantId": "",
    "name": "Tough Case \u2014 Midnight UI",
    "category": "Accessories",
    "supplierPriceUsd": 8.8,
    "suggestedRetailUsd": 26.9,
    "image": "https://images.unsplash.com/photo-1556656793-08538906a9f8?auto=format&fit=crop&w=800&q=80",
    "matchType": "case",
    "sector": "electronics"
  },
  {
    "id": "printify-electronics-5",
    "sku": "PFY-TECH-TEE-DEBUG",
    "supplier": "Printify",
    "provider": "printify",
    "printifyProductId": "",
    "printifyVariantId": "",
    "name": "Debug Mode Unisex Tee",
    "category": "Tech Merch",
    "supplierPriceUsd": 9.4,
    "suggestedRetailUsd": 29.9,
    "image": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80",
    "matchType": "tee",
    "sector": "electronics"
  },
  {
    "id": "printify-electronics-6",
    "sku": "PFY-TECH-TEE-SHIP",
    "supplier": "Printify",
    "provider": "printify",
    "printifyProductId": "",
    "printifyVariantId": "",
    "name": "Ship It T-Shirt",
    "category": "Tech Merch",
    "supplierPriceUsd": 9.4,
    "suggestedRetailUsd": 28.5,
    "image": "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=800&q=80",
    "matchType": "tee",
    "sector": "electronics"
  },
  {
    "id": "printify-electronics-7",
    "sku": "PFY-TECH-TEE-AI",
    "supplier": "Printify",
    "provider": "printify",
    "printifyProductId": "",
    "printifyVariantId": "",
    "name": "AI Ready Soft Tee",
    "category": "Tech Merch",
    "supplierPriceUsd": 9.4,
    "suggestedRetailUsd": 27.9,
    "image": "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=800&q=80",
    "matchType": "tee",
    "sector": "electronics"
  },
  {
    "id": "printify-electronics-8",
    "sku": "PFY-TECH-MUG-ACCENT",
    "supplier": "Printify",
    "provider": "printify",
    "printifyProductId": "",
    "printifyVariantId": "",
    "name": "Accent Mug \u2014 Nordic Tech",
    "category": "Tech Merch",
    "supplierPriceUsd": 6.5,
    "suggestedRetailUsd": 19.9,
    "image": "https://images.unsplash.com/photo-1514228742587-6b1558fcc036?auto=format&fit=crop&w=800&q=80",
    "matchType": "mug",
    "sector": "electronics"
  },
  {
    "id": "printify-electronics-9",
    "sku": "PFY-TECH-MUG-COMMIT",
    "supplier": "Printify",
    "provider": "printify",
    "printifyProductId": "",
    "printifyVariantId": "",
    "name": "Commit Coffee Mug",
    "category": "Tech Merch",
    "supplierPriceUsd": 6.5,
    "suggestedRetailUsd": 18.9,
    "image": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80",
    "matchType": "mug",
    "sector": "electronics"
  },
  {
    "id": "printify-electronics-10",
    "sku": "PFY-TECH-MUG-404",
    "supplier": "Printify",
    "provider": "printify",
    "printifyProductId": "",
    "printifyVariantId": "",
    "name": "404 Not Found Mug",
    "category": "Tech Merch",
    "supplierPriceUsd": 6.5,
    "suggestedRetailUsd": 17.9,
    "image": "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=800&q=80",
    "matchType": "mug",
    "sector": "electronics"
  },
  {
    "id": "printify-electronics-11",
    "sku": "PFY-TECH-TEE-LATENCY",
    "supplier": "Printify",
    "provider": "printify",
    "printifyProductId": "",
    "printifyVariantId": "",
    "name": "Latency Zero Tee",
    "category": "Tech Merch",
    "supplierPriceUsd": 9.4,
    "suggestedRetailUsd": 26.9,
    "image": "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=800&q=80",
    "matchType": "tee",
    "sector": "electronics"
  },
  {
    "id": "printify-electronics-12",
    "sku": "PFY-TECH-CASE-FROST",
    "supplier": "Printify",
    "provider": "printify",
    "printifyProductId": "",
    "printifyVariantId": "",
    "name": "Tough Case \u2014 Frost Glass",
    "category": "Accessories",
    "supplierPriceUsd": 8.8,
    "suggestedRetailUsd": 27.5,
    "image": "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&w=800&q=80",
    "matchType": "case",
    "sector": "electronics"
  },
  {
    "id": "printify-electronics-13",
    "sku": "PFY-TECH-CASE-AURORA",
    "supplier": "Printify",
    "provider": "printify",
    "printifyProductId": "",
    "printifyVariantId": "",
    "name": "Tough Case \u2014 Aurora Glass",
    "category": "Accessories",
    "supplierPriceUsd": 8.8,
    "suggestedRetailUsd": 28.9,
    "image": "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&w=800&q=80",
    "matchType": "case",
    "sector": "electronics"
  },
  {
    "id": "printify-electronics-14",
    "sku": "PFY-TECH-TEE-COMPILE",
    "supplier": "Printify",
    "provider": "printify",
    "printifyProductId": "",
    "printifyVariantId": "",
    "name": "Compile & Ship Tee",
    "category": "Tech Merch",
    "supplierPriceUsd": 9.4,
    "suggestedRetailUsd": 27.5,
    "image": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80",
    "matchType": "tee",
    "sector": "electronics"
  },
  {
    "id": "printify-electronics-15",
    "sku": "PFY-TECH-MUG-STACK",
    "supplier": "Printify",
    "provider": "printify",
    "printifyProductId": "",
    "printifyVariantId": "",
    "name": "Stack Overflow Mug",
    "category": "Tech Merch",
    "supplierPriceUsd": 6.5,
    "suggestedRetailUsd": 18.5,
    "image": "https://images.unsplash.com/photo-1514228742587-6b1558fcc036?auto=format&fit=crop&w=800&q=80",
    "matchType": "mug",
    "sector": "electronics"
  }
];

const SECTOR_ALIASES: Record<string, string> = {
  "beauty": "beauty",
  "perfume": "beauty",
  "perfumes": "beauty",
  "skincare": "beauty",
  "toys": "toys",
  "kids": "toys",
  "kid": "toys",
  "children": "toys",
  "electronics": "electronics",
  "tech": "electronics",
  "technology": "electronics",
  "pet supplies": "pet supplies",
  "pets": "pet supplies",
  "pet": "pet supplies",
  "home living": "home living",
  "home": "home living",
  "living": "home living",
  "fitness": "fitness",
  "outdoor": "fitness",
  "sports": "fitness",
  "solar energy": "solar energy",
  "energy": "solar energy",
  "solar": "solar energy",
  "car accessories": "car accessories",
  "car": "car accessories",
  "auto": "car accessories",
  "automotive": "car accessories"
};

function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0;
}

function resolveSector(raw: string) {
  const key = String(raw || "").toLowerCase().trim();
  if (!key) return SELECTED[0]?.sector || "beauty";
  if (SECTOR_ALIASES[key]) return SECTOR_ALIASES[key];
  for (const [alias, sector] of Object.entries(SECTOR_ALIASES)) {
    if (key.includes(alias) || alias.includes(key)) return sector;
  }
  return key;
}

function curated(sector: string) {
  return SELECTED
    .filter((p) => !p.sector || String(p.sector).toLowerCase() === sector)
    .map((p, i) => ({
      id: String(p.id || `printify-selected-${i}`),
      sku: String(p.sku || ""),
      supplier: "Printify",
      provider: "printify",
      printifyProductId: String(p.printifyProductId || ""),
      printifyVariantId: String(p.printifyVariantId || ""),
      name: String(p.name || "Printify product"),
      category: String(p.category || sector),
      supplierPriceUsd: money(p.supplierPriceUsd) || money(p.suggestedRetailUsd),
      suggestedRetailUsd: money(p.suggestedRetailUsd) || money(p.supplierPriceUsd),
      image: String(p.image || ""),
      matchType: String(p.matchType || ""),
      sector: String(p.sector || sector),
    }))
    .filter((p) => p.suggestedRetailUsd > 0 && p.name);
}

function haystack(p: any) {
  return [p.name, p.title, p.category, ...(Array.isArray(p.tags) ? p.tags : []), p.sku].join(" ").toLowerCase();
}

async function enrichFromLive(token: string, shopId: string, curatedProducts: any[]) {
  try {
    const apiUrl = new URL(BASE + `/shops/${shopId}/products.json`);
    apiUrl.searchParams.set("limit", "50");
    const response = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "NordicStore/1.0" },
    });
    if (!response.ok) return curatedProducts;
    const result: any = await response.json();
    const list = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
    if (!list.length) return curatedProducts;

    const typeWords: Record<string, string[]> = {
      tote: ["tote", "bag"],
      tee: ["t-shirt", "tshirt", "tee", "shirt"],
      mug: ["mug", "cup", "coffee"],
      crewneck: ["crewneck", "crew neck", "sweatshirt"],
      hoodie: ["hoodie", "zip"],
      poster: ["poster", "print"],
      case: ["case", "phone", "tough"],
      cap: ["cap", "hat"],
    };

    return curatedProducts.map((item) => {
      const words = typeWords[String(item.matchType || "").toLowerCase()] || [];
      const match = list.find((live: any) => {
        const id = String(live?.id || "");
        if (item.printifyProductId && id && id === item.printifyProductId) return true;
        if (!words.length) return false;
        const text = haystack({ name: live?.title, tags: live?.tags, sku: "" });
        return words.some((w) => text.includes(w));
      });
      if (!match) return item;
      const variants = Array.isArray(match.variants) ? match.variants : [];
      const enabled = variants.find((v: any) => v?.is_enabled !== false) || variants[0] || {};
      const images = Array.isArray(match.images) ? match.images : [];
      const image = images.find((img: any) => img?.is_default)?.src || images[0]?.src || item.image;
      const cost = money(enabled.cost);
      const retail = money(enabled.price) || (cost > 0 ? Math.round(cost * 2.2 * 100) / 100 : 0);
      return {
        ...item,
        printifyProductId: String(match.id || item.printifyProductId || ""),
        printifyVariantId: String(enabled.id || item.printifyVariantId || ""),
        sku: String(enabled.sku || item.sku || ""),
        supplierPriceUsd: cost || item.supplierPriceUsd,
        suggestedRetailUsd: retail || item.suggestedRetailUsd,
        image: image || item.image,
        enriched: true,
      };
    });
  } catch (_) {
    return curatedProducts;
  }
}

export async function onRequestGet(context: any) {
  const url = new URL(context.request.url);
  const wanted = url.searchParams.get("q") || url.searchParams.get("sector") || "";
  const defaultSector = String(SELECTED[0]?.sector || "beauty");
  const sector = resolveSector(wanted || defaultSector);
  const headers = {
    "access-control-allow-origin": "*",
    "cache-control": "public, max-age=60",
  };

  // PRIMARY: curated per-store list. Live Printify only enriches — never replaces.
  let products = curated(sector).slice(0, 30);
  const token = context.env.PRINTIFY_API_TOKEN;
  const shopId = context.env.PRINTIFY_SHOP_ID || "28847802";
  if (token && products.length) {
    products = await enrichFromLive(String(token), String(shopId), products);
  }

  return Response.json(
    {
      ok: true,
      supplier: "printify",
      sector,
      query: sector,
      products,
      count: products.length,
      source: "printify-selected-primary",
      markets: ["NO", "EU", "PE"],
    },
    { status: products.length ? 200 : 503, headers }
  );
}
