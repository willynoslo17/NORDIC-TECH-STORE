type Env = {
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  MAKE_ORDERS_WEBHOOK?: string;
};

type StripeEvent = {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> };
};

type AddressLike = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

type LineItemOut = {
  description: string;
  quantity: number;
  amount_total: number;
  currency: string;
  price_id: string;
};

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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function str(value: unknown) {
  return value == null ? "" : String(value);
}

function buildShipping(session: Record<string, unknown>) {
  const shippingDetails = asRecord(session.shipping_details);
  const customerDetails = asRecord(session.customer_details);
  const shippingAddress = asRecord(shippingDetails.address);
  const customerAddress = asRecord(customerDetails.address);
  const addr = (shippingAddress.line1 || shippingAddress.country ? shippingAddress : customerAddress) as AddressLike;
  return {
    name: str(shippingDetails.name || customerDetails.name || ""),
    phone: str(shippingDetails.phone || customerDetails.phone || ""),
    line1: str(addr.line1 || ""),
    line2: str(addr.line2 || ""),
    city: str(addr.city || ""),
    state: str(addr.state || ""),
    postal_code: str(addr.postal_code || ""),
    country: str(addr.country || ""),
  };
}

async function fetchLineItems(sessionId: string, secretKey: string): Promise<LineItemOut[]> {
  if (!sessionId || !secretKey) return [];
  try {
    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}/line_items?limit=100`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
      }
    );
    if (!response.ok) return [];
    const body = (await response.json()) as { data?: Array<Record<string, unknown>> };
    return (body.data || []).map((item) => {
      const price = asRecord(item.price);
      return {
        description: str(item.description || ""),
        quantity: Number(item.quantity || 0),
        amount_total: Number(item.amount_total || 0),
        currency: str(item.currency || ""),
        price_id: str(price.id || ""),
      };
    });
  } catch {
    return [];
  }
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

  if (event.type !== "checkout.session.completed") return Response.json({ received: true });
  const session = event.data?.object || {};
  const meta = asRecord(session.metadata);
  const customerDetails = asRecord(session.customer_details);
  const sessionId = str(session.id);
  const lineItems = await fetchLineItems(sessionId, context.env.STRIPE_SECRET_KEY || "");

  const confirmation = {
    source: "stripe",
    event_id: String(event.id || ""),
    event_type: event.type,
    store: "nordic-tech-store",
    order_id: str(meta.order_id || ""),
    market: str(meta.market || ""),
    provider: str(meta.provider || ""),
    payment_status: str(session.payment_status || ""),
    customer_email: str(customerDetails.email || session.customer_email || ""),
    customer_name: str(customerDetails.name || ""),
    customer_phone: str(customerDetails.phone || ""),
    shipping: buildShipping(session),
    line_items: lineItems,
    amount_total: Number(session.amount_total || 0),
    currency: str(session.currency || ""),
    stripe_session_id: sessionId,
    received_at: new Date().toISOString(),
  };
  const response = await fetch(makeHook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(confirmation),
  });
  if (!response.ok) return Response.json({ error: "Automation unavailable" }, { status: 502 });
  return Response.json({ received: true });
}

export function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
