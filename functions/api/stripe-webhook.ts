import { STORE } from "../_shared/store";
import { buildOrderPayload } from "../_shared/order-payload";

type Env = {
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  MAKE_ORDERS_WEBHOOK?: string;
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

export async function onRequestPost(context: { request: Request; env: Env }) {
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

  const order = buildOrderPayload(event as Record<string, unknown>, session, lineItems);
  const response = await fetch(makeHook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(order),
  });
  if (!response.ok) return Response.json({ error: "Automation unavailable" }, { status: 502 });
  return Response.json({ received: true, forwarded: true });
}

export function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
