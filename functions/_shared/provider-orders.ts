/**
 * Provider-ready order bodies for the v2 payload (Make scenario "orders" route).
 * Pure builders over the payload from buildOrderPayload(), plus a best-effort CJ shipping-method lookup.
 * Nothing here may make the Stripe webhook fail: the webhook wraps every call in try/catch.
 */
import type { OrderLine } from "./order-payload";

type Order = {
  store: string;
  brand: string;
  domain: string;
  order_id: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  shipping: { name: string; phone: string; line1: string; line2: string; city: string; state: string; postal_code: string; country: string };
  shipping_line: { description: string; amount_total: number; currency: string };
  line_items: OrderLine[];
  missing_ids: string[];
  warnings: string[];
  amount_total: number;
  currency: string;
  stripe_session_id: string;
};

export type ProviderFields = {
  printify_line_items: Array<{ product_id: string; variant_id: number; quantity: number }>;
  printify_order_json: string;
  gelato_order_json: string;
  cj_order_json: string;
  printful_order_json: string;
  needs_review: boolean;
  review_reason: string;
  review_summary: string;
};

export type CjLogistic = { name: string; price?: number; source: string; warning?: string };

export const CJ_DEFAULT_LOGISTIC = "CJPacket Ordinary";
/** Providers that the Make scenario submits automatically. Printful lines always go to manual review. */
export const AUTOMATED_PROVIDERS = ["printify", "gelato", "cj"];

const EU = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV",
  "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

const COUNTRY_NAMES: Record<string, string> = {
  NO: "Norway", IS: "Iceland", LI: "Liechtenstein", AT: "Austria", BE: "Belgium", BG: "Bulgaria", HR: "Croatia",
  CY: "Cyprus", CZ: "Czech Republic", DK: "Denmark", EE: "Estonia", FI: "Finland", FR: "France", DE: "Germany",
  GR: "Greece", HU: "Hungary", IE: "Ireland", IT: "Italy", LV: "Latvia", LT: "Lithuania", LU: "Luxembourg",
  MT: "Malta", NL: "Netherlands", PL: "Poland", PT: "Portugal", RO: "Romania", SK: "Slovakia", SI: "Slovenia",
  ES: "Spain", SE: "Sweden", GB: "United Kingdom", CH: "Switzerland", US: "United States", CA: "Canada", PE: "Peru",
};

export function countryName(code: string): string {
  const c = String(code || "").toUpperCase();
  if (COUNTRY_NAMES[c]) return COUNTRY_NAMES[c];
  try {
    const name = new (Intl as any).DisplayNames(["en"], { type: "region" }).of(c);
    if (name && name !== c) return String(name);
  } catch {
    /* Intl.DisplayNames unavailable */
  }
  return c;
}

/** "Kari Nordmann" -> Kari / Nordmann; "Anne Marie van Dyk" -> Anne / Marie van Dyk; "Cher" -> Cher / "-" (Printify requires a last name). */
export function splitName(name: string): { first_name: string; last_name: string } {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first_name: "", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0], last_name: "-" };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

function clip(value: string, max: number) {
  const v = String(value || "");
  return v.length > max ? v.slice(0, max) : v;
}

function money(minor: number, currency: string) {
  return `${(Number(minor || 0) / 100).toFixed(2)} ${String(currency || "").toUpperCase()}`.trim();
}

export function addressComplete(order: Order) {
  const s = order.shipping;
  return Boolean(s.line1 && s.city && s.country);
}

function recipientName(order: Order) {
  return String(order.shipping.name || order.customer_name || "").trim();
}

function phoneOf(order: Order) {
  return String(order.shipping.phone || order.customer_phone || "");
}

/** Fulfillable CJ lines -> [{vid, quantity}] (used for freightCalculate and createOrderV2). */
export function cjProducts(order: Order) {
  return order.line_items
    .filter((line) => line.provider === "cj" && line.fulfillable && line.cj_vid)
    .map((line) => ({ vid: line.cj_vid, quantity: line.quantity, storeLineItemId: `${order.order_id}-${line.line_index}` }));
}

