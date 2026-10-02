/**
 * Encrypted price quotes (v3, 2026-10-02).
 *
 * Catalog functions return only the customer price (`priceNok`) and an opaque `quote` per product. The quote is an
 * AES-256-GCM encrypted snapshot (provider, product ref, sku, name, supplier cost in USD, supplier IDs, expiry); the
 * key is derived from STRIPE_SECRET_KEY, so customers can neither read the supplier cost nor forge or alter a quote
 * (GCM authentication fails). Checkout decrypts the quote and recomputes the price from the cost with the same rule
 * (./pricing), so the charged price always equals the displayed one. v1/v2 quotes (readable base64 JSON) are rejected.
 * Public product objects are rebuilt from a field whitelist (publicProduct) so no cost field can leak.
 */
import { STORE } from "./store";
import { costUsd, retailNok } from "./pricing";

export type SupplierIds = {
  printify_product_id?: string;
  printify_variant_id?: string;
  printful_product_id?: string;
  printful_sync_variant_id?: string;
  printful_variant_id?: string;
  printful_external_variant_id?: string;
  gelato_product_uid?: string;
  cj_pid?: string;
  cj_vid?: string;
};

export const SUPPLIER_ID_FIELDS: (keyof SupplierIds)[] = [
  "printify_product_id",
  "printify_variant_id",
  "printful_product_id",
  "printful_sync_variant_id",
  "printful_variant_id",
  "printful_external_variant_id",
  "gelato_product_uid",
  "cj_pid",
  "cj_vid",
];

export type Quote = {
  v: 3;
  s: string; // store slug
  p: string; // provider
  r: string; // provider product ref (the product's own id)
  k: string; // sku
  n: string; // display name
  c: number; // supplier cost in USD of the sold variant (price basis, see ./pricing) - encrypted, never public
  x: SupplierIds;
  m?: string; // match quality hint (printify: "id")
  e: number; // expiry, epoch seconds
};

const QUOTE_TTL_SECONDS = 48 * 3600;
const TOKEN_PREFIX = "q3";
const encoder = new TextEncoder();
let keyCache: { secret: string; key: Promise<CryptoKey> } | null = null;

function toB64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string): Uint8Array<ArrayBuffer> {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** AES-256-GCM key = HMAC-SHA256(STRIPE_SECRET_KEY, "nordic-catalog-quote-v3"). */
async function deriveKey(secret: string): Promise<CryptoKey> {
  const root = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const material = await crypto.subtle.sign("HMAC", root, encoder.encode("nordic-catalog-quote-v3"));
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function quoteKey(env: any): Promise<CryptoKey> | null {
  const secret = env && typeof env.STRIPE_SECRET_KEY === "string" ? env.STRIPE_SECRET_KEY : "";
  if (!secret) return null;
  if (!keyCache || keyCache.secret !== secret) keyCache = { secret, key: deriveKey(secret) };
  return keyCache.key;
}

function cleanIds(ids: SupplierIds | undefined): SupplierIds {
  const out: SupplierIds = {};
  for (const field of SUPPLIER_ID_FIELDS) {
    const value = ids?.[field];
    if (value != null && String(value).trim()) out[field] = String(value).trim().slice(0, 200);
  }
  return out;
}

const aad = () => encoder.encode(`nordic-quote|${STORE.slug}`);

export async function signQuote(
  env: any,
  data: { provider: string; ref: string; sku: string; name: string; cost: number; ids?: SupplierIds; match?: string },
): Promise<string> {
  const key = quoteKey(env);
  if (!key) return "";
  const cost = Math.round(Number(data.cost) * 10000) / 10000;
  if (!Number.isFinite(cost) || cost <= 0) return "";
  const quote: Quote = {
    v: 3,
    s: STORE.slug,
    p: String(data.provider),
    r: String(data.ref || "").slice(0, 200),
    k: String(data.sku || "").slice(0, 100),
    n: String(data.name || "Product").slice(0, 200),
    c: cost,
    x: cleanIds(data.ids),
    e: Math.floor(Date.now() / 1000) + QUOTE_TTL_SECONDS,
  };
  if (data.match) quote.m = String(data.match).slice(0, 20);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad() }, await key, encoder.encode(JSON.stringify(quote))),
  );
  return `${TOKEN_PREFIX}.${toB64url(iv)}.${toB64url(sealed)}`;
}

export async function verifyQuote(env: any, token: unknown): Promise<Quote | null> {
  if (typeof token !== "string" || token.length > 4000) return null;
  const key = quoteKey(env);
  if (!key) return null;
  const [prefix, ivPart, sealedPart, extra] = token.split(".");
  if (prefix !== TOKEN_PREFIX || !ivPart || !sealedPart || extra !== undefined) return null;
  try {
    const iv = fromB64url(ivPart);
    if (iv.length !== 12) return null;
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: aad() }, await key, fromB64url(sealedPart));
    const quote = JSON.parse(new TextDecoder().decode(plain)) as Quote;
    if (quote?.v !== 3 || quote.s !== STORE.slug) return null;
    if (!Number.isFinite(quote.e) || quote.e < Math.floor(Date.now() / 1000)) return null;
    if (!Number.isFinite(quote.c) || quote.c <= 0) return null;
    quote.x = cleanIds(quote.x);
    return quote;
  } catch {
    return null;
  }
}

/**
 * Fields a public catalog response may carry. Everything else (supplierPriceUsd, supplierPriceMaxUsd,
 * suggestedRetailUsd, retailNok, base, sellPrice, shipping costs, raw supplier rows, ...) is dropped.
 */
export const PUBLIC_FIELDS = [
  "id", "sku", "name", "category", "cat", "brand", "supplier", "provider", "image", "images", "description", "size",
  "variantTitle", "sector", "compliance", "origin", "printProvider", "hasCECertification",
  "printifyProductId", "printifyVariantId", "printifyMatch",
  "printfulProductId", "printfulSyncVariantId", "printfulVariantId", "printfulExternalVariantId", "printfulSource",
  "gelatoProductUid", "catalogUid", "priceNok", "quote",
] as const;

export function publicProduct(product: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of PUBLIC_FIELDS) {
    const value = product?.[field];
    if (value !== undefined && value !== null && value !== "") out[field] = value;
  }
  return out;
}

/**
 * Public catalog rows: the retail price (`priceNok`, from the supplier cost by the ./pricing rule) plus an encrypted
 * `quote` for every product whose cost is known; no cost fields. Products without a determinable cost get neither,
 * so the storefront hides them. (Quotes are only issued when STRIPE_SECRET_KEY is bound.)
 */
export async function withQuotes(
  env: any,
  provider: string,
  products: any[],
  idsOf: (product: any) => SupplierIds,
  matchOf?: (product: any) => string | undefined,
): Promise<any[]> {
  if (!Array.isArray(products) || !products.length) return [];
  const signing = Boolean(quoteKey(env));
  return Promise.all(
    products.map(async (product) => {
      const { quote: _old, priceNok: _oldPrice, ...clean } = product || {};
      const cost = costUsd(provider, product);
      if (!cost) return publicProduct(clean);
      const priced = { ...clean, priceNok: retailNok(provider, product) };
      if (!signing) return publicProduct(priced);
      const quote = await signQuote(env, {
        provider,
        ref: String(product?.id ?? ""),
        sku: String(product?.sku ?? ""),
        name: String(product?.name ?? ""),
        cost,
        ids: idsOf(product),
        match: matchOf ? matchOf(product) : undefined,
      });
      return publicProduct(quote ? { ...priced, quote } : priced);
    }),
  );
}
