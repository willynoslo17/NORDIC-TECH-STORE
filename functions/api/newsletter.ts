/**
 * /api/newsletter - footer newsletter signup with double opt-in through Brevo (owner choice 2026-10-02).
 *
 * POST JSON { email, consent: true, lang?: "nb" | "es", source?: string, website?: "" (honeypot) }
 *   -> Brevo POST /v3/contacts/doubleOptinConfirmation: Brevo e-mails a confirmation link ({{ doubleoptin }}) and
 *      only adds the address to the store's list "<Store> nyhetsbrev" after the link is clicked; the visitor then
 *      lands on /nyhetsbrev-bekreftet.html. Consent is optional and never tied to a purchase.
 * GET -> { enabled } (the footer form switches itself on); GET ?setup=1 also prepares/reports list + template.
 *
 * Needs only the Pages secret BREVO_API_KEY. The list (folder "Nettbutikker") and the DOI template
 * "<Store> nyhetsbrev – bekreftelse (DOI)" (tag "optin", sender "<Store> <kontakt@<domain>>", bokmål then Spanish
 * text from newsletter-consentimiento.docx) are found by name or created once; their IDs are cached (memory +
 * Cache API). The API key is never logged or returned. Signups are rate limited per IP.
 */
import { STORE } from "../_shared/store";
import { DOI_TEXT } from "../_shared/newsletter-text";

type Env = { BREVO_API_KEY?: string };
const API = "https://api.brevo.com/v3";
const LIST_NAME = `${STORE.brand} nyhetsbrev`;
const TEMPLATE_NAME = `${STORE.brand} nyhetsbrev – bekreftelse (DOI)`;
const FOLDER_NAME = "Nettbutikker";
const SENDER = { name: STORE.brand, email: `kontakt@${STORE.domain}` };
const REDIRECT_URL = `https://${STORE.domain}/nyhetsbrev-bekreftet.html`;
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const RATE_MAX = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const SETUP_TTL_MS = 6 * 3600 * 1000;
const noStore = { "cache-control": "no-store" };

type Setup = { listId: number; templateId: number; at: number };
let setupMemory: Setup | null = null;
let setupInflight: Promise<Setup> | null = null;
const hits = new Map<string, number[]>();

class BrevoError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

function reply(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: noStore });
}

