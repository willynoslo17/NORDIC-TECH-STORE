/**
 * CJ variant resolution for checkout: pid -> default (first) variant vid.
 * Uses the same CJ_API_KEY -> getAccessToken flow as /api/cj-products. Stores without CJ_API_KEY
 * ask the shared CJ store's /api/cj-variant (same host the catalog fallback already uses).
 * Results are cached in isolate memory and, best effort, in the Cloudflare Cache API.
 * The access token is only kept in isolate memory. It is never persisted or returned.
 *
 * Also: CJ freightCalculate (shipping method for createOrderV2), same token flow and the same
 * nordic-beauty-perfumes fallback (/api/cj-freight) for stores without CJ_API_KEY.
 */
import { cheapestLogistic, CJ_DEFAULT_LOGISTIC, type CjLogistic } from "./provider-orders";
const CJ_BASE = "https://developers.cjdropshipping.com/api2.0/v1";
const CJ_VARIANT_FALLBACK = "https://nordic-beauty-perfumes.pages.dev/api/cj-variant";
const CJ_FREIGHT_FALLBACK = "https://nordic-beauty-perfumes.pages.dev/api/cj-freight";
const CJ_GAP_MS = 1100;
const VARIANT_TTL_SECONDS = 7 * 24 * 3600;

export type CjVariant = { pid: string; vid: string; sku: string; source: string };

const memory = new Map<string, { value: CjVariant; until: number }>();
let tokenCache: { key: string; token: string; until: number } | null = null;
let lastCall = 0;

