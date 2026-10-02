/**
 * Brevo marketing e-mails for this store (welcome series, abandoned cart, post-purchase).
 *
 * - Templates live in ./marketing-templates.ts (generated from the owner's sheets, bokmål first, then Spanish) and are
 *   created in Brevo by name ("<Store> – Velkomst 1" ...) with sender "<Store> <kontakt@<domain>>". ensureTemplates()
 *   is idempotent: it only creates missing templates and only refreshes templates that carry this store's marker
 *   comment (i.e. ones created by this code). Nothing else in Brevo is changed or deleted.
 * - Only env.BREVO_API_KEY is used. It is never logged or returned. Tokens in links (welcome / unsubscribe) are
 *   AES-GCM sealed with a key derived from it, so links cannot be forged or read.
 * - Marketing e-mails (welcome, abandoned cart) go only to contacts that are in "<Store> nyhetsbrev" (double opt-in).
 * - Brevo can schedule transactional e-mails at most 72 h ahead; scheduled mails get a deterministic batchId so they
 *   can be cancelled (unsubscribe, completed purchase).
 */
import { STORE } from "./store";
import { MARKETING_TEMPLATES, MARKETING_VERSION } from "./marketing-templates";

export type MktEnv = { BREVO_API_KEY?: string; STRIPE_SECRET_KEY?: string };
const API = "https://api.brevo.com/v3";
export const LIST_NAME = `${STORE.brand} nyhetsbrev`;
export const SENDER = { name: STORE.brand, email: `kontakt@${STORE.domain}` };
export const SHOP_URL = `https://${STORE.domain}/`;
const MARKER = (key: string) => `<!-- nordic-mkt:${STORE.slug}:${key} -->`;
const TTL_MS = 6 * 3600 * 1000;
const HOUR = 3600 * 1000;
const MAX_AHEAD_MS = 71 * HOUR + 45 * 60 * 1000; // Brevo limit is 72 h from the API call

export class BrevoError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export async function brevo(env: MktEnv, method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<any> {
  const response = await fetch(API + path, {
    method,
    headers: { "api-key": String(env.BREVO_API_KEY), accept: "application/json", ...(body ? { "content-type": "application/json" } : {}), ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) throw new BrevoError(response.status, String(data?.code || ""), String(data?.message || `Brevo ${response.status}`).slice(0, 200));
  return data;
}

/* ---------------------------------------------------------------- crypto helpers (key derived from the API key) */

const b64u = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (text: string) => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4)), (c) => c.charCodeAt(0));
const hex = (bytes: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(bytes as ArrayBuffer), (b) => b.toString(16).padStart(2, "0")).join("");

async function derived(env: MktEnv, purpose: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`nordic-mkt|${STORE.slug}|${purpose}|${env.BREVO_API_KEY}`)));
}

export async function seal(env: MktEnv, purpose: string, value: unknown): Promise<string> {
  const key = await crypto.subtle.importKey("raw", await derived(env, `aes:${purpose}`), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(value))));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv); out.set(ct, iv.length);
  return b64u(out);
}

export async function unseal<T = any>(env: MktEnv, purpose: string, token: string): Promise<T | null> {
  try {
    if (!token || token.length > 1000) return null;
    const raw = unb64u(token);
    const key = await crypto.subtle.importKey("raw", await derived(env, `aes:${purpose}`), "AES-GCM", false, ["decrypt"]);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, key, raw.slice(12));
    return JSON.parse(new TextDecoder().decode(pt)) as T;
  } catch { return null; }
}

