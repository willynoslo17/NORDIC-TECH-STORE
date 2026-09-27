/**
 * Builds the v2 order payload that stripe-webhook.ts forwards to Make (MAKE_ORDERS_WEBHOOK).
 * Pure function over the Stripe event/session and the expanded line items, so it can be tested offline.
 */
import { STORE } from "./store";
import { SUPPLIER_ID_FIELDS, type SupplierIds } from "./quote";

export const PROVIDERS = ["printify", "printful", "gelato", "cj"] as const;
export type Provider = (typeof PROVIDERS)[number];

/** Fields a line needs before Make can submit it to the supplier automatically. */
export const REQUIRED_FIELDS: Record<Provider, string[]> = {
  printify: ["printify_product_id", "printify_variant_id"],
  printful: ["printful_sync_variant_id"], // a catalog variant_id alone is a blank product without design files
  gelato: ["gelato_product_uid", "gelato_file_url"], // Gelato needs print files; none are stored yet
  cj: ["cj_pid", "cj_vid"],
};

export type OrderLine = {
  line_index: number;
  provider: string;
  sku: string;
  name: string;
  quantity: number;
  unit_amount: number;
  amount_subtotal: number;
  amount_total: number;
  currency: string;
  ref: string;
  pricing_source: string;
  printify_match: string;
  stripe_price_id: string;
  stripe_product_id: string;
  missing: string[];
  fulfillable: boolean;
} & Required<SupplierIds>;

type Rec = Record<string, unknown>;

function rec(value: unknown): Rec {
  return value && typeof value === "object" ? (value as Rec) : {};
}

function str(value: unknown): string {
  return value == null ? "" : String(value);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function extractShipping(session: Rec) {
  const customer = rec(session.customer_details);
  const candidates: [string, Rec][] = [
    ["shipping_details", rec(session.shipping_details)],
    ["collected_information.shipping_details", rec(rec(session.collected_information).shipping_details)],
    ["customer_details.address", { name: customer.name, address: customer.address }],
  ];
  let source = "";
  let chosen: Rec = {};
  for (const [label, candidate] of candidates) {
    const address = rec(candidate.address);
    if (address.line1 || address.country) {
      source = label;
      chosen = candidate;
      break;
    }
  }
  const address = rec(chosen.address);
  return {
    source,
    shipping: {
      name: str(chosen.name || customer.name),
      phone: str(chosen.phone || customer.phone),
      line1: str(address.line1),
      line2: str(address.line2),
      city: str(address.city),
      state: str(address.state),
      postal_code: str(address.postal_code),
      country: str(address.country),
    },
  };
}

function isShippingLine(item: Rec, meta: Rec) {
  if (str(meta.kind) === "shipping") return true;
  return !str(meta.kind) && str(item.description) === "Standard shipping";
}

export function buildOrderPayload(event: Rec, session: Rec, lineItems: Rec[], receivedAt = new Date()) {
  const meta = rec(session.metadata);
  const customer = rec(session.customer_details);
  const { source: shippingSource, shipping } = extractShipping(session);
  const lines: OrderLine[] = [];
  let shippingLine = { description: "", amount_total: 0, currency: "" };

  for (const item of lineItems) {
    const price = rec(item.price);
    const product = rec(price.product);
    const pmeta = rec(product.metadata);
    if (isShippingLine(item, pmeta)) {
      shippingLine = {
        description: str(item.description || product.name),
        amount_total: shippingLine.amount_total + num(item.amount_total),
        currency: str(item.currency),
      };
      continue;
    }
    const provider = str(pmeta.provider).toLowerCase();
    const ids = {} as Required<SupplierIds>;
    for (const field of SUPPLIER_ID_FIELDS) ids[field] = str(pmeta[field]);
    const index = lines.length;
    const required = (PROVIDERS as readonly string[]).includes(provider) ? REQUIRED_FIELDS[provider as Provider] : ["provider"];
    const missing = required.filter((field) => field === "provider" || !str((ids as any)[field] ?? pmeta[field]));
    const quantity = num(item.quantity);
    lines.push({
      line_index: index,
      provider,
      sku: str(pmeta.sku),
      name: str(item.description || product.name),
      quantity,
      unit_amount: num(price.unit_amount) || (quantity ? Math.round(num(item.amount_subtotal) / quantity) : 0),
      amount_subtotal: num(item.amount_subtotal),
      amount_total: num(item.amount_total),
      currency: str(item.currency),
      ref: str(pmeta.ref),
      pricing_source: str(pmeta.pricing_source),
      printify_match: str(pmeta.printify_match),
      stripe_price_id: str(price.id),
      stripe_product_id: str(product.id || (typeof price.product === "string" ? price.product : "")),
      ...ids,
      missing,
      fulfillable: missing.length === 0,
    });
  }

  const providers = [...new Set(lines.map((line) => line.provider).filter(Boolean))];
  const groups: Record<Provider, OrderLine[]> = { printify: [], printful: [], gelato: [], cj: [] };
  for (const line of lines) if ((PROVIDERS as readonly string[]).includes(line.provider)) groups[line.provider as Provider].push(line);
  const missingIds = lines.flatMap((line) => line.missing.map((field) => `${line.line_index}:${line.provider || "unknown"}:${field}`));
  const warnings = lines
    .filter((line) => line.provider === "printify" && line.printify_match === "type")
    .map((line) => `${line.line_index}:printify:matched_by_product_type`);
  if (!lines.length) missingIds.push("order:no_product_lines");
  if (!shipping.line1 || !shipping.city || !shipping.country) missingIds.push("order:shipping_address_incomplete");
  const created = num(session.created);

  return {
    schema: "nordic-order/v2",
    source: "stripe",
    event_id: str(event.id),
    event_type: str(event.type),
    livemode: Boolean(session.livemode ?? event.livemode),
    store: STORE.slug,
    brand: STORE.brand,
    domain: STORE.domain,
    site_url: STORE.siteUrl,
    order_id: str(meta.order_id),
    market: str(meta.market),
    provider: providers.length === 1 ? providers[0] : providers.length > 1 ? "mixed" : "",
    providers,
    payment_status: str(session.payment_status),
    customer_email: str(customer.email || session.customer_email),
    customer_name: str(customer.name || shipping.name),
    customer_phone: str(customer.phone || shipping.phone),
    shipping,
    shipping_source: shippingSource,
    shipping_line: shippingLine,
    line_items: lines,
    groups,
    missing_ids: missingIds,
    warnings,
    fulfillable: missingIds.length === 0,
    amount_subtotal: num(session.amount_subtotal),
    amount_total: num(session.amount_total),
    currency: str(session.currency),
    stripe_session_id: str(session.id),
    stripe_payment_intent: str(typeof session.payment_intent === "string" ? session.payment_intent : rec(session.payment_intent).id),
    created_at: created ? new Date(created * 1000).toISOString() : "",
    received_at: receivedAt.toISOString(),
  };
}