async function brevo(env: Env, method: string, path: string, body?: unknown): Promise<any> {
  const response = await fetch(API + path, {
    method,
    headers: { "api-key": String(env.BREVO_API_KEY), accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) throw new BrevoError(response.status, String(data?.code || ""), String(data?.message || `Brevo ${response.status}`).slice(0, 200));
  return data;
}

async function findAll(env: Env, path: string, key: string, pick: (row: any) => boolean, pageSize: number) {
  for (let offset = 0; offset < 5000; offset += pageSize) {
    const sep = path.includes("?") ? "&" : "?";
    const data = await brevo(env, "GET", `${path}${sep}limit=${pageSize}&offset=${offset}`);
    const rows: any[] = Array.isArray(data?.[key]) ? data[key] : [];
    const hit = rows.find(pick);
    if (hit) return hit;
    if (rows.length < pageSize) return null;
  }
  return null;
}

function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** DOI e-mail: bokmål first, then Spanish; the button links to {{ doubleoptin }} as Brevo requires. */
function doiHtml(): string {
  const section = (lang: "nb" | "es") => {
    const t = DOI_TEXT[lang];
    return `<div lang="${lang}" style="margin:0 0 28px">` +
      `<p style="margin:0 0 16px;line-height:1.55">${esc(t.intro)}</p>` +
      `<p style="margin:0 0 16px"><a href="{{ doubleoptin }}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:4px">${esc(t.button)}</a></p>` +
      `<p style="margin:0;line-height:1.55;font-size:13px;color:#555">${esc(t.outro)}</p></div>`;
  };
  return `<!doctype html><html lang="nb"><head><meta charset="utf-8"><title>${esc(DOI_TEXT.subject)}</title></head>` +
    `<body style="margin:0;padding:24px;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#111">` +
    `<div style="max-width:560px;margin:0 auto;background:#fff;padding:28px">` +
    `<p style="margin:0 0 20px;font-size:20px;font-weight:bold">${esc(STORE.brand)}</p>` +
    section("nb") + `<hr style="border:0;border-top:1px solid #ddd;margin:0 0 24px">` + section("es") +
    `<p style="margin:24px 0 0;font-size:12px;color:#777">MARTINEZ LOZANO INTERNASJONAL HANDEL · org.nr. 935 407 095 · Norbygata 19, 0187 Oslo · <a href="https://${STORE.domain}/personvern" style="color:#777">Personvern / Privacidad</a></p>` +
    `</div></body></html>`;
}

async function ensureList(env: Env): Promise<number> {
  const existing = await findAll(env, "/contacts/lists", "lists", (l) => String(l?.name || "").trim() === LIST_NAME, 50);
  if (existing?.id) return Number(existing.id);
  let folder = await findAll(env, "/contacts/folders", "folders", (f) => String(f?.name || "").trim() === FOLDER_NAME, 50);
  if (!folder?.id) folder = await brevo(env, "POST", "/contacts/folders", { name: FOLDER_NAME });
  // Re-check right before creating (another request may have created it meanwhile).
  const again = await findAll(env, "/contacts/lists", "lists", (l) => String(l?.name || "").trim() === LIST_NAME, 50);
  if (again?.id) return Number(again.id);
  const created = await brevo(env, "POST", "/contacts/lists", { name: LIST_NAME, folderId: Number(folder.id) });
  return Number(created.id);
}

async function ensureTemplate(env: Env): Promise<number> {
  const html = doiHtml();
  const wanted = { templateName: TEMPLATE_NAME, subject: DOI_TEXT.subject, sender: SENDER, htmlContent: html, tag: "optin", isActive: true, replyTo: SENDER.email };
  const existing = await findAll(env, "/smtp/templates", "templates", (t) => String(t?.name || "").trim() === TEMPLATE_NAME, 100);
  if (existing?.id) {
    const outdated = existing.isActive !== true || String(existing.tag || "") !== "optin" || String(existing.subject || "") !== DOI_TEXT.subject ||
      String(existing.sender?.email || "").toLowerCase() !== SENDER.email || String(existing.htmlContent || "") !== html;
    if (outdated) await brevo(env, "PUT", `/smtp/templates/${Number(existing.id)}`, wanted);
    return Number(existing.id);
  }
  const created = await brevo(env, "POST", "/smtp/templates", wanted);
  return Number(created.id);
}

function setupKey(origin: string) {
  return `${origin}/__cache/newsletter-brevo/v1?store=${encodeURIComponent(STORE.slug)}`;
}

async function getSetup(env: Env, origin: string, force = false): Promise<Setup> {
  if (!force && setupMemory && Date.now() - setupMemory.at < SETUP_TTL_MS) return setupMemory;
  const cache = (globalThis as any).caches?.default;
  if (!force && cache) {
    try {
      const hit = await cache.match(setupKey(origin));
      const value = hit ? ((await hit.json()) as Setup) : null;
      if (value?.listId && value?.templateId && Date.now() - value.at < SETUP_TTL_MS) return (setupMemory = value);
    } catch (_) {}
  }
  if (!setupInflight) {
    setupInflight = (async () => {
      const listId = await ensureList(env);
      const templateId = await ensureTemplate(env);
      const value: Setup = { listId, templateId, at: Date.now() };
      setupMemory = value;
      try {
        if (cache) await cache.put(setupKey(origin), new Response(JSON.stringify(value), { headers: { "content-type": "application/json", "cache-control": "public, max-age=21600" } }));
      } catch (_) {}
      return value;
    })().finally(() => { setupInflight = null; });
  }
  return setupInflight;
}

/** Basic per-IP limit: RATE_MAX signups per RATE_WINDOW_MS (isolate memory + Cache API). */
async function limited(request: Request): Promise<boolean> {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${STORE.slug}|${ip}`)));
  const id = Array.from(digest.slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
  const now = Date.now();
  const cache = (globalThis as any).caches?.default;
  const key = `${new URL(request.url).origin}/__rl/newsletter?k=${id}`;
  let list = (hits.get(id) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (cache) {
    try {
      const hit = await cache.match(key);
      const stored: number[] = hit ? await hit.json() : [];
      list = [...new Set([...list, ...stored.filter((t) => now - t < RATE_WINDOW_MS)])];
    } catch (_) {}
  }
  if (list.length >= RATE_MAX) return true;
  list.push(now);
  hits.set(id, list);
  if (hits.size > 5000) hits.clear();
  try {
    if (cache) await cache.put(key, new Response(JSON.stringify(list), { headers: { "content-type": "application/json", "cache-control": `public, max-age=${RATE_WINDOW_MS / 1000}` } }));
  } catch (_) {}
  return false;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const enabled = Boolean(context.env.BREVO_API_KEY);
  const url = new URL(context.request.url);
  if (!enabled || url.searchParams.get("setup") !== "1") return reply({ enabled, store: STORE.slug, provider: "brevo" });
  try {
    const setup = await getSetup(context.env, url.origin);
    return reply({ enabled, store: STORE.slug, provider: "brevo", list: LIST_NAME, listReady: setup.listId > 0, template: TEMPLATE_NAME, templateReady: setup.templateId > 0, sender: SENDER.email, redirectionUrl: REDIRECT_URL });
  } catch (error) {
    const e = error as BrevoError;
    return reply({ enabled, store: STORE.slug, provider: "brevo", ready: false, error: e?.message || "Brevo setup failed", code: e?.code || "" }, 502);
  }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;
  if (!env.BREVO_API_KEY) return reply({ ok: false, error: "Newsletter is not configured yet" }, 503);
  let body: any;
  try { body = await request.json(); } catch { return reply({ ok: false, error: "Invalid JSON" }, 400); }
  if (body?.website) return reply({ ok: true, pending: true }); // honeypot filled in: pretend success, do nothing
  const email = String(body?.email || "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return reply({ ok: false, error: "Invalid email" }, 400);
  if (body?.consent !== true) return reply({ ok: false, error: "Consent required" }, 400);
  if (await limited(request)) return reply({ ok: false, error: "Too many requests" }, 429);
  const origin = new URL(request.url).origin;
  const send = async (setup: Setup) => brevo(env, "POST", "/contacts/doubleOptinConfirmation", {
    email,
    includeListIds: [setup.listId],
    templateId: setup.templateId,
    redirectionUrl: REDIRECT_URL,
  });
  try {
    try {
      await send(await getSetup(env, origin));
    } catch (error) {
      // Cached list/template may have been deleted in Brevo: rebuild once and retry.
      if (error instanceof BrevoError && error.status === 400 && /document_not_found|not found/i.test(`${error.code} ${error.message}`)) {
        await send(await getSetup(env, origin, true));
      } else throw error;
    }
    return reply({ ok: true, pending: true });
  } catch (error) {
    const e = error as BrevoError;
    return reply({ ok: false, error: "Newsletter service unavailable", code: e?.code || "" }, 502);
  }
}

export function onRequest() {
  return reply({ ok: false, error: "Method not allowed" }, 405);
}