/** Deterministic UUIDv4-shaped id (Brevo batchId) for one scheduled e-mail. */
export async function batchId(env: MktEnv, ...parts: string[]): Promise<string> {
  const key = await crypto.subtle.importKey("raw", await derived(env, "batch"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const b = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(parts.join("|")))).slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = hex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function shortHash(env: MktEnv, ...parts: string[]): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${STORE.slug}|${parts.join("|")}|${(await derived(env, "id")).join(",")}`))).slice(0, 32);
}

export const utcDay = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
export const lastDays = (n: number) => Array.from({ length: n }, (_, i) => utcDay(Date.now() - i * 24 * HOUR));

/* ---------------------------------------------------------------- list + templates (cached) */

type Setup = { version: string; listId: number; ids: Record<string, number>; at: number; created: string[]; updated: string[]; conflicts: string[] };
let memory: Setup | null = null;
let inflight: Promise<Setup> | null = null;

async function findList(env: MktEnv): Promise<number> {
  for (let offset = 0; offset < 5000; offset += 50) {
    const data = await brevo(env, "GET", `/contacts/lists?limit=50&offset=${offset}`);
    const rows: any[] = Array.isArray(data?.lists) ? data.lists : [];
    const hit = rows.find((l) => String(l?.name || "").trim() === LIST_NAME);
    if (hit?.id) return Number(hit.id);
    if (rows.length < 50) break;
  }
  return 0; // the list is created by /api/newsletter (first signup / ?setup=1); we never create it here
}

async function allTemplates(env: MktEnv): Promise<any[]> {
  const out: any[] = [];
  for (let offset = 0; offset < 10000; offset += 1000) {
    const data = await brevo(env, "GET", `/smtp/templates?limit=1000&offset=${offset}`);
    const rows: any[] = Array.isArray(data?.templates) ? data.templates : [];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

async function build(env: MktEnv): Promise<Setup> {
  const existing = await allTemplates(env);
  const ids: Record<string, number> = {};
  const created: string[] = [], updated: string[] = [], conflicts: string[] = [];
  for (const t of MARKETING_TEMPLATES) {
    const wanted = { templateName: t.name, subject: t.subject, sender: SENDER, htmlContent: t.html, tag: t.tag, isActive: true, replyTo: SENDER.email };
    const found = existing.find((row) => String(row?.name || "").trim() === t.name);
    if (found?.id) {
      const ours = String(found.htmlContent || "").includes(MARKER(t.key));
      if (!ours) { conflicts.push(t.name); continue; } // same name but not created by this code: leave it alone
      const outdated = found.isActive !== true || String(found.subject || "") !== t.subject || String(found.tag || "") !== t.tag ||
        String(found.sender?.email || "").toLowerCase() !== SENDER.email || String(found.htmlContent || "") !== t.html;
      if (outdated) { await brevo(env, "PUT", `/smtp/templates/${Number(found.id)}`, wanted); updated.push(t.name); }
      ids[t.key] = Number(found.id);
    } else {
      const made = await brevo(env, "POST", "/smtp/templates", wanted);
      ids[t.key] = Number(made?.id);
      created.push(t.name);
    }
  }
  return { version: MARKETING_VERSION, listId: await findList(env), ids, at: Date.now(), created, updated, conflicts };
}

const cacheKey = (origin: string) => `${origin}/__cache/marketing-brevo/${MARKETING_VERSION}?store=${encodeURIComponent(STORE.slug)}`;

export async function ensureSetup(env: MktEnv, origin = SHOP_URL.replace(/\/$/, ""), force = false): Promise<Setup> {
  const fresh = (s: Setup | null) => s && s.version === MARKETING_VERSION && s.listId > 0 && Date.now() - s.at < TTL_MS;
  if (!force && fresh(memory)) return memory as Setup;
  const cache = (globalThis as any).caches?.default;
  if (!force && cache) {
    try {
      const hit = await cache.match(cacheKey(origin));
      const value = hit ? ((await hit.json()) as Setup) : null;
      if (fresh(value)) return (memory = value as Setup);
    } catch (_) {}
  }
  if (!inflight) {
    inflight = build(env).then(async (value) => {
      memory = value;
      try {
        if (cache && value.listId > 0) await cache.put(cacheKey(origin), new Response(JSON.stringify(value), { headers: { "content-type": "application/json", "cache-control": "public, max-age=21600" } }));
      } catch (_) {}
      return value;
    }).finally(() => { inflight = null; });
  }
  return inflight;
}

/* ---------------------------------------------------------------- contacts */

/** True only if the address confirmed the double opt-in for this store's list and is not blocklisted. */
export async function isSubscribed(env: MktEnv, setup: Setup, email: string): Promise<boolean> {
  if (!setup.listId) return false;
  try {
    const c = await brevo(env, "GET", `/contacts/${encodeURIComponent(email)}`);
    const lists: number[] = Array.isArray(c?.listIds) ? c.listIds.map(Number) : [];
    return lists.includes(setup.listId) && c?.emailBlacklisted !== true;
  } catch (error) {
    if (error instanceof BrevoError && error.status === 404) return false;
    throw error;
  }
}

/** Was this template already sent to this address in the last 30 days (Brevo transactional log)? */
export async function alreadySent(env: MktEnv, templateId: number, email: string): Promise<boolean> {
  try {
    const data = await brevo(env, "GET", `/smtp/emails?email=${encodeURIComponent(email)}&templateId=${templateId}&limit=1&sort=desc`);
    return Number(data?.count || 0) > 0 || (Array.isArray(data?.transactionalEmails) && data.transactionalEmails.length > 0);
  } catch { return false; }
}

/* ---------------------------------------------------------------- sending */

export type SendOptions = { at?: number; batch?: string; idempotency?: string; subjectPrefix?: string };

export async function sendTemplate(env: MktEnv, setup: Setup, key: string, email: string, params: Record<string, string>, opts: SendOptions = {}) {
  const templateId = setup.ids[key];
  if (!templateId) throw new BrevoError(500, "template_missing", `Template ${key} is not ready`);
  const body: Record<string, unknown> = {
    templateId,
    to: [{ email }],
    replyTo: { email: SENDER.email, name: SENDER.name },
    params: { shop_url: SHOP_URL, ...params },
    tags: [STORE.slug, key.replace(/-\d+$/, "")],
  };
  if (opts.subjectPrefix) {
    const t = MARKETING_TEMPLATES.find((x) => x.key === key);
    if (t) body.subject = `${opts.subjectPrefix}${t.subject}`;
  }
  if (opts.idempotency) body.headers = { "Idempotency-Key": opts.idempotency };
  if (opts.at && opts.at > Date.now() + 60 * 1000) {
    body.scheduledAt = new Date(Math.min(opts.at, Date.now() + MAX_AHEAD_MS)).toISOString();
    if (opts.batch) {
      // Brevo keeps a client batchId only for batch sends (messageVersions); a single-version batch keeps the mail
      // cancellable with DELETE /smtp/email/{batchId}.
      body.batchId = opts.batch;
      body.messageVersions = [{ to: body.to, params: body.params, ...(body.subject ? { subject: body.subject } : {}) }];
      delete body.to;
    }
  }
  try {
    return await brevo(env, "POST", "/smtp/email", body);
  } catch (error) {
    // Same Idempotency-Key / batchId already used: the mail was already sent or scheduled.
    if (error instanceof BrevoError && /already processed|duplicate/i.test(`${error.code} ${error.message}`)) return { duplicate: true };
    throw error;
  }
}

export async function cancelScheduled(env: MktEnv, ids: string[]) {
  await Promise.all([...new Set(ids)].map((id) => brevo(env, "DELETE", `/smtp/email/${id}`).catch(() => null)));
}

export async function unsubscribeUrl(env: MktEnv, email: string, day: string) {
  return `https://${STORE.domain}/api/newsletter-unsubscribe?k=${await seal(env, "unsub", { e: email, d: day })}`;
}