export function buildProviderFields(
  order: Order,
  options: { gelatoFiles?: Record<number, string>; cjLogistic?: CjLogistic | null } = {},
): ProviderFields {
  const lines = order.line_items || [];
  const s = order.shipping;
  const shipOk = addressComplete(order);
  const name = recipientName(order);
  const { first_name, last_name } = splitName(name);
  const phone = phoneOf(order);
  const gelatoFiles = options.gelatoFiles || {};

  // ---- Printify
  const printifyLines = lines.filter(
    (line) => line.provider === "printify" && line.fulfillable && line.printify_product_id && Number.isFinite(Number(line.printify_variant_id)) && Number(line.printify_variant_id) > 0,
  );
  const printify_line_items = printifyLines.map((line) => ({
    product_id: line.printify_product_id,
    variant_id: Number(line.printify_variant_id),
    quantity: line.quantity,
  }));
  const printify_order_json =
    shipOk && printify_line_items.length
      ? JSON.stringify({
          external_id: order.stripe_session_id,
          label: order.order_id,
          line_items: printify_line_items,
          shipping_method: 1,
          send_shipping_notification: false,
          address_to: {
            first_name,
            last_name,
            email: order.customer_email,
            phone,
            country: s.country,
            region: s.state,
            address1: s.line1,
            address2: s.line2,
            city: s.city,
            zip: s.postal_code,
          },
        })
      : "";

  // ---- Gelato (needs a print file per line; today no line has one, so this is normally "")
  const gelatoLines = lines.filter((line) => line.provider === "gelato" && line.fulfillable && line.gelato_product_uid && gelatoFiles[line.line_index]);
  const gelato_order_json =
    shipOk && gelatoLines.length
      ? JSON.stringify({
          orderType: "order",
          orderReferenceId: order.order_id || order.stripe_session_id,
          customerReferenceId: order.customer_email || order.stripe_session_id,
          currency: String(order.currency || "").toUpperCase(),
          items: gelatoLines.map((line) => ({
            itemReferenceId: `${order.order_id}-${line.line_index}`,
            productUid: line.gelato_product_uid,
            quantity: line.quantity,
            files: [{ type: "default", url: gelatoFiles[line.line_index] }],
          })),
          shippingAddress: {
            firstName: first_name,
            lastName: last_name,
            addressLine1: s.line1,
            addressLine2: s.line2,
            city: s.city,
            postCode: s.postal_code,
            state: s.state,
            country: s.country,
            email: order.customer_email,
            phone,
          },
        })
      : "";

  // ---- CJ (createOrderV2)
  const cjItems = cjProducts(order);
  const logistic = options.cjLogistic?.name || CJ_DEFAULT_LOGISTIC;
  const country = String(s.country || "").toUpperCase();
  const cj_order_json =
    shipOk && cjItems.length
      ? JSON.stringify({
          orderNumber: order.order_id || order.stripe_session_id,
          shippingZip: clip(s.postal_code, 20),
          shippingCountryCode: country,
          shippingCountry: clip(countryName(country), 50),
          shippingProvince: clip(s.state || s.city, 50),
          shippingCity: clip(s.city, 50),
          shippingAddress: clip(s.line1, 500),
          shippingAddress2: clip(s.line2, 500),
          shippingCustomerName: clip(name, 50),
          shippingPhone: clip(phone, 20),
          email: clip(order.customer_email, 50),
          remark: clip(`${order.store} / ${order.stripe_session_id}`, 500),
          logisticName: logistic,
          fromCountryCode: "CN",
          payType: 3, // create the order only; it is paid in CJ (balance) after review
          iossType: EU.has(country) ? 3 : 1,
          products: cjItems,
        })
      : "";

  // ---- Printful (only synced variants carry a design; current catalog items are blanks -> "")
  const printfulLines = lines.filter((line) => line.provider === "printful" && line.fulfillable && Number(line.printful_sync_variant_id) > 0);
  const printful_order_json =
    shipOk && printfulLines.length
      ? JSON.stringify({
          external_id: order.order_id,
          shipping: "STANDARD",
          recipient: {
            name,
            address1: s.line1,
            address2: s.line2,
            city: s.city,
            state_code: s.state,
            country_code: country,
            zip: s.postal_code,
            phone,
            email: order.customer_email,
          },
          items: printfulLines.map((line) => ({
            sync_variant_id: Number(line.printful_sync_variant_id),
            quantity: line.quantity,
            retail_price: (Number(line.unit_amount || 0) / 100).toFixed(2),
            name: line.name,
          })),
          retail_costs: { currency: String(order.currency || "").toUpperCase() },
        })
      : "";

  // ---- Review decision
  const reasons: string[] = [];
  for (const line of lines) {
    const label = `línea ${line.line_index} (${line.provider || "sin proveedor"}, ${line.name || line.sku || "?"})`;
    if (!line.fulfillable) reasons.push(`${label}: falta ${line.missing.join(", ") || "datos"}`);
    else if (!AUTOMATED_PROVIDERS.includes(line.provider)) reasons.push(`${label}: sin envío automático, hacer pedido a mano`);
  }
  // A fulfillable line of an automated provider that did not make it into that provider's body (e.g. bad id format).
  const included = new Set<number>();
  if (printify_order_json) printifyLines.forEach((line) => included.add(line.line_index));
  if (gelato_order_json) gelatoLines.forEach((line) => included.add(line.line_index));
  if (cj_order_json) lines.filter((line) => line.provider === "cj" && line.fulfillable && line.cj_vid).forEach((line) => included.add(line.line_index));
  const leftOut = lines.filter((line) => line.fulfillable && AUTOMATED_PROVIDERS.includes(line.provider) && !included.has(line.line_index));
  if (shipOk) for (const line of leftOut) reasons.push(`línea ${line.line_index} (${line.provider}, ${line.name || line.sku || "?"}): no incluida en el pedido automático`);
  if (order.missing_ids.includes("order:shipping_address_incomplete")) reasons.push("dirección de envío incompleta");
  if (order.missing_ids.includes("order:no_product_lines")) reasons.push("pedido sin productos");
  for (const warning of order.warnings) {
    const m = warning.match(/^(\d+):printify:matched_by_product_type$/);
    if (m) reasons.push(`línea ${m[1]} (printify): producto emparejado por tipo, verificar diseño antes de producir`);
    else if (warning.startsWith("order:cj:logistic_default")) reasons.push(`CJ: no se pudo calcular el envío, se usó "${CJ_DEFAULT_LOGISTIC}"`);
    else reasons.push(warning);
  }
  const anyBody = Boolean(printify_order_json || gelato_order_json || cj_order_json || printful_order_json);
  if (!anyBody) reasons.push("ningún pedido de proveedor generado");
  const needs_review =
    lines.some((line) => !line.fulfillable || !AUTOMATED_PROVIDERS.includes(line.provider)) ||
    leftOut.length > 0 ||
    order.missing_ids.length > 0 ||
    order.warnings.length > 0 ||
    !anyBody;
  const unique = [...new Set(reasons)];
  const review_reason = needs_review ? clip(unique.join("; ") || "revisar pedido", 1000) : "";

  // ---- Plain-text summary for the owner's email
  const ids = (line: OrderLine) => {
    switch (line.provider) {
      case "printify": return `product_id=${line.printify_product_id || "-"} variant_id=${line.printify_variant_id || "-"}`;
      case "printful": return `product_id=${line.printful_product_id || "-"} sync_variant_id=${line.printful_sync_variant_id || "-"} variant_id=${line.printful_variant_id || "-"}`;
      case "gelato": return `productUid=${line.gelato_product_uid || "-"}`;
      case "cj": return `pid=${line.cj_pid || "-"} vid=${line.cj_vid || "-"}`;
      default: return `sku=${line.sku || "-"}`;
    }
  };
  const address = [s.line1, s.line2, [s.postal_code, s.city].filter(Boolean).join(" "), s.state, s.country].filter(Boolean).join(", ");
  const auto = [
    `Printify ${printify_order_json ? "sí" : "no"}`,
    `Gelato ${gelato_order_json ? "sí" : "no"}`,
    `CJ ${cj_order_json ? `sí (${logistic})` : "no"}`,
    `Printful ${printful_order_json ? "cuerpo listo, enviar a mano" : "no"}`,
  ].join(", ");
  const review_summary = [
    `Tienda: ${order.brand} (${order.store}, ${order.domain})`,
    `Pedido: ${order.order_id || "-"} | Stripe: ${order.stripe_session_id}`,
    `Total: ${money(order.amount_total, order.currency)} (envío ${money(order.shipping_line?.amount_total || 0, order.shipping_line?.currency || order.currency)})`,
    `Cliente: ${name || "-"} <${order.customer_email || "-"}> ${phone}`.trim(),
    `Dirección: ${address || "-"}`,
    "Líneas:",
    ...lines.map((line) => `- [${line.line_index}] ${line.provider || "?"} | ${line.name || "-"} | x${line.quantity} | sku=${line.sku || "-"} | ${ids(line)} | ${line.fulfillable ? "OK" : "FALTA " + line.missing.join(", ")}`),
    `Automático: ${auto}`,
  ].join("\n");

  return { printify_line_items, printify_order_json, gelato_order_json, cj_order_json, printful_order_json, needs_review, review_reason, review_summary };
}

