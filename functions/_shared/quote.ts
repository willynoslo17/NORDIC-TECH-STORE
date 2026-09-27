/**
 * Server-signed price quotes.
 *
 * Catalog functions attach a `quote` to every product they return. It is an HMAC-signed snapshot
 * of what the server displayed (provider, product ref, sku, name, USD price, supplier IDs).
 * Checkout accepts a price only from a valid quote or from the server-bundled catalog JSON, never
 * from browser-supplied numbers. The signing key is derived from STRIPE_SECRET_KEY, so no extra
 * secret is needed and the key never leaves the server.
 */
import { STORE } from "./store";

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
  v: 1;
  s: string; // store slug
  p: string; // provider
  r: string; // provider product ref (the product's own id)
  k: string; // sku
  n: string; // display name
  u: number; // USD price (display basis)
  x: SupplierIds;
  m?: string; // match quality hint (printify: "id" | "type")
  e: number; // expiry, epoch seconds
};

const QUOTE_TTL_SECONDS = 48 * 3600;
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

async function deriveKey(secret: string): Promise<CryptoKey> {
  const root = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const material = await crypto.subtle.sign("HMAC", root, encoder.encode("nordic-catalog-quote-v1"));
  return crypto.subtle.importKey("raw", material, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
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

export async function signQuote(
  env: any,
  data: { provider: string; ref: string; sku: string; name: string; usd: number; ids?: SupplierIds; match?: string },
): Promise<string> {
  const key = quoteKey(env);
  if (!key) return "";
  const usd = Math.round(Number(data.usd) * 100) / 100;
  if (!Number.isFinite(usd) || usd <= 0) return "";
  const quote: Quote = {
    v: 1,
    s: STORE.slug,
    p: String(data.provider),
    r: String(data.ref || "").slice(0, 200),
    k: String(data.sku || "").slice(0, 100),
    n: String(data.name || "Product").slice(0, 200),
    u: usd,
    x: cleanIds(data.ids),
    e: Math.floor(Date.now() / 1000) + QUOTE_TTL_SECONDS,
  };
  if (data.match) quote.m = String(data.match).slice(0, 20);
  const body = encoder.encode(JSON.stringify(quote));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await key, body));
  return `${toB64url(body)}.${toB64url(signature)}`;
}

export async function verifyQuote(env: any, token: unknown): Promise<Quote | null> {
  if (typeof token !== "string" || token.length > 4000) return null;
  const key = quoteKey(env);
  if (!key) return null;
  const [bodyPart, sigPart, extra] = token.split(".");
  if (!bodyPart || !sigPart || extra !== undefined) return null;
  try {
    const body = fromB64url(bodyPart);
    const ok = await crypto.subtle.verify("HMAC", await key, fromB64url(sigPart), body);
    if (!ok) return null;
    const quote = JSON.parse(new TextDecoder().decode(body)) as Quote;
    if (quote?.v !== 1 || quote.s !== STORE.slug) return null;
    if (!Number.isFinite(quote.e) || quote.e < Math.floor(Date.now() / 1000)) return null;
    if (!Number.isFinite(quote.u) || quote.u <= 0) return null;
    quote.x = cleanIds(quote.x);
    return quote;
  } catch {
    return null;
  }
}

/** Display price exactly as supplier-bridge.js computes it. */
export function displayUsd(product: any): number {
  const amount = Number(product?.suggestedRetailUsd || product?.supplierPriceUsd || product?.base || 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

/** Attach a signed `quote` to every priced product (no-op when STRIPE_SECRET_KEY is not bound). */
export async function withQuotes(
  env: any,
  provider: string,
  products: any[],
  idsOf: (product: any) => SupplierIds,
  matchOf?: (product: any) => string | undefined,
): Promise<any[]> {
  if (!Array.isArray(products) || !products.length || !quoteKey(env)) return products;
  return Promise.all(
    products.map(async (product) => {
      const usd = displayUsd(product);
      if (!usd) return product;
      const quote = await signQuote(env, {
        provider,
        ref: String(product?.id ?? ""),
        sku: String(product?.sku ?? ""),
        name: String(product?.name ?? ""),
        usd,
        ids: idsOf(product),
        match: matchOf ? matchOf(product) : undefined,
      });
      return quote ? { ...product, quote } : product;
    }),
  );
}
