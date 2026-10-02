import { withQuotes } from "../_shared/quote";
import { STORE } from "../_shared/store";

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

/**
 * Preferred Gelato catalog UIDs per sector (POD merch). Order matters —
 * first catalogs dominate the ~50 product mix so beauty ≠ auto ≠ kids.
 */
const SECTOR_CATALOGS: Record<string, string[]> = {
  beauty: ["tote-bags", "mugs", "canvas", "apparel"],
  toys: ["posters", "cards", "canvas", "apparel"],
  electronics: ["phone-cases", "apparel", "mugs", "posters"],
  "pet supplies": ["tote-bags", "apparel", "mugs", "posters", "canvas"],
  "home living": ["posters", "canvas", "pillows", "mugs", "tote-bags", "calendars", "framed-posters"],
  fitness: ["apparel", "tote-bags", "posters", "mugs"],
  "solar energy": ["posters", "canvas", "tote-bags", "apparel", "mugs"],
  "car accessories": ["apparel", "tote-bags", "mugs", "framed-posters"],
};

/** Sector-specific search offset so overlapping catalogs return different slices. */
const SECTOR_OFFSET: Record<string, number> = {
  beauty: 0,
  toys: 35,
  electronics: 0,
  "pet supplies": 70,
  "home living": 15,
  fitness: 110,
  "solar energy": 55,
  "car accessories": 180,
};

/** Prefer / avoid tokens inside productUid + attributes for sector fit. */
const SECTOR_HINTS: Record<string, { prefer: string[]; avoid: string[] }> = {
  beauty: {
    prefer: ["tote", "mug", "poster", "canvas", "pouch", "bag", "scarf", "tee", "t-shirt", "hoodie", "sweat"],
    avoid: ["baby", "beanie", "kids", "phone", "case", "infant", "toddler"],
  },
  toys: {
    prefer: ["poster", "canvas", "card", "kids", "baby", "hoodie", "tee", "mug"],
    avoid: ["phone", "case", "adult"],
  },
  electronics: {
    prefer: ["phone", "case", "mug", "poster", "tee"],
    avoid: ["baby", "beanie", "infant", "toddler"],
  },
  "pet supplies": {
    prefer: ["tote", "mug", "poster", "hoodie", "tee", "canvas", "bandana"],
    avoid: ["phone", "case", "infant"],
  },
  "home living": {
    prefer: ["poster", "canvas", "pillow", "mug", "tote", "calendar", "framed"],
    avoid: ["beanie", "phone", "baby", "infant"],
  },
  fitness: {
    prefer: ["tee", "t-shirt", "hoodie", "tank", "sport", "tote", "mug", "poster", "sweat"],
    avoid: ["baby", "beanie", "infant", "phone", "toddler"],
  },
  "solar energy": {
    prefer: ["poster", "canvas", "tote", "tee", "mug", "hoodie"],
    avoid: ["baby", "beanie", "phone", "infant", "toddler"],
  },
  "car accessories": {
    prefer: ["cap", "hat", "hoodie", "tee", "mug", "tote", "poster", "trucker", "snapback"],
    avoid: ["baby", "beanie", "kids", "infant", "toddler", "organic-baby"],
  },
};

const FALLBACK_CATALOGS = [
  "posters", "apparel", "mugs", "canvas", "cards", "tote-bags",
  "phone-cases", "pillows", "calendars", "framed-posters",
];

/** UID attribute key codes Gelato embeds — never dump these into titles. */
const UID_ATTR_KEYS = new Set([
  "gca", "gsc", "gcu", "gqa", "gsi", "gco", "gpr", "gfa", "gty", "gst", "gmo", "gpl",
]);
const UID_NOISE = new Set([
  "product", "products", "apparel", "catalog", "item", "uid", "gelato",
]);

type CatalogMeta = {
  title: string;
  valueTitles: Record<string, string>;
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
  return SECTOR_CATALOGS[key] ? key : STORE.sector;
}

