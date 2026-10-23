// Server-only cost tables (functions/ is not served by Pages); the public /catalog copies carry priceNok only.
import cjCatalog from "../_shared/catalog-data/cj-selected.json";
import printifySelected from "../_shared/catalog-data/printify-selected.json";
import printifyCatalog from "../_shared/catalog-data/printify-products.json";
import { STORE } from "../_shared/store";
import { verifyQuote, SUPPLIER_ID_FIELDS, type SupplierIds } from "../_shared/quote";
import { costUsd, retailNokFromCost, marketUnitAmount } from "../_shared/pricing";
import { resolveCjVariant } from "../_shared/cj";

type Env = { STRIPE_SECRET_KEY?: string; CJ_API_KEY?: string };
/** Browser cart line. Prices are never read from here, only identifiers and the server-signed quote. */
type CartItem = { id?: string | number; ref?: string; sku?: string; provider?: string; quantity?: number; quote?: string };
type CheckoutPayload = {
  market: "NO";
  items: CartItem[];
  email: string;
  order_id: string;
};
type Provider = "cj" | "printify" | "gelato" | "printful";
type ResolvedLine = {
  provider: Provider;
  ref: string;
  sku: string;
  name: string;
  costUsd: number; // supplier cost of the sold variant; the price is derived from it (../_shared/pricing)
  ids: SupplierIds;
  pricingSource: "quote" | "catalog";
  match: string;
};

/** rate = currency units per EUR (NOK 11.7, the same rate the storefront uses). Norwegian store only. */
const markets = {
  NO: { currency: "nok", rate: 11.7, shipping: 79 },
} as const;

/** Free standard shipping when merchandise subtotal (NOK) reaches this threshold. */
const FREE_SHIP_NOK = 799;

/** Norwegian storefront: deliver to Norway only (Peru canal is a separate future store). */
const SHIPPING_COUNTRIES = ["NO"];

const PROVIDERS: Provider[] = ["cj", "printify", "gelato", "printful"];
const MAX_CJ_LOOKUPS = 5;

function normalizeProvider(raw: unknown): Provider | "" {
  const value = String(raw || "").toLowerCase();
  if (value.includes("printify")) return "printify";
  if (value.includes("printful")) return "printful";
  if (value.includes("gelato")) return "gelato";
  if (value.includes("cj")) return "cj";
  return "";
}

type StaticRow = Record<string, any>;
function staticIds(provider: Provider, row: StaticRow): SupplierIds {
  if (provider === "cj") return { cj_pid: row.id != null ? String(row.id) : "", cj_vid: String(row.vid || row.cjVid || "") };
  if (provider === "printify") return { printify_product_id: String(row.printifyProductId || ""), printify_variant_id: String(row.printifyVariantId || "") };
  if (provider === "gelato") return { gelato_product_uid: String(row.gelatoProductUid || "") };
  return {
    printful_product_id: String(row.printfulProductId || ""),
    printful_sync_variant_id: String(row.printfulSyncVariantId || ""),
    printful_variant_id: String(row.printfulVariantId || ""),
    printful_external_variant_id: String(row.printfulExternalVariantId || ""),
  };
}

/** Server-only cost tables (same rows as the storefront's public fallback JSON), indexed by provider + ref and provider + sku. */
const staticIndex = new Map<string, StaticRow>();
function indexRows(provider: Provider, rows: unknown) {
  if (!Array.isArray(rows)) return;
  for (const row of rows as StaticRow[]) {
    if (!row || !costUsd(provider, row)) continue;
    const ref = row.id != null ? String(row.id) : "";
    const sku = String(row.sku || "");
    if (ref && !staticIndex.has(`${provider}|ref|${ref}`)) staticIndex.set(`${provider}|ref|${ref}`, row);
    if (sku && !staticIndex.has(`${provider}|sku|${sku}`)) staticIndex.set(`${provider}|sku|${sku}`, row);
  }
}
indexRows("cj", cjCatalog);
indexRows("printify", printifySelected);
indexRows("printify", printifyCatalog);
// Gelato / Printful rows carry no verified cost (see ../_shared/pricing), so they are never sold from a static table.

