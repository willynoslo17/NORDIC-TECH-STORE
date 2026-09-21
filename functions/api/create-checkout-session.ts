import cjCatalog from "../../catalog/selected-products.json";
import printifyCatalog from "../../catalog/printify-products.json";

type Env = { STRIPE_SECRET_KEY?: string };
type CartItem = { id: string | number; quantity: number; sku?: string; provider?: string; name?: string };
type CheckoutPayload = {
  market: "NO" | "EU" | "PE";
  items: CartItem[];
  email: string;
  order_id: string;
};
type CatalogRow = {
  name?: string;
  sku?: string;
  suggestedRetailUsd?: number;
  supplierPriceUsd?: number;
  supplier?: string;
  provider?: string;
  id?: string | number;
  printifyProductId?: string;
  printifyVariantId?: string | number;
};

const markets = {
  NO: { currency: "nok", rate: 11.3, shipping: 79 },
  EU: { currency: "eur", rate: 1, shipping: 7.9 },
  PE: { currency: "pen", rate: 4.05, shipping: 14 },
} as const;

type ProductEntry = { name: string; sku: string; usd: number; provider: string };

function normalizeProvider(raw: string | undefined): string {
  const value = String(raw || "").toLowerCase();
  if (value.includes("printify")) return "printify";
  if (value.includes("printful")) return "printful";
  if (value.includes("gelato")) return "gelato";
  if (value.includes("cj")) return "cj";
  return value || "cj";
}

function toEntry(product: CatalogRow): ProductEntry {
  return {
    name: String(product.name || "Product").slice(0, 200),
    sku: String(product.sku || product.printifyVariantId || "").slice(0, 100),
    usd: Number(product.suggestedRetailUsd || product.supplierPriceUsd || 0),
    provider: normalizeProvider(product.provider || product.supplier),
  };
}

const products = new Map<string, ProductEntry>();

(cjCatalog as CatalogRow[]).slice(0, 30).forEach((product, index) => {
  const entry = toEntry(product);
  products.set(String(index + 1), entry);
  products.set(String(10001 + index), entry);
  if (product.id != null) products.set(String(product.id), entry);
  if (entry.sku) products.set(entry.sku, entry);
});

(printifyCatalog as CatalogRow[]).slice(0, 30).forEach((product, index) => {
  const entry = toEntry({ ...product, provider: "printify", supplier: "Printify" });
  products.set(String(20001 + index), entry);
  if (product.id != null) products.set(String(product.id), entry);
  if (entry.sku) products.set(entry.sku, entry);
});

function resolveProduct(item: CartItem): ProductEntry | undefined {
  return products.get(String(item.id))
    || (item.sku ? products.get(String(item.sku)) : undefined);
}

function json(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  if (!context.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")) {
    return json("Live payments are not configured", 503);
  }

  let body: CheckoutPayload;
  try { body = await context.request.json(); }
  catch { return json("Invalid JSON", 400); }

  const market = markets[body.market];
  if (!market || !Array.isArray(body.items) || !body.items.length || body.items.length > 30) {
    return json("Invalid cart", 400);
  }
  if (typeof body.email !== "string" || !body.email.includes("@")) return json("Invalid email", 400);

  let lines: { product: ProductEntry; quantity: number; amount: number }[];
  try {
    lines = body.items.map((item) => {
      const product = resolveProduct(item);
      const quantity = Math.max(1, Math.min(10, Math.trunc(Number(item.quantity) || 0)));
      if (!product || !Number.isFinite(product.usd) || product.usd <= 0) throw new Error("Invalid product");
      const provider = normalizeProvider(item.provider || product.provider);
      return {
        product: { ...product, provider },
        quantity,
        amount: Math.max(50, Math.round(product.usd * market.rate * 100)),
      };
    });
  } catch {
    return json("Invalid product", 400);
  }

  const providers = [...new Set(lines.map((line) => line.product.provider))];
  const origin = new URL(context.request.url).origin;
  const params = new URLSearchParams({
    mode: "payment",
    success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?payment=cancelled`,
    customer_email: body.email.slice(0, 254),
    "metadata[store]": "nordic-tech-store",
    "metadata[order_id]": String(body.order_id || "").slice(0, 100),
    "metadata[market]": body.market,
    "metadata[provider]": providers[0] || "cj",
    "metadata[providers]": providers.join(",").slice(0, 100),
  });

  lines.forEach((line, index) => {
    params.set(`line_items[${index}][price_data][currency]`, market.currency);
    params.set(`line_items[${index}][price_data][unit_amount]`, String(line.amount));
    params.set(`line_items[${index}][price_data][product_data][name]`, line.product.name);
    params.set(`line_items[${index}][price_data][product_data][metadata][sku]`, line.product.sku);
    params.set(`line_items[${index}][price_data][product_data][metadata][provider]`, line.product.provider);
    params.set(`line_items[${index}][quantity]`, String(line.quantity));
  });
  const shippingIndex = lines.length;
  params.set(`line_items[${shippingIndex}][price_data][currency]`, market.currency);
  params.set(`line_items[${shippingIndex}][price_data][unit_amount]`, String(Math.round(market.shipping * 100)));
  params.set(`line_items[${shippingIndex}][price_data][product_data][name]`, "Standard shipping");
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