/** Used when building the provider fields throws: same keys, nothing automatic, owner reviews by hand. */
export function fallbackProviderFields(order: Partial<Order>, error: unknown): ProviderFields {
  let summary = "";
  try {
    summary = [
      `Tienda: ${order.brand || ""} (${order.store || ""})`,
      `Pedido: ${order.order_id || "-"} | Stripe: ${order.stripe_session_id || "-"}`,
      `Cliente: ${order.customer_name || "-"} <${order.customer_email || "-"}>`,
      ...(order.line_items || []).map((line) => `- [${line.line_index}] ${line.provider} | ${line.name} | x${line.quantity}`),
    ].join("\n");
  } catch {
    summary = "";
  }
  return {
    printify_line_items: [],
    printify_order_json: "",
    gelato_order_json: "",
    cj_order_json: "",
    printful_order_json: "",
    needs_review: true,
    review_reason: clip(`error interno al preparar pedidos de proveedor (${error instanceof Error ? error.message : String(error)}); revisar a mano`, 500),
    review_summary: summary,
  };
}

/** Cheapest option from a CJ freightCalculate `data` array. */
export function cheapestLogistic(options: unknown): { name: string; price: number } | null {
  const list = Array.isArray(options) ? options : [];
  let best: { name: string; price: number } | null = null;
  for (const option of list) {
    const name = String((option as any)?.logisticName || "").trim();
    const price = Number((option as any)?.logisticPrice ?? (option as any)?.totalPostageFee);
    if (!name || !Number.isFinite(price)) continue;
    if (!best || price < best.price) best = { name, price };
  }
  return best;
}