/** Real Printify shop products (product_id|variant_id) the store sells; anything else is not sold via Printify. */
const linkedPrintify = new Set<string>(
  (Array.isArray(printifySelected) ? (printifySelected as StaticRow[]) : [])
    .filter((row) => /^[0-9a-f]{24}$/.test(String(row?.printifyProductId || "")) && /^\d+$/.test(String(row?.printifyVariantId || "")))
    .map((row) => `${row.printifyProductId}|${row.printifyVariantId}`),
);
function printifyLinked(ids: SupplierIds | undefined) {
  return linkedPrintify.has(`${ids?.printify_product_id || ""}|${ids?.printify_variant_id || ""}`);
}

function staticLookup(item: CartItem): ResolvedLine | null {
  const claimed = normalizeProvider(item.provider);
  const providers = claimed ? [claimed] : PROVIDERS;
  const ref = String(item.ref ?? "").trim();
  const sku = String(item.sku ?? "").trim();
  for (const provider of providers) {
    const row = (ref && staticIndex.get(`${provider}|ref|${ref}`)) || (sku && staticIndex.get(`${provider}|sku|${sku}`));
    if (!row) continue;
    return {
      provider,
      ref: row.id != null ? String(row.id) : ref,
      sku: String(row.sku || ""),
      name: String(row.name || "Product").slice(0, 200),
      costUsd: costUsd(provider, row),
      ids: staticIds(provider, row),
      pricingSource: "catalog",
      match: "",
    };
  }
  return null;
}

async function resolveLine(item: CartItem, env: Env): Promise<ResolvedLine | null> {
  if (item && typeof item.quote === "string" && item.quote) {
    const quote = await verifyQuote(env, item.quote);
    const provider = quote ? normalizeProvider(quote.p) : "";
    // Printify: only quotes for rows linked to a real product/variant in shop 28847802 are honoured
    // (older quotes carrying type-matched ids fall through to the bundled catalog and are rejected there).
    if (quote && provider && (provider !== "printify" || printifyLinked(quote.x))) {
      return {
        provider,
        ref: quote.r,
        sku: quote.k,
        name: quote.n || "Product",
        costUsd: quote.c,
        ids: quote.x || {},
        pricingSource: "quote",
        match: quote.m || "",
      };
    }
  }
  return staticLookup(item);
}

function json(error: string, status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ error, ...extra }, { status });
}

/** Betaling midlertidig stengt. Sett til true for å åpne Stripe Checkout igjen. */
const CHECKOUT_ENABLED = false;

