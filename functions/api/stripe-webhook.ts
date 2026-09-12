type Env = {
  STRIPE_WEBHOOK_SECRET?: string;
  MAKE_ORDERS_WEBHOOK?: string;
};

type StripeEvent = {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> };
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
  const confirmation = {
    source: "stripe",
    event_id: String(event.id || ""),
    event_type: event.type,
    store: "nordic-tech-store",
    order_id: String((session.metadata as Record<string, unknown> | undefined)?.order_id || ""),
    market: String((session.metadata as Record<string, unknown> | undefined)?.market || ""),
    payment_status: String(session.payment_status || ""),
    customer_email: String((session.customer_details as Record<string, unknown> | undefined)?.email || session.customer_email || ""),
    amount_total: Number(session.amount_total || 0),
    currency: String(session.currency || ""),
    stripe_session_id: String(session.id || ""),
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
