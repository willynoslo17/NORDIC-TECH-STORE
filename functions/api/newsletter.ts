/**
 * POST /api/newsletter - newsletter signup with double opt-in (consent is never tied to a purchase).
 *
 * Body (JSON): { email, consent: true, lang: "nb" | "es", source?: string, website?: "" (honeypot) }
 * The address is NOT stored by this shop. It is handed to SendPulse (the processor named in /personvern) with
 * confirmation=force, so SendPulse sends the confirmation e-mail (template with the store's bokmål/Spanish text) and
 * only adds the address to the list after the link in it is clicked. Unsubscribe is handled by SendPulse's link.
 *
 * Until these Pages secrets are set the endpoint answers 503 and the storefront form stays disabled:
 *   SENDPULSE_CLIENT_ID, SENDPULSE_CLIENT_SECRET   (SendPulse > Settings > API)
 *   SENDPULSE_ADDRESS_BOOK_ID                      (mailing list for this store)
 *   SENDPULSE_SENDER_EMAIL                         (activated sender, e.g. kontakt@<domain>)
 *   SENDPULSE_CONFIRM_TEMPLATE_ID                  (approved confirmation e-mail with the store's NB/ES text)
 * GET /api/newsletter -> { enabled } lets the form enable itself once configured.
 */
import { STORE } from "../_shared/store";

type Env = {
  SENDPULSE_CLIENT_ID?: string;
  SENDPULSE_CLIENT_SECRET?: string;
  SENDPULSE_ADDRESS_BOOK_ID?: string;
  SENDPULSE_SENDER_EMAIL?: string;
  SENDPULSE_CONFIRM_TEMPLATE_ID?: string;
};

/** Version of the consent wording shown next to the checkbox (stored with the subscriber as documentation). */
export const CONSENT_VERSION = "2026-10-02";
const API = "https://api.sendpulse.com";
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
const headers = { "cache-control": "no-store" };

function configured(env: Env) {
  return Boolean(
    env.SENDPULSE_CLIENT_ID && env.SENDPULSE_CLIENT_SECRET && /^\d+$/.test(String(env.SENDPULSE_ADDRESS_BOOK_ID || "")) &&
      env.SENDPULSE_SENDER_EMAIL && env.SENDPULSE_CONFIRM_TEMPLATE_ID,
  );
}

function reply(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers });
}

export async function onRequestGet(context: { env: Env }) {
  return reply({ enabled: configured(context.env), store: STORE.slug });
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;
  if (!configured(env)) return reply({ ok: false, error: "Newsletter is not configured yet" }, 503);
  let body: any;
  try { body = await request.json(); } catch { return reply({ ok: false, error: "Invalid JSON" }, 400); }
  if (body?.website) return reply({ ok: true, pending: true }); // honeypot: pretend success, do nothing
  const email = String(body?.email || "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return reply({ ok: false, error: "Invalid email" }, 400);
  if (body?.consent !== true) return reply({ ok: false, error: "Consent required" }, 400);
  const lang = body?.lang === "es" ? "es" : "nb";

  const auth = await fetch(`${API}/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: env.SENDPULSE_CLIENT_ID, client_secret: env.SENDPULSE_CLIENT_SECRET }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  const token = auth && auth.ok ? String(((await auth.json().catch(() => ({}))) as any).access_token || "") : "";
  if (!token) return reply({ ok: false, error: "Newsletter service unavailable" }, 502);

  const added = await fetch(`${API}/addressbooks/${env.SENDPULSE_ADDRESS_BOOK_ID}/emails`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      emails: [{
        email,
        variables: {
          store: STORE.brand,
          lang,
          consent_version: CONSENT_VERSION,
          consent_at: new Date().toISOString(),
          source: String(body?.source || "footer").slice(0, 40),
        },
      }],
      confirmation: "force",
      sender_email: env.SENDPULSE_SENDER_EMAIL,
      template_id: env.SENDPULSE_CONFIRM_TEMPLATE_ID,
      message_lang: lang === "es" ? "es" : "en",
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!added || !added.ok) return reply({ ok: false, error: "Newsletter service unavailable" }, 502);
  return reply({ ok: true, pending: true });
}

export function onRequest() {
  return reply({ ok: false, error: "Method not allowed" }, 405);
}