function humanizeToken(raw: string) {
  return String(raw || "")
    .replace(/[_/]+/g, "-")
    .split("-")
    .filter(Boolean)
    .map((w) => {
      if (/^\d/.test(w)) return w.toUpperCase();
      if (w.length <= 2) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

function catalogLabel(catalogUid: string, meta?: CatalogMeta | null) {
  if (meta?.title) return String(meta.title).trim();
  return humanizeToken(String(catalogUid || "Gelato").replace(/-/g, " "));
}

/** Prefer real Gelato display fields; never dump raw uid path strings. */
function fieldTitle(product: any): string {
  const candidates = [
    product?.title,
    product?.displayName,
    product?.display_name,
    product?.productName,
    product?.product_name,
    product?.name,
    product?.productTitle,
    product?.label,
  ];
  for (const c of candidates) {
    const s = String(c || "").trim();
    if (!s) continue;
    // Reject raw uid-looking dumps / code paths
    if (/^[a-z0-9_-]+(?:[·•|: ].*)?$/i.test(s) && (s.includes("_product_") || /_gc[a-z]_/.test(s))) continue;
    if (s.includes(" · ") && /^(apparel|tote|mug|poster|canvas|phone)/i.test(s) && /\bgca\b|\bgsc\b|\bproduct\b/i.test(s)) continue;
    if (s.length >= 3) return s;
  }
  return "";
}

function titleFromAttributes(product: any, meta?: CatalogMeta | null): string {
  const attrs = product?.attributes;
  if (!attrs || typeof attrs !== "object") return "";
  const preferKeys = [
    "GarmentStyle", "ProductType", "ProductStyle", "Style", "Type", "BagType",
    "Category", "Model", "PhoneModel", "PaperFormat", "Format", "ProductName",
  ];
  const colorKeys = ["Color", "Colour", "GarmentColor", "ProductColor", "BagColor"];
  const brandKeys = ["Brand", "Manufacturer", "Mpn", "MPN"];
  const skipKey = /status|protection|coating|spot|variable|orientation|print|colortype|color_type|pagetype|availability|productstatus/i;
  const parts: string[] = [];
  const used = new Set<string>();

  const resolve = (val: string) => {
    const v = String(val || "").trim();
    if (!v || v === "none" || v === "no") return "";
    // Skip print-process codes like 4-0 / 4-4 and status labels
    if (/^\d+-\d+$/.test(v)) return "";
    if (/^(published|activated|active|inactive|draft)$/i.test(v)) return "";
    const mapped = meta?.valueTitles?.[v];
    if (mapped) {
      if (/^(published|activated|active|inactive|draft|none)$/i.test(mapped)) return "";
      return mapped;
    }
    return humanizeToken(v);
  };

  for (const key of preferKeys) {
    if (attrs[key] != null) {
      const t = resolve(String(attrs[key]));
      if (t && !used.has(t.toLowerCase())) {
        parts.push(t);
        used.add(t.toLowerCase());
      }
    }
  }
  for (const key of colorKeys) {
    if (attrs[key] != null) {
      const t = resolve(String(attrs[key]));
      if (t && !used.has(t.toLowerCase())) {
        parts.push(t);
        used.add(t.toLowerCase());
      }
    }
  }
  for (const key of brandKeys) {
    if (attrs[key] != null) {
      const t = resolve(String(attrs[key]));
      if (t && !used.has(t.toLowerCase())) {
        parts.push(t);
        used.add(t.toLowerCase());
      }
    }
  }
  if (parts.length < 2) {
    for (const [k, v] of Object.entries(attrs)) {
      if (skipKey.test(k)) continue;
      const t = resolve(String(v));
      if (t && !used.has(t.toLowerCase())) {
        parts.push(t);
        used.add(t.toLowerCase());
      }
      if (parts.length >= 3) break;
    }
  }
  return parts.slice(0, 4).join(" · ");
}

/**
 * Parse Gelato productUid into a shop-safe title.
 * Example: apparel_product_gca_hat_gsc_beanie_gcu_baby_gqa_organic_gsi_onesize_gco_black_gpr_4-0-emb_babybugz_bz062
 * → "Organic Baby Beanie · Black | Babybugz BZ062"
 */
function titleFromUid(productUid: string, catalogUid: string, meta?: CatalogMeta | null): string {
  const uid = String(productUid || "");
  if (!uid) return `Gelato ${catalogLabel(catalogUid, meta)}`;

  const bits = uid.split("_").filter(Boolean);
  const mapped: Record<string, string> = {};
  const brandBits: string[] = [];
  let i = 0;
  // skip leading catalog/product noise
  while (i < bits.length && (UID_NOISE.has(bits[i].toLowerCase()) || bits[i].toLowerCase() === String(catalogUid || "").toLowerCase())) {
    i++;
  }
  while (i < bits.length) {
    const tok = bits[i];
    const low = tok.toLowerCase();
    if (UID_ATTR_KEYS.has(low) && i + 1 < bits.length) {
      mapped[low] = bits[i + 1];
      i += 2;
      continue;
    }
    // brand / sku tail (alphanumeric codes after known attrs)
    if (!UID_ATTR_KEYS.has(low) && !UID_NOISE.has(low)) {
      brandBits.push(tok);
    }
    i++;
  }

  const style = mapped.gsc || mapped.gca || mapped.gty || "";
  const cut = mapped.gcu || "";
  const quality = mapped.gqa || "";
  const color = mapped.gco || "";
  const size = mapped.gsi || "";

  const head: string[] = [];
  if (quality && !/^(standard|regular|default)$/i.test(quality)) head.push(humanizeToken(quality));
  if (cut && !/^(unisex|adult|regular|standard)$/i.test(cut)) head.push(humanizeToken(cut));
  if (style) head.push(humanizeToken(style));
  else if (mapped.gca) head.push(humanizeToken(mapped.gca));

  let title = head.join(" ").trim();
  if (!title) {
    // posters / mugs / cases often lack g* codes — use meaningful mid tokens
    const mid = bits
      .filter((b) => !UID_NOISE.has(b.toLowerCase()) && !UID_ATTR_KEYS.has(b.toLowerCase()) && !/^\d/.test(b))
      .slice(0, 4)
      .map(humanizeToken);
    title = mid.join(" · ") || catalogLabel(catalogUid, meta);
  }

  const extras: string[] = [];
  if (color) extras.push(humanizeToken(color));
  if (size && !/^onesize$/i.test(size)) extras.push(humanizeToken(size));

  // Brand: last 1–2 non-code tokens if they look like a maker name
  const brand = brandBits
    .filter((b) => !/^\d/.test(b) && b.length > 1)
    .slice(-2)
    .map(humanizeToken)
    .join(" ");

  let out = title;
  if (extras.length) out = `${out} · ${extras.join(" · ")}`;
  if (brand && brand.toLowerCase() !== title.toLowerCase()) out = `${out} | ${brand}`;

  // Prefix catalog when title is too generic
  const cat = catalogLabel(catalogUid, meta);
  if (out.length < 8 && cat) out = `${cat} ${out}`.trim();
  return out.replace(/\s+/g, " ").trim();
}

function prettyTitle(productUid: string, catalogUid: string, product: any, meta?: CatalogMeta | null) {
  const fromField = fieldTitle(product);
  if (fromField) return fromField;
  const fromAttrs = titleFromAttributes(product, meta);
  const cat = catalogLabel(catalogUid, meta);
  if (fromAttrs) {
    const lower = fromAttrs.toLowerCase();
    const catLower = cat.toLowerCase();
    // If attrs already describe the product (tote bag, iphone, poster size…), skip catalog prefix
    if (lower.includes(catLower) || /tote|mug|poster|canvas|case|hoodie|tee|beanie|cap|pillow/i.test(fromAttrs)) {
      return fromAttrs;
    }
    // Singularize catalog label for cleaner "Apparel Butter" → keep short cat as type hint only when needed
    const shortCat = cat.replace(/s$/i, "");
    if (lower.includes(shortCat.toLowerCase())) return fromAttrs;
    return `${shortCat} · ${fromAttrs}`.trim();
  }
  return titleFromUid(productUid, catalogUid, meta);
}

/** Collapse color/size variants so catalogs get product diversity, not 50 beanies. */
function familyKey(productUid: string) {
  return String(productUid || "")
    .replace(/_gco_[^_]+/g, "")
    .replace(/_gsi_[^_]+/g, "")
    .replace(/_gpr_[^_]+/g, "")
    .toLowerCase();
}

function haystack(product: any, catalogUid: string) {
  const attrs = product?.attributes && typeof product.attributes === "object"
    ? Object.values(product.attributes).join(" ")
    : "";
  return `${catalogUid} ${product?.productUid || product?.id || ""} ${attrs} ${product?.title || ""} ${product?.name || ""}`.toLowerCase();
}

function sectorScore(product: any, catalogUid: string, sector: string) {
  const hints = SECTOR_HINTS[sector] || SECTOR_HINTS.beauty;
  const text = haystack(product, catalogUid);
  let score = 0;
  for (const p of hints.prefer) if (text.includes(p)) score += 3;
  for (const a of hints.avoid) if (text.includes(a)) score -= 5;
  // Prefer products from this sector's primary catalogs
  const preferred = SECTOR_CATALOGS[sector] || [];
  const idx = preferred.indexOf(catalogUid);
  if (idx >= 0) score += Math.max(0, 8 - idx);
  return score;
}

function normalizeCatalogProduct(
  product: any,
  index: number,
  sector: string,
  catalogUid: string,
  meta?: CatalogMeta | null,
) {
  const uid = String(product?.productUid || product?.id || `gelato-${index}`);
  // No estimated costs any more: the real cost comes from the Gelato price API (see gelatoCostUsd); until then the
  // listed price, if Gelato gives one, is the cost basis (owner rule 2026-10-02).
  const listed = money(product?.price?.basePrice ?? product?.price?.amount ?? product?.price ?? product?.cost ?? product?.supplierPrice);
  const retail = listed;
  const cost = listed;
  return {
    id: uid,
    sku: uid.slice(0, 48),
    supplier: "Gelato",
    provider: "gelato",
    gelatoProductUid: uid,
    name: prettyTitle(uid, catalogUid, product, meta),
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
  const uid = String(product?.productUid || product?.id || "");
  const name =
    fieldTitle(product) ||
    titleFromAttributes(product) ||
    (uid ? titleFromUid(uid, String(product?.category || "Gelato")) : "") ||
    "Gelato product";
  return {
    id: String(product?.id || product?.productUid || `gelato-ecom-${index}`),
    sku: String(product?.sku || product?.productUid || product?.id || ""),
    supplier: "Gelato",
    provider: "gelato",
    gelatoProductUid: uid,
    name,
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

async function loadCatalogMeta(headers: Record<string, string>, catalogUid: string): Promise<CatalogMeta | null> {
  try {
    const response = await fetch(`${PRODUCT_BASE}/v3/catalogs/${encodeURIComponent(catalogUid)}`, { headers });
    if (!response.ok) return null;
    const result: any = await response.json().catch(() => ({}));
    const valueTitles: Record<string, string> = {};
    const attrs = Array.isArray(result?.productAttributes) ? result.productAttributes : [];
    for (const attr of attrs) {
      const values = Array.isArray(attr?.values) ? attr.values : [];
      for (const v of values) {
        const id = String(v?.productAttributeValueUid || "");
        const title = String(v?.title || "").trim();
        if (id && title) valueTitles[id] = title;
      }
    }
    return {
      title: String(result?.title || humanizeToken(catalogUid)),
      valueTitles,
    };
  } catch (_) {
    return null;
  }
}

async function searchCatalog(
  headers: Record<string, string>,
  catalogUid: string,
  limit: number,
  offset: number,
) {
  const response = await fetch(`${PRODUCT_BASE}/v3/catalogs/${encodeURIComponent(catalogUid)}/products:search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ offset: Math.max(0, offset), limit: Math.min(100, Math.max(1, limit)) }),
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
  const scored = list
    .map((p: any, i: number) => {
      const item = normalizeEcom(p, i, sector);
      const score = sectorScore(p, String(p?.category || ""), sector);
      return { item, score };
    })
    .filter((x: any) => x.item.name && x.item.suggestedRetailUsd > 0)
    .sort((a: any, b: any) => b.score - a.score);
  // If store is tiny / unfiltered, only keep positive-scoring items when we have enough
  const positive = scored.filter((x: any) => x.score > 0).map((x: any) => x.item);
  if (positive.length >= 8) return positive.slice(0, 50);
  return scored.map((x: any) => x.item).slice(0, 50);
}

async function loadCatalogProducts(headers: Record<string, string>, sector: string) {
  const available = await listCatalogUids(headers);
  const preferred = SECTOR_CATALOGS[sector] || SECTOR_CATALOGS.beauty;
  const primary = preferred.filter((c) => !available.length || available.includes(c));
  const fallback = FALLBACK_CATALOGS.filter((c) => !preferred.includes(c) && (!available.length || available.includes(c)));
  // Prefer sector catalogs only; unlock fallbacks only if primary yield is thin.
  let uniqueCatalogs = [...new Set(primary)];
  const baseOffset = SECTOR_OFFSET[sector] || 0;
  const metaCache = new Map<string, CatalogMeta | null>();
  const seenId = new Set<string>();
  const seenFamily = new Set<string>();
  const candidates: { item: any; score: number; catalogUid: string }[] = [];

  async function pullFromCatalogs(catalogs: string[]) {
    for (let ci = 0; ci < catalogs.length; ci++) {
      const catalogUid = catalogs[ci];
      if (candidates.length >= 120) break;
      if (!metaCache.has(catalogUid)) {
        metaCache.set(catalogUid, await loadCatalogMeta(headers, catalogUid));
      }
      const meta = metaCache.get(catalogUid) || null;
      const pull = ci < 2 ? 45 : ci < 4 ? 30 : 20;
      const offset = baseOffset + ci * 17;
      const products = await searchCatalog(headers, catalogUid, pull, offset);
      for (const product of products) {
        const uid = String(product?.productUid || product?.id || "");
        if (!uid || seenId.has(uid)) continue;
        const fam = familyKey(uid);
        if (seenFamily.has(fam)) continue;
        const score = sectorScore(product, catalogUid, sector);
        // Hard-skip strongly mismatched products for this sector
        if (score < 0) continue;
        seenId.add(uid);
        seenFamily.add(fam);
        const item = normalizeCatalogProduct(product, candidates.length, sector, catalogUid, meta);
        candidates.push({ item, score, catalogUid });
      }
    }
  }

  await pullFromCatalogs(uniqueCatalogs);
  if (candidates.length < 40) {
    uniqueCatalogs = [...new Set([...uniqueCatalogs, ...fallback])];
    await pullFromCatalogs(fallback);
  }

  // Rank by sector fit, then take top 50 with family + display-name diversity
  candidates.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
  const out: any[] = [];
  const outFamilies = new Set<string>();
  const outNames = new Set<string>();
  for (const c of candidates) {
    const fam = familyKey(c.item.id);
    const nameKey = String(c.item.name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (outFamilies.has(fam) || (nameKey && outNames.has(nameKey))) continue;
    if (c.score < -2 && out.length >= 20) continue;
    outFamilies.add(fam);
    if (nameKey) outNames.add(nameKey);
    out.push(c.item);
    if (out.length >= 50) break;
  }

  // Backfill if sector filters were too aggressive (prefer still-unique names first)
  if (out.length < 50) {
    for (const preferUnique of [true, false]) {
      for (const c of candidates) {
        if (out.some((p) => p.id === c.item.id)) continue;
        const nameKey = String(c.item.name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        if (preferUnique && nameKey && outNames.has(nameKey)) continue;
        if (nameKey) outNames.add(nameKey);
        out.push(c.item);
        if (out.length >= 50) break;
      }
      if (out.length >= 50) break;
    }
  }
  return out.slice(0, 50);
}

function gelatoIds(product: any) {
  return { gelato_product_uid: product?.gelatoProductUid };
}

/**
 * Real Gelato data (2026-10-02): images come from the Gelato store products (templates published to the
 * e-commerce store: previewUrl / productImages), the cost from the Gelato price API
 * (GET product.gelatoapis.com/v3/products/{productUid}/prices?country=NO&currency=USD, quantity 1).
 * Only products with BOTH an image and a real cost are returned; `diagnostics` (counts and Gelato HTTP
 * statuses, no costs) shows what the Gelato API actually returned. Results are cached for 30 minutes.
 */
const GELATO_FRESH_MS = 30 * 60 * 1000;
const GELATO_KEEP_SECONDS = 12 * 3600;
const GELATO_TIMEOUT_MS = 8000;
const PRICE_CONCURRENCY = 6;
const MAX_PRICE_LOOKUPS = 60;
const USD_PER_EUR = 11.7 / 10.8;
type Diagnostics = Record<string, any>;
const gelatoMemory = new Map<string, { at: number; payload: any }>();
const gelatoInflight = new Map<string, Promise<any>>();

function bump(diag: Diagnostics, key: string, status: number | string) {
  diag[key] = diag[key] || {};
  diag[key][String(status)] = (diag[key][String(status)] || 0) + 1;
}

async function gelatoJson(url: string, headers: Record<string, string>, diag: Diagnostics, key: string, init: RequestInit = {}) {
  try {
    const response = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(GELATO_TIMEOUT_MS) });
    bump(diag, key, response.status);
    if (!response.ok) return null;
    return await response.json().catch(() => null);
  } catch (error) {
    bump(diag, key, error instanceof Error && error.name === "TimeoutError" ? "timeout" : "error");
    return null;
  }
}

/** Gelato cost in USD for one unit of productUid shipped to Norway, 0 if Gelato returns none. */
async function gelatoCostUsd(headers: Record<string, string>, productUid: string, diag: Diagnostics): Promise<number> {
  const url = `${PRODUCT_BASE}/v3/products/${encodeURIComponent(productUid)}/prices?country=NO&currency=USD`;
  const result: any = await gelatoJson(url, headers, diag, "priceStatus");
  const rows: any[] = Array.isArray(result) ? result : Array.isArray(result?.prices) ? result.prices : [];
  if (!diag.priceSample && rows[0]) diag.priceSample = Object.keys(rows[0]).join(",");
  const unit = rows.filter((row) => row && (row.quantity == null || Number(row.quantity) === 1));
  const amounts = unit
    .map((row) => {
      const price = Number(row.price);
      if (!Number.isFinite(price) || price <= 0) return 0;
      const currency = String(row.currency || "USD").toUpperCase();
      if (currency === "USD") return price;
      if (currency === "EUR") return price * USD_PER_EUR;
      bump(diag, "priceCurrency", currency);
      return 0;
    })
    .filter((n) => n > 0);
  return amounts.length ? Math.round(Math.min(...amounts) * 100) / 100 : 0;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index]);
    }
  }));
  return out;
}

function storeImage(product: any): string {
  const images = Array.isArray(product?.productImages) ? product.productImages : [];
  const first = images.find((img: any) => img?.fileUrl || img?.url || img?.previewUrl);
  return String(product?.previewUrl || first?.fileUrl || first?.url || first?.previewUrl || product?.imageUrl || "");
}

/** Published Gelato store products (from templates) with their first variant's productUid, image and real cost. */
async function loadGelatoStore(headers: Record<string, string>, storeId: string, sector: string, diag: Diagnostics) {
  const listed: any[] = [];
  for (let offset = 0; offset < 300; offset += 100) {
    const url = `${ECOM_BASE}/v1/stores/${encodeURIComponent(storeId)}/products?limit=100&offset=${offset}`;
    const result: any = await gelatoJson(url, headers, diag, "storeListStatus");
    const page = Array.isArray(result?.products) ? result.products : Array.isArray(result) ? result : [];
    listed.push(...page);
    if (page.length < 100) break;
  }
  diag.storeProducts = listed.length;
  const detailed = await mapLimit(listed.slice(0, MAX_PRICE_LOOKUPS), PRICE_CONCURRENCY, async (product: any) => {
    let full = product;
    let variants = Array.isArray(product?.variants) ? product.variants : [];
    if (!variants.length || !storeImage(product)) {
      const detail: any = await gelatoJson(`${ECOM_BASE}/v1/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(String(product?.id || ""))}`, headers, diag, "storeDetailStatus");
      if (detail) { full = { ...product, ...detail }; variants = Array.isArray(detail?.variants) ? detail.variants : variants; }
    }
    const variant = variants.find((v: any) => v?.productUid) || {};
    const productUid = String(variant.productUid || full?.productUid || "");
    const image = storeImage(full);
    const listPrice = money(variant?.price ?? full?.price?.amount ?? full?.price);
    const cost = productUid ? await gelatoCostUsd(headers, productUid, diag) : 0;
    if (productUid) diag.storeWithProductUid = (diag.storeWithProductUid || 0) + 1;
    if (image) diag.storeWithImage = (diag.storeWithImage || 0) + 1;
    if (cost) diag.storeWithCost = (diag.storeWithCost || 0) + 1;
    return {
      id: String(full?.id || productUid),
      sku: String(variant?.externalId || variant?.id || productUid).slice(0, 64),
      supplier: "Gelato",
      provider: "gelato",
      gelatoProductUid: productUid,
      name: String(full?.title || full?.name || variant?.title || "Gelato product").slice(0, 160),
      category: String(full?.category || full?.productType || sector),
      brand: "Gelato",
      description: String(full?.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600),
      // Real cost from the price API; the store's listed price only if Gelato returns no cost (owner rule).
      supplierPriceUsd: cost || listPrice,
      costSource: cost ? "gelato-price-api" : listPrice ? "gelato-list-price" : "",
      image,
      sector,
      compliance: "EU/Nordic POD merch",
    };
  });
  return detailed.filter((p) => p.image && p.gelatoProductUid && p.supplierPriceUsd > 0);
}

async function buildGelato(env: any, sector: string) {
  const diag: Diagnostics = { at: new Date().toISOString() };
  const headers = { "X-API-KEY": String(env.GELATO_API_KEY), "content-type": "application/json", "User-Agent": "NordicStore/1.0" };
  let storeId = env.GELATO_STORE_ID ? String(env.GELATO_STORE_ID) : "";
  diag.storeIdFromEnv = Boolean(storeId);
  if (!storeId) {
    const stores: any = await gelatoJson(`${ECOM_BASE}/v1/stores`, headers, diag, "storesStatus");
    const list = Array.isArray(stores?.stores) ? stores.stores : Array.isArray(stores) ? stores : [];
    diag.stores = list.length;
    if (stores && !Array.isArray(stores)) diag.storesResponseKeys = Object.keys(stores).join(",");
    storeId = String(list[0]?.id || list[0]?.storeId || "");
  }
  let products: any[] = [];
  if (storeId) products = await loadGelatoStore(headers, storeId, sector, diag);
  // Blank catalog products: Gelato's catalog search returns no images, so they are shown only if one has an image.
  if (!products.length) {
    const catalog = await loadCatalogProducts(headers, sector);
    diag.catalogProducts = catalog.length;
    const withImage = catalog.filter((p: any) => p.image);
    diag.catalogWithImage = withImage.length;
    // What Gelato returns for a blank catalog product (field names only) and whether its price API answers.
    const raw = await searchCatalog(headers, String(catalog[0]?.catalogUid || "mugs"), 1, 0).catch(() => []);
    if (raw[0]) diag.catalogProductFields = Object.keys(raw[0]).join(",");
    if (catalog[0]?.gelatoProductUid) diag.catalogPriceProbe = (await gelatoCostUsd(headers, catalog[0].gelatoProductUid, diag)) > 0 ? "cost returned" : "no cost";
    const costs = await mapLimit(withImage.slice(0, MAX_PRICE_LOOKUPS), PRICE_CONCURRENCY, (p: any) => gelatoCostUsd(headers, p.gelatoProductUid, diag));
    products = withImage.slice(0, MAX_PRICE_LOOKUPS).map((p: any, i: number) => ({ ...p, supplierPriceUsd: costs[i] || p.supplierPriceUsd, costSource: costs[i] ? "gelato-price-api" : "gelato-list-price" }))
      .filter((p: any) => p.supplierPriceUsd > 0);
  }
  diag.shown = products.length;
  diag.costSources = products.reduce((acc: any, p: any) => { acc[p.costSource || "none"] = (acc[p.costSource || "none"] || 0) + 1; return acc; }, {});
  return { products: products.slice(0, 50), diag, source: storeId && products.length && !diag.catalogProducts ? "gelato-live-store" : "gelato-live-catalog" };
}

export async function onRequestGet(context: any) {
  // Each shop serves its own sector only (a missing or foreign ?q= used to fall back to "beauty").
  const sector = STORE.sector;
  const headersOut = { "access-control-allow-origin": "*", "cache-control": "public, max-age=300" };
  if (!context.env.GELATO_API_KEY) {
    return Response.json({ error: "Gelato is not configured", products: [], supplier: "Gelato", sector, source: "gelato-unconfigured" }, { status: 503, headers: headersOut });
  }
  const origin = new URL(context.request.url).origin;
  const key = `${origin}/__cache/gelato-products/v3?sector=${encodeURIComponent(sector)}`;
  const cache = (globalThis as any).caches?.default;
  let cached = gelatoMemory.get(key) || null;
  if (!cached && cache) {
    try { const hit = await cache.match(key); if (hit) cached = await hit.json(); } catch (_) {}
  }
  const refresh = () => {
    let job = gelatoInflight.get(key);
    if (!job) {
      job = buildGelato(context.env, sector).then(async (payload) => {
        const value = { at: Date.now(), payload };
        gelatoMemory.set(key, value);
        try { if (cache) await cache.put(key, new Response(JSON.stringify(value), { headers: { "content-type": "application/json", "cache-control": `public, max-age=${GELATO_KEEP_SECONDS}` } })); } catch (_) {}
        return value;
      });
      gelatoInflight.set(key, job);
      job.finally(() => gelatoInflight.delete(key)).catch(() => {});
    }
    return job;
  };
  try {
    let value = cached;
    let state = "hit";
    if (!value) { value = await refresh(); state = "miss"; }
    else if (Date.now() - value.at > GELATO_FRESH_MS) {
      state = "stale-revalidate";
      if (typeof context.waitUntil === "function") context.waitUntil(refresh().catch(() => null));
    }
    const { products, diag, source } = value!.payload;
    const priced = await withQuotes(context.env, "gelato", products, gelatoIds);
    return Response.json({
      ok: true,
      supplier: "Gelato",
      sector,
      query: sector,
      products: priced,
      count: priced.length,
      source,
      diagnostics: diag,
      markets: ["NO", "EU", "PE"],
      compliance: "EU/Nordic POD merch",
    }, { status: priced.length ? 200 : 503, headers: { ...headersOut, "x-catalog-cache": state } });
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