export async function onRequestPost(context: { request: Request; env: Env }) {
  if (!CHECKOUT_ENABLED) {
    return json("Nettbutikken åpner snart. Kontakt oss på kontakt@novverk.no.", 503);
  }
  if (!context.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
    return json("Test-mode payments are not configured (expects sk_test_)", 503);
  }

  let body: CheckoutPayload;
  try { body = await context.request.json(); }
  catch { return json("Invalid JSON", 400); }

  if (body?.market !== "NO") return json("Invalid market", 400);
  const market = markets.NO;
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 30) {
    return json("Invalid cart", 400);
  }
  if (typeof body.email !== "string" || !body.email.includes("@")) return json("Invalid email", 400);

  // Every line is priced from server data (encrypted cost quote or server-only catalog cost) with the retail rule
  // in ../_shared/pricing (cost -> NOK x 2.5, min 99, ending in 9). Browser prices are never used.
  const lines: { product: ResolvedLine; quantity: number; amount: number; nok: number }[] = [];
  for (let index = 0; index < body.items.length; index++) {
    const item = body.items[index] || {};
    const product = await resolveLine(item, context.env);
    const nok = product ? retailNokFromCost(product.costUsd) : 0;
    if (!product || !nok) {
      return json("Invalid product", 400, { line: index });
    }
    const quantity = Math.max(1, Math.min(10, Math.trunc(Number(item.quantity) || 0)));
    lines.push({ product, quantity, nok, amount: Math.max(50, marketUnitAmount(nok, market.currency, market.rate)) });
  }

  // CJ: resolve the default variant (vid) server-side. Checkout still proceeds if it fails; the webhook then reports it in missing_ids.
  let cjLookups = 0;
  for (const line of lines) {
    if (line.product.provider !== "cj" || line.product.ids.cj_vid || !line.product.ids.cj_pid) continue;
    if (cjLookups++ >= MAX_CJ_LOOKUPS) break;
    const variant = await resolveCjVariant(String(line.product.ids.cj_pid), context.env);
    if (variant) line.product.ids = { ...line.product.ids, cj_vid: variant.vid };
  }

  const providers = [...new Set(lines.map((line) => line.product.provider))];
  const origin = new URL(context.request.url).origin;
  const params = new URLSearchParams({
    mode: "payment",
    success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?payment=cancelled`,
    customer_email: body.email.slice(0, 254),
    // Unpaid sessions expire after 1 hour (Stripe minimum 30 min); checkout.session.expired then starts the abandoned-cart e-mails.
    expires_at: String(Math.floor(Date.now() / 1000) + 3600),
    "phone_number_collection[enabled]": "true",
    "metadata[schema]": "nordic-order/v2",
    "metadata[store]": STORE.slug,
    "metadata[brand]": STORE.brand,
    "metadata[domain]": STORE.domain,
    "metadata[order_id]": String(body.order_id || "").slice(0, 100),
    "metadata[market]": body.market,
    "metadata[provider]": providers.length === 1 ? providers[0] : "mixed",
    "metadata[providers]": providers.join(",").slice(0, 100),
  });
  SHIPPING_COUNTRIES.forEach((country, index) => {
    params.set(`shipping_address_collection[allowed_countries][${index}]`, country);
  });

  lines.forEach((line, index) => {
    const prefix = `line_items[${index}][price_data]`;
    const meta = `${prefix}[product_data][metadata]`;
    params.set(`${prefix}[currency]`, market.currency);
    params.set(`${prefix}[unit_amount]`, String(line.amount));
    params.set(`${prefix}[product_data][name]`, line.product.name);
    params.set(`${meta}[kind]`, "product");
    params.set(`${meta}[store]`, STORE.slug);
    params.set(`${meta}[line_index]`, String(index));
    params.set(`${meta}[provider]`, line.product.provider);
    params.set(`${meta}[pricing_source]`, line.product.pricingSource);
    params.set(`${meta}[unit_cost_usd]`, String(line.product.costUsd));
    params.set(`${meta}[unit_nok]`, String(line.nok));
    if (line.product.sku) params.set(`${meta}[sku]`, line.product.sku.slice(0, 500));
    if (line.product.ref) params.set(`${meta}[ref]`, line.product.ref.slice(0, 500));
    if (line.product.match) params.set(`${meta}[printify_match]`, line.product.match);
    for (const field of SUPPLIER_ID_FIELDS) {
      const value = line.product.ids[field];
      if (value) params.set(`${meta}[${field}]`, String(value).slice(0, 500));
    }
    params.set(`line_items[${index}][quantity]`, String(line.quantity));
  });
  const shippingIndex = lines.length;
  const merchandiseNok = lines.reduce((sum, line) => sum + line.nok * line.quantity, 0);
  const shippingAmount = merchandiseNok >= FREE_SHIP_NOK ? 0 : Math.round(market.shipping * 100);
  params.set(`line_items[${shippingIndex}][price_data][currency]`, market.currency);
  params.set(`line_items[${shippingIndex}][price_data][unit_amount]`, String(shippingAmount));
  params.set(
    `line_items[${shippingIndex}][price_data][product_data][name]`,
    shippingAmount === 0 ? "Gratis frakt" : "Standardfrakt"
  );
  params.set(`line_items[${shippingIndex}][price_data][product_data][metadata][kind]`, "shipping");
  params.set(`line_items[${shippingIndex}][quantity]`, "1");

  const stripe = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${context.env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const result = await stripe.json() as { url?: string; error?: { message?: string } };
  if (!stripe.ok || !result.url) return json(result.error?.message || "Stripe checkout unavailable", 502);
  return Response.json({ url: result.url });
}

export function onRequest() {
  return json("Method not allowed", 405);
}