/** Welcome series after a confirmed double opt-in: 1 now, 2 after 24 h, 3 after ~72 h (Brevo limit). 4 needs a Brevo automation. */
export const WELCOME_SCHEDULE: Array<[string, number]> = [["welcome-1", 0], ["welcome-2", 24 * HOUR], ["welcome-3", MAX_AHEAD_MS]];
/** Abandoned cart after the Checkout Session expired (1 h after creation): 1 now, 2 at 24 h, 3 at 72 h after creation. */
export const CART_SCHEDULE: Array<[string, number]> = [["cart-1", 1 * HOUR], ["cart-2", 24 * HOUR], ["cart-3", 72 * HOUR]];

export async function startWelcome(env: MktEnv, email: string) {
  const setup = await ensureSetup(env);
  if (!(await isSubscribed(env, setup, email))) return { sent: false, reason: "not_subscribed" };
  if (await alreadySent(env, setup.ids["welcome-1"], email)) return { sent: false, reason: "already_sent" };
  const day = utcDay();
  const params = { unsubscribe_url: await unsubscribeUrl(env, email, day) };
  const now = Date.now();
  for (const [key, delay] of WELCOME_SCHEDULE) {
    await sendTemplate(env, setup, key, email, params, {
      at: delay ? now + delay : undefined,
      batch: await batchId(env, email, key, day),
      idempotency: await shortHash(env, email, key, day),
    });
  }
  return { sent: true };
}

export async function cancelSeries(env: MktEnv, email: string, keys: string[], days: string[]) {
  const ids: string[] = [];
  for (const day of days) for (const key of keys) ids.push(await batchId(env, email, key, day));
  await cancelScheduled(env, ids);
}

export async function unsubscribe(env: MktEnv, email: string, day?: string) {
  const setup = await ensureSetup(env);
  if (setup.listId) {
    try { await brevo(env, "POST", `/contacts/lists/${setup.listId}/contacts/remove`, { emails: [email] }); }
    catch (error) { if (!(error instanceof BrevoError && error.status === 400)) throw error; } // 400: not in the list
  }
  const days = [...new Set([...(day ? [day] : []), ...lastDays(4)])];
  await cancelSeries(env, email, ["welcome-2", "welcome-3", "cart-2", "cart-3"], days);
}

/** Abandoned cart (marketing): only for confirmed newsletter subscribers of this store. */
export async function startAbandonedCart(env: MktEnv, email: string, createdMs: number, productNames: string[]) {
  const setup = await ensureSetup(env);
  if (!(await isSubscribed(env, setup, email))) return { sent: false, reason: "no_newsletter_consent" };
  const day = utcDay();
  const names = productNames.filter(Boolean).map((n) => n.slice(0, 80));
  const product = names.length > 3 ? `${names.slice(0, 3).join(", ")} (+${names.length - 3})` : names.join(", ");
  const params = { product_name: product || STORE.brand, cart_url: SHOP_URL, unsubscribe_url: await unsubscribeUrl(env, email, day) };
  for (const [key, offset] of CART_SCHEDULE) {
    await sendTemplate(env, setup, key, email, params, {
      at: createdMs + offset,
      batch: await batchId(env, email, key, day),
      idempotency: await shortHash(env, email, key, day),
    });
  }
  return { sent: true };
}

/** Post-purchase e-mail 1 (order confirmation info) and cancellation of pending abandoned-cart reminders. */
export async function startPostPurchase(env: MktEnv, email: string, orderNumber: string, sessionId: string) {
  await cancelSeries(env, email, ["cart-2", "cart-3"], lastDays(4));
  const setup = await ensureSetup(env);
  await sendTemplate(env, setup, "purchase-1", email, { order_number: orderNumber }, { idempotency: await shortHash(env, sessionId, "purchase-1") });
  return { sent: true };
}
