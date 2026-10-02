import { STORE } from "../_shared/store";
import { buildOrderPayload, productLineMetadata } from "../_shared/order-payload";
import { addressComplete, buildProviderFields, cjProducts, fallbackProviderFields, type CjLogistic } from "../_shared/provider-orders";
import { chooseCjLogistic } from "../_shared/cj";
import { startAbandonedCart, startPostPurchase } from "../_shared/brevo-marketing";

type Env = {
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  MAKE_ORDERS_WEBHOOK?: string;
  CJ_API_KEY?: string;
  BREVO_API_KEY?: string;
};

type StripeEvent = {
  id?: string;
  type?: string;
  livemode?: boolean;
  data?: { object?: Record<string, unknown> };
};

/** Events that can carry a paid Checkout Session. Anything else is acknowledged and ignored. */
const ORDER_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index++) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

async function validSignature(payload: string, signature: string, secret: string) {
  const parts = signature.split(",").map((part) => part.split("="));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  return signatures.some((candidate) => safeEqual(candidate, expected));
}

/** All line items of the session with price.product expanded (product metadata = provider, sku, supplier IDs). */
async function fetchLineItems(sessionId: string, secretKey: string): Promise<Array<Record<string, unknown>> | null> {
  if (!sessionId || !secretKey) return null;
  const items: Array<Record<string, unknown>> = [];
  let startingAfter = "";
  for (let page = 0; page < 10; page++) {
    const url = new URL(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}/line_items`);
    url.searchParams.set("limit", "100");
    url.searchParams.append("expand[]", "data.price.product");
    if (startingAfter) url.searchParams.set("starting_after", startingAfter);
    try {
      const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${secretKey}` } });
      if (!response.ok) return null;
      const body = (await response.json()) as { data?: Array<Record<string, unknown>>; has_more?: boolean };
      const data = Array.isArray(body.data) ? body.data : [];
      items.push(...data);
      if (!body.has_more || !data.length) return items;
      startingAfter = String(data[data.length - 1].id || "");
      if (!startingAfter) return items;
    } catch {
      return null;
    }
  }
  return items;
}

/**
 * Adds the provider-ready fields (printify_line_items, printify_order_json, gelato_order_json, cj_order_json,
 * printful_order_json, needs_review, review_reason, review_summary). Never throws: on any error the order is
 * still forwarded, with empty provider bodies and needs_review = true.
 */
async function withProviderOrders(order: ReturnType<typeof buildOrderPayload>, lineItems: Array<Record<string, unknown>>, env: Env) {
  try {
    const gelatoFiles: Record<number, string> = {};
    productLineMetadata(lineItems).forEach((meta, index) => {
      const url = String(meta.gelato_file_url || "");
      if (url) gelatoFiles[index] = url;
    });
    let cjLogistic: CjLogistic | null = null;
    let base = order;
    const cj = cjProducts(order);
    if (cj.length && addressComplete(order)) {
      cjLogistic = await chooseCjLogistic(env, {
        endCountryCode: order.shipping.country,
        zip: order.shipping.postal_code,
        products: cj.map(({ vid, quantity }) => ({ vid, quantity })),
      });
      if (cjLogistic.warning) base = { ...order, warnings: [...order.warnings, cjLogistic.warning] };
    }
    return { ...base, ...buildProviderFields(base, { gelatoFiles, cjLogistic }) };
  } catch (error) {
    return { ...order, ...fallbackProviderFields(order, error) };
  }
}


const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

function sessionEmail(session: Record<string, any>) {
  const email = String(session?.customer_details?.email || session?.customer_email || "").trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : "";
}

