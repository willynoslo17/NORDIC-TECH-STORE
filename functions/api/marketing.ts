/**
 * /api/marketing - Brevo marketing templates for this store (see ../_shared/brevo-marketing.ts).
 *
 * GET              -> { enabled }
 * GET ?setup=1     -> idempotent: creates the missing "<Store> – …" templates in Brevo (never touches other templates)
 *                     and reports template IDs, the newsletter list and whether the Stripe webhook endpoint for this
 *                     domain is subscribed to checkout.session.expired (needed for abandoned-cart e-mails).
 * POST { action: "test", token, to, keys? } -> sends "[TEST]" copies to one address. Only with the owner's test token
 *                     { action: "test", ..., scheduleInMinutes: n } schedules one "[TEST]" copy and returns its messageId;
 *                     { action: "scheduled", token, to, ids, cancel? } -> status (or cancellation) of scheduled messageIds.
 *                     (only its SHA-256 is stored here). Never used for customers.
 * The Brevo API key is never logged or returned.
 */
import { STORE } from "../_shared/store";
import { MARKETING_TEMPLATES, MARKETING_VERSION } from "../_shared/marketing-templates";
import { ensureSetup, sendTemplate, unsubscribeUrl, brevo, LIST_NAME, SENDER, SHOP_URL, BrevoError, type MktEnv } from "../_shared/brevo-marketing";

const TEST_TOKEN_SHA256 = "768b08e53ea9c9608fbbe6f9952d65a1369198b83791d3e0f7ec584f8d22f092";
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const noStore = { "cache-control": "no-store" };
const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: noStore });
let lastForced = 0;

async function stripeWebhookStatus(env: MktEnv) {
  if (!env.STRIPE_SECRET_KEY) return { checked: false };
  try {
    const response = await fetch("https://api.stripe.com/v1/webhook_endpoints?limit=100", { headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) return { checked: false, status: response.status };
    const data = (await response.json()) as { data?: Array<{ url?: string; status?: string; enabled_events?: string[] }> };
    const all = data.data || [];
    // This store's endpoint(s): custom domain or the Pages project (<slug>.pages.dev); other stores' endpoints are not listed.
    const mine = all.filter((w) => { const u = String(w.url || "").toLowerCase(); return u.includes("/api/stripe-webhook") && (u.includes(STORE.domain) || u.includes(STORE.slug)); });
    const has = (event: string) => mine.some((w) => w.status !== "disabled" && (w.enabled_events || []).some((e) => e === event || e === "*"));
    return { checked: true, accountEndpoints: all.length, endpoints: mine.map((w) => ({ host: (() => { try { return new URL(String(w.url)).host; } catch { return ""; } })(), status: w.status })),
      completed: has("checkout.session.completed"), expired: has("checkout.session.expired") };
  } catch { return { checked: false }; }
}

export async function onRequestGet(context: { request: Request; env: MktEnv }) {
  const { env, request } = context;
  const enabled = Boolean(env.BREVO_API_KEY);
  const url = new URL(request.url);
  if (!enabled || url.searchParams.get("setup") !== "1") return reply({ enabled, store: STORE.slug, version: MARKETING_VERSION });
  try {
    const force = Date.now() - lastForced > 60 * 1000;
    if (force) lastForced = Date.now();
    const setup = await ensureSetup(env, url.origin, force);
    return reply({
      enabled, store: STORE.slug, version: setup.version, sender: SENDER.email,
      list: LIST_NAME, listReady: setup.listId > 0,
      templates: MARKETING_TEMPLATES.map((t) => ({ name: t.name, id: setup.ids[t.key] || null })),
      created: setup.created, updated: setup.updated, conflicts: setup.conflicts,
      stripe: await stripeWebhookStatus(env),
    });
  } catch (error) {
    const e = error as BrevoError;
    return reply({ enabled, store: STORE.slug, ready: false, error: e?.message || "Brevo setup failed", code: e?.code || "" }, 502);
  }
}

async function sha256(text: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost(context: { request: Request; env: MktEnv }) {
  const { env, request } = context;
  if (!env.BREVO_API_KEY) return reply({ ok: false, error: "Not configured" }, 503);
  let body: any;
  try { body = await request.json(); } catch { return reply({ ok: false, error: "Invalid JSON" }, 400); }
  if (!["test", "scheduled"].includes(body?.action) || typeof body?.token !== "string" || (await sha256(body.token)) !== TEST_TOKEN_SHA256) return reply({ ok: false, error: "Forbidden" }, 403);
  const to = String(body?.to || "").trim().toLowerCase();
  if (!EMAIL.test(to)) return reply({ ok: false, error: "Invalid email" }, 400);
  if (body.action === "scheduled") {
    const out: Record<string, unknown> = {};
    for (const id of (Array.isArray(body?.ids) ? body.ids.map(String).slice(0, 10) : [])) {
      try { out[id] = await brevo(env, body?.cancel ? "DELETE" : "GET", body?.cancel ? `/smtp/email/${encodeURIComponent(id)}` : `/smtp/emailStatus/${encodeURIComponent(id)}`) ?? "deleted"; }
      catch (error) { out[id] = { error: (error as Error).message, status: (error as BrevoError).status }; }
    }
    return reply({ ok: true, ids: out });
  }
  const keys: string[] = Array.isArray(body?.keys) && body.keys.length ? body.keys.map(String) : MARKETING_TEMPLATES.map((t) => t.key);
  const setup = await ensureSetup(env, new URL(request.url).origin);
  const params = {
    product_name: "Testprodukt / Producto de prueba", cart_url: SHOP_URL, order_number: "TEST-0001",
    unsubscribe_url: await unsubscribeUrl(env, to, Array.isArray(body?.pending) ? body.pending.map(String) : []),
  };
  const results: Record<string, unknown> = {};
  const at = Number(body?.scheduleInMinutes) > 0 ? Date.now() + Math.min(Number(body.scheduleInMinutes), 4000) * 60 * 1000 : undefined;
  for (const key of keys.slice(0, 10)) {
    try { results[key] = { messageId: await sendTemplate(env, setup, key, to, body?.noParams ? {} : params, { subjectPrefix: "[TEST] ", at }) }; }
    catch (error) { results[key] = { error: (error as Error).message }; }
  }
  return reply({ ok: true, results });
}

export function onRequest() {
  return reply({ ok: false, error: "Method not allowed" }, 405);
}
