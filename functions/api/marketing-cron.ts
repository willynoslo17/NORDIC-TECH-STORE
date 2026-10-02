/**
 * /api/marketing-cron - due follow-up e-mails (see ../_shared/marketing-followups.ts).
 *
 * GET                                   -> schedule only (no Brevo/Stripe calls).
 * POST ?job=welcome-4|purchase-3[&dry=1] with "authorization: Bearer <cron token>" -> runs one job; dry=1 only counts.
 * Called hourly by the account's "nordic-mkt-followups" cron Worker. Only the token's SHA-256 is stored here.
 * The reply holds counts only (no addresses).
 */
import { STORE } from "../_shared/store";
import type { MktEnv } from "../_shared/brevo-marketing";
import { runPurchase3, runWelcome4, WELCOME_4_AFTER_MS, PURCHASE_3_AFTER_MS, CATCH_UP_MS, FOLLOWUPS_SINCE } from "../_shared/marketing-followups";

const CRON_TOKEN_SHA256 = "55005b33d286a9cd0721b5634ab1ca11725aacd58fa8607ae5ba76e60049695d";
const noStore = { "cache-control": "no-store" };
const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: noStore });
const DAY = 24 * 3600 * 1000;
let running = false;

async function sha256(text: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function onRequestGet(context: { env: MktEnv }) {
  return reply({
    enabled: Boolean(context.env.BREVO_API_KEY), store: STORE.slug,
    schedule: {
      "welcome-4": `${WELCOME_4_AFTER_MS / DAY} days after welcome-1, newsletter subscribers only`,
      "purchase-2": "~3 days after the paid order (scheduled in Brevo at the purchase), order information",
      "purchase-3": `${PURCHASE_3_AFTER_MS / DAY} days after the paid order, newsletter subscribers only (copy with unsubscribe link)`,
      catchUpHours: CATCH_UP_MS / 3600000, since: new Date(FOLLOWUPS_SINCE).toISOString(),
    },
  });
}

export async function onRequestPost(context: { request: Request; env: MktEnv }) {
  const { request, env } = context;
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || token.length > 200 || (await sha256(token)) !== CRON_TOKEN_SHA256) return reply({ ok: false, error: "Forbidden" }, 403);
  if (!env.BREVO_API_KEY) return reply({ ok: false, error: "Not configured" }, 503);
  const url = new URL(request.url);
  const job = url.searchParams.get("job") || "";
  const dry = url.searchParams.get("dry") === "1";
  if (job !== "welcome-4" && job !== "purchase-3") return reply({ ok: false, error: "Unknown job" }, 400);
  if (running) return reply({ ok: true, job, busy: true });
  running = true;
  try {
    const result = job === "welcome-4" ? await runWelcome4(env, dry) : await runPurchase3(env, dry);
    return reply({ ok: true, store: STORE.slug, ...result });
  } catch (error) {
    return reply({ ok: false, store: STORE.slug, job, error: String((error as Error)?.message || "failed").slice(0, 120) }, 502);
  } finally { running = false; }
}

export function onRequest() {
  return reply({ ok: false, error: "Method not allowed" }, 405);
}