export function validPid(pid: unknown): pid is string {
  return typeof pid === "string" && /^[A-Za-z0-9-]{6,64}$/.test(pid);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function paced<T>(fn: () => Promise<T>): Promise<T> {
  const wait = lastCall + CJ_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  return fn();
}

function isQps(status: number, body: any) {
  return status === 429 || /too many requests|qps/i.test(String(body?.message || ""));
}

async function cjJson(url: string, init: RequestInit, attempt = 1): Promise<any> {
  const response = await paced(() => fetch(url, { ...init, signal: AbortSignal.timeout(8000) }));
  const body: any = await response.json().catch(() => ({}));
  if (isQps(response.status, body) && attempt < 3) {
    await sleep(CJ_GAP_MS * attempt);
    return cjJson(url, init, attempt + 1);
  }
  if (!response.ok || body?.result === false || body?.success === false) {
    throw new Error(String(body?.message || `CJ HTTP ${response.status}`));
  }
  return body;
}

async function cjToken(apiKey: string): Promise<string> {
  if (tokenCache && tokenCache.key === apiKey && tokenCache.until > Date.now()) return tokenCache.token;
  const body = await cjJson(`${CJ_BASE}/authentication/getAccessToken`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  const token = String(body?.data?.accessToken || "");
  if (!token) throw new Error("CJ authentication failed");
  const expiry = Date.parse(String(body?.data?.accessTokenExpiryDate || ""));
  const until = Number.isFinite(expiry) ? Math.min(expiry - 3600_000, Date.now() + 12 * 3600_000) : Date.now() + 3600_000;
  tokenCache = { key: apiKey, token, until };
  return token;
}

function pickVariant(pid: string, variants: any[], source: string): CjVariant | null {
  const list = Array.isArray(variants) ? variants.filter((v) => v && v.vid) : [];
  const chosen = list[0];
  if (!chosen) return null;
  return { pid, vid: String(chosen.vid), sku: String(chosen.variantSku || ""), source };
}

async function fromCjApi(pid: string, apiKey: string): Promise<CjVariant | null> {
  const token = await cjToken(apiKey);
  const headers = { "CJ-Access-Token": token };
  const detail = await cjJson(`${CJ_BASE}/product/query?pid=${encodeURIComponent(pid)}`, { headers });
  const fromDetail = pickVariant(pid, detail?.data?.variants, "cj-product-query");
  if (fromDetail) return fromDetail;
  const variants = await cjJson(`${CJ_BASE}/product/variant/query?pid=${encodeURIComponent(pid)}`, { headers });
  return pickVariant(pid, variants?.data, "cj-variant-query");
}

async function fromFallback(pid: string): Promise<CjVariant | null> {
  const response = await fetch(`${CJ_VARIANT_FALLBACK}?pid=${encodeURIComponent(pid)}`, {
    headers: { "user-agent": "nordic-cj-variant-fallback" },
    signal: AbortSignal.timeout(12000),
  });
  const body: any = await response.json().catch(() => null);
  if (!response.ok || !body?.ok || !body?.vid) return null;
  return { pid, vid: String(body.vid), sku: String(body.sku || ""), source: "fallback:" + String(body.source || "cj") };
}

function cacheKey(pid: string) {
  return `https://cj-variant-cache.invalid/v1/${encodeURIComponent(pid)}`;
}

async function cacheGet(pid: string): Promise<CjVariant | null> {
  try {
    const cache = (globalThis as any).caches?.default;
    if (!cache) return null;
    const hit = await cache.match(cacheKey(pid));
    if (!hit) return null;
    const value = (await hit.json()) as CjVariant;
    return value?.vid ? value : null;
  } catch {
    return null;
  }
}

async function cachePut(value: CjVariant) {
  try {
    const cache = (globalThis as any).caches?.default;
    if (!cache) return;
    await cache.put(
      cacheKey(value.pid),
      new Response(JSON.stringify(value), {
        headers: { "content-type": "application/json", "cache-control": `public, max-age=${VARIANT_TTL_SECONDS}` },
      }),
    );
  } catch {
    /* best effort */
  }
}

/** Resolve the default CJ variant for a product id. Returns null (never throws) when it can't. */
export async function resolveCjVariant(
  pid: string,
  env: any,
  options: { allowFallback?: boolean } = {},
): Promise<CjVariant | null> {
  if (!validPid(pid)) return null;
  const mem = memory.get(pid);
  if (mem && mem.until > Date.now()) return mem.value;
  let value = await cacheGet(pid);
  if (!value) {
    try {
      const apiKey = env && env.CJ_API_KEY ? String(env.CJ_API_KEY) : "";
      if (apiKey) value = await fromCjApi(pid, apiKey);
      else if (options.allowFallback !== false) value = await fromFallback(pid);
    } catch {
      value = null;
    }
    if (value) await cachePut(value);
  }
  if (value) memory.set(pid, { value, until: Date.now() + VARIANT_TTL_SECONDS * 1000 });
  return value;
}

// ---------------------------------------------------------------- freight (shipping method)

export type FreightRequest = { endCountryCode: string; zip: string; products: Array<{ vid: string; quantity: number }> };

/** Validates/normalises a freight request (also used by the public /api/cj-freight endpoint). */
export function validFreightRequest(body: any): FreightRequest | null {
  const endCountryCode = String(body?.endCountryCode || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(endCountryCode)) return null;
  const zip = String(body?.zip || "").trim();
  if (zip && !/^[A-Za-z0-9 -]{1,20}$/.test(zip)) return null;
  const list = Array.isArray(body?.products) ? body.products : [];
  if (!list.length || list.length > 20) return null;
  const products: FreightRequest["products"] = [];
  for (const p of list) {
    const vid = String(p?.vid || "");
    const quantity = Number(p?.quantity);
    if (!validPid(vid) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) return null;
    products.push({ vid, quantity });
  }
  return { endCountryCode, zip, products };
}

/** Raw CJ freightCalculate options (logisticName, logisticPrice USD, logisticAging, ...). Throws on CJ errors. */
export async function cjFreightOptions(apiKey: string, request: FreightRequest): Promise<any[]> {
  const token = await cjToken(apiKey);
  const body = await cjJson(`${CJ_BASE}/logistic/freightCalculate`, {
    method: "POST",
    headers: { "content-type": "application/json", "CJ-Access-Token": token },
    body: JSON.stringify({ startCountryCode: "CN", endCountryCode: request.endCountryCode, ...(request.zip ? { zip: request.zip } : {}), products: request.products }),
  });
  return Array.isArray(body?.data) ? body.data : [];
}

async function freightFromFallback(request: FreightRequest, timeoutMs: number): Promise<{ name: string; price: number } | null> {
  const response = await fetch(CJ_FREIGHT_FALLBACK, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "nordic-cj-freight-fallback" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body: any = await response.json().catch(() => null);
  if (!response.ok || !body?.ok || !body?.logisticName) return null;
  const price = Number(body.logisticPrice);
  return { name: String(body.logisticName), price: Number.isFinite(price) ? price : 0 };
}

/**
 * Cheapest CJ shipping method for the order, or CJ_DEFAULT_LOGISTIC with a warning.
 * Never throws and never takes longer than timeoutMs (the Stripe webhook must stay fast).
 */
export async function chooseCjLogistic(env: any, request: FreightRequest, timeoutMs = 6000): Promise<CjLogistic> {
  const fallback: CjLogistic = { name: CJ_DEFAULT_LOGISTIC, source: "default", warning: "order:cj:logistic_default_cjpacket_ordinary" };
  const valid = validFreightRequest(request);
  if (!valid) return fallback;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); });
  const lookup = (async (): Promise<CjLogistic | null> => {
    try {
      const apiKey = env && env.CJ_API_KEY ? String(env.CJ_API_KEY) : "";
      if (apiKey) {
        const best = cheapestLogistic(await cjFreightOptions(apiKey, valid));
        return best ? { name: best.name, price: best.price, source: "cj-freightCalculate" } : null;
      }
      const best = await freightFromFallback(valid, timeoutMs);
      return best ? { name: best.name, price: best.price, source: "fallback:cj-freightCalculate" } : null;
    } catch {
      return null;
    }
  })();
  try {
    return (await Promise.race([lookup, timeout])) || fallback;
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