/** Did the same address complete a Checkout Session for this store since `sinceSec`? (then no abandoned-cart mail) */
async function purchasedSince(email: string, sinceSec: number, secretKey: string) {
  if (!secretKey) return false;
  const url = new URL("https://api.stripe.com/v1/checkout/sessions");
  url.searchParams.set("customer_details[email]", email);
  url.searchParams.set("status", "complete");
  url.searchParams.set("created[gte]", String(Math.max(0, Math.floor(sinceSec))));
  url.searchParams.set("limit", "20");
  try {
    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${secretKey}` } });
    if (!response.ok) return false;
    const body = (await response.json()) as { data?: Array<{ metadata?: Record<string, string> }> };
    return (body.data || []).some((s) => s?.metadata?.store === STORE.slug);
  } catch { return false; }
}

/** checkout.session.expired (sessions expire 1 h after creation): abandoned-cart series via Brevo, newsletter subscribers only. */
async function abandonedCart(session: Record<string, any>, env: Env) {
  const email = sessionEmail(session);
  if (!email || String(session.payment_status || "") === "paid") return;
  const created = Number(session.created) || Math.floor(Date.now() / 1000) - 3600;
  if (await purchasedSince(email, created, env.STRIPE_SECRET_KEY || "")) return;
  const items = (await fetchLineItems(String(session.id || ""), env.STRIPE_SECRET_KEY || "")) || [];
  const names = items
    .filter((item: any) => item?.price?.product?.metadata?.kind !== "shipping")
    .map((item: any) => String(item?.description || item?.price?.product?.name || "").trim())
    .filter(Boolean);
  await startAbandonedCart(env, email, created * 1000, names);
}

/** Paid order forwarded: post-purchase e-mail 1 via Brevo (and pending cart reminders are cancelled). */
async function afterPurchase(session: Record<string, any>, env: Env) {
  const email = sessionEmail(session);
  if (!email) return;
  const meta = (session.metadata || {}) as Record<string, string>;
  const orderNumber = String(meta.order_id || "").trim() || String(session.id || "").slice(-12);
  await startPostPurchase(env, email, orderNumber, String(session.id || ""));
}

export async function onRequestPost(context: { request: Request; env: Env; waitUntil?: (promise: Promise<unknown>) => void }) {
  const secret = context.env.STRIPE_WEBHOOK_SECRET;
  const makeHook = context.env.MAKE_ORDERS_WEBHOOK;
  if (!secret || !makeHook) return Response.json({ error: "Webhook not configured" }, { status: 503 });

  const payload = await context.request.text();
  const signature = context.request.headers.get("stripe-signature") || "";
  if (!(await validSignature(payload, signature, secret))) {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: StripeEvent;
  try { event = JSON.parse(payload); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  // Abandoned cart: only this store's sessions (several stores may share one Stripe account). Never affects the reply.
  if (event.type === "checkout.session.expired") {
    const expired = (event.data?.object || {}) as Record<string, any>;
    if (String(expired?.metadata?.store || "") !== STORE.slug) return Response.json({ received: true, reason: "other_store" });
    if (context.env.BREVO_API_KEY) {
      const job = abandonedCart(expired, context.env).catch(() => null);
      if (context.waitUntil) context.waitUntil(job); else await job;
    }
    return Response.json({ received: true, abandoned_cart: Boolean(context.env.BREVO_API_KEY) });
  }

  if (!ORDER_EVENTS.has(String(event.type))) return Response.json({ received: true });
  const session = event.data?.object || {};
  const meta = (session.metadata && typeof session.metadata === "object" ? session.metadata : {}) as Record<string, unknown>;

  // Several stores may share one Stripe account: only forward this store's sessions.
  if (meta.store && String(meta.store) !== STORE.slug) {
    return Response.json({ received: true, forwarded: false, reason: "other_store" });
  }
  // Paid orders only. Delayed methods arrive later as checkout.session.async_payment_succeeded.
  if (String(session.payment_status || "") !== "paid") {
    return Response.json({ received: true, forwarded: false, reason: `payment_status_${String(session.payment_status || "unknown")}` });
  }

  const lineItems = await fetchLineItems(String(session.id || ""), context.env.STRIPE_SECRET_KEY || "");
  // Don't forward an order without its lines. A non-2xx makes Stripe retry later.
  if (!lineItems) return Response.json({ error: "Could not load line items" }, { status: 502 });

  const order = await withProviderOrders(buildOrderPayload(event as Record<string, unknown>, session, lineItems), lineItems, context.env);
  const response = await fetch(makeHook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(order),
  });
  if (!response.ok) return Response.json({ error: "Automation unavailable" }, { status: 502 });
  // Post-purchase e-mail 1 (Brevo). Only after the order reached Make, only for this store; never affects the reply.
  if (context.env.BREVO_API_KEY && String(meta.store || "") === STORE.slug) {
    const job = afterPurchase(session as Record<string, any>, context.env).catch(() => null);
    if (context.waitUntil) context.waitUntil(job); else await job;
  }
  return Response.json({ received: true, forwarded: true });
}

export function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
