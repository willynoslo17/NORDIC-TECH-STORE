/**
 * Follow-up e-mails that are due later than Brevo's ~72 h scheduling limit (see ./brevo-marketing.ts):
 *
 * - welcome-4      7 days after welcome e-mail 1 (marketing: confirmed newsletter subscribers only, unsubscribe link).
 * - purchase-3-nl  21 days after a paid order (review / feedback request, treated as marketing: confirmed newsletter
 *                  subscribers only, sent with the "(nyhetsbrev)" copy of purchase-3 that carries the unsubscribe link).
 *                  21 days ≈ 10 days after a typical delivery (5–20 business days), as the copy says.
 *
 * Post-purchase e-mail 2 ("the package is on its way", order information) is scheduled with Brevo at the purchase
 * itself, ~3 days later (startPostPurchase).
 *
 * These are run by POST /api/marketing-cron (hourly, from the account's "nordic-mkt-followups" cron Worker).
 * Durable sources only: Brevo's transactional log (who received welcome-1) and Stripe (paid Checkout Sessions of this
 * store). Each run looks at what became due in the last CATCH_UP_MS (so every address is seen by ~12 hourly runs);
 * dedup is Brevo's log of the follow-up template (30 days), checked right before sending. Nothing is sent for orders or
 * sign-ups before FOLLOWUPS_SINCE, refunded/disputed orders are skipped, and a run stops at MAX_CHECKS addresses
 * (Cloudflare allows 50 subrequests per request; each address costs up to 3 Brevo calls).
 */
import { STORE } from "./store";
import { brevo, ensureSetup, isSubscribed, sendTemplate, unsubscribeUrl, type MktEnv } from "./brevo-marketing";

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
export const WELCOME_4_AFTER_MS = 7 * DAY;
export const PURCHASE_3_AFTER_MS = 21 * DAY;
/** Window looked at by each (hourly) run: a follow-up is sent at most this long after it became due. */
export const CATCH_UP_MS = 12 * HOUR;
/** Follow-ups start with this release: earlier sign-ups/orders never got e-mail 1, so they get no late follow-up either. */
export const FOLLOWUPS_SINCE = Date.parse("2026-10-02T00:00:00Z");
const MAX_CHECKS = 10;
/** Addresses already handled by this isolate (saves Brevo calls on the next hourly runs; Brevo's log stays the real dedup). */
const handled = new Set<string>();

/** Dry-run probe only (never sends): look at everything since FOLLOWUPS_SINCE instead of what is due now. */
function windowFor(afterMs: number, dry: boolean, probe: boolean): [number, number] {
  if (dry && probe) return [FOLLOWUPS_SINCE, Date.now()];
  const to = Date.now() - afterMs;
  return [Math.max(FOLLOWUPS_SINCE, to - CATCH_UP_MS), to];
}

export type FollowupResult = { job: string; dry: boolean; candidates: number; checked: number; sent: number; skipped: Record<string, number>; errors: number };
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const bump = (r: FollowupResult, why: string) => { r.skipped[why] = (r.skipped[why] || 0) + 1; };

/** Addresses that received template `templateId` between fromMs and toMs (Brevo transactional log, oldest first). */
async function receivedBetween(env: MktEnv, templateId: number, fromMs: number, toMs: number): Promise<string[]> {
  const seen = new Set<string>();
  for (let offset = 0; offset < 2000; offset += 500) {
    const data = await brevo(env, "GET", `/smtp/emails?templateId=${templateId}&startDate=${day(fromMs)}&endDate=${day(toMs)}&limit=500&offset=${offset}&sort=asc`);
    const rows: any[] = Array.isArray(data?.transactionalEmails) ? data.transactionalEmails : [];
    for (const row of rows) {
      const at = Date.parse(String(row?.date || ""));
      const email = String(row?.email || "").trim().toLowerCase();
      if (email && at >= fromMs && at <= toMs && !String(row?.subject || "").startsWith("[TEST]")) seen.add(email);
    }
    if (rows.length < 500) break;
  }
  return [...seen];
}

/** Did this address get `templateId` in the last 30 days? Unlike alreadySent() a Brevo error throws (no send then). */
async function receivedRecently(env: MktEnv, templateId: number, email: string): Promise<boolean> {
  const data = await brevo(env, "GET", `/smtp/emails?email=${encodeURIComponent(email)}&templateId=${templateId}&startDate=${day(Date.now() - 30 * DAY)}&endDate=${day(Date.now())}&limit=1&sort=desc`);
  return Number(data?.count || 0) > 0 || (Array.isArray(data?.transactionalEmails) && data.transactionalEmails.length > 0);
}

/** welcome-4: 7 days after welcome-1. */
export async function runWelcome4(env: MktEnv, dry: boolean, probe = false): Promise<FollowupResult> {
  const r: FollowupResult = { job: "welcome-4", dry, candidates: 0, checked: 0, sent: 0, skipped: {}, errors: 0 };
  const setup = await ensureSetup(env);
  const w1 = setup.ids["welcome-1"], w4 = setup.ids["welcome-4"];
  if (!w1 || !w4) { bump(r, "template_missing"); return r; }
  const [from, to] = windowFor(WELCOME_4_AFTER_MS, dry, probe);
  if (from >= to) return r;
  const emails = await receivedBetween(env, w1, from, to);
  r.candidates = emails.length;
  for (const email of emails) {
    if (handled.has(`welcome-4|${email}`)) { bump(r, "already_sent"); continue; }
    if (r.checked >= MAX_CHECKS) { bump(r, "next_run"); continue; }
    r.checked++;
    try {
      if (!(await isSubscribed(env, setup, email))) { bump(r, "no_newsletter_consent"); continue; }
      if (await receivedRecently(env, w4, email)) { bump(r, "already_sent"); handled.add(`welcome-4|${email}`); continue; }
      if (dry) { bump(r, "would_send"); continue; }
      await sendTemplate(env, setup, "welcome-4", email, { unsubscribe_url: await unsubscribeUrl(env, email) });
      handled.add(`welcome-4|${email}`);
      r.sent++;
    } catch { r.errors++; }
  }
  return r;
}

type Session = { id?: string; created?: number; payment_status?: string; customer_email?: string; customer_details?: { email?: string }; metadata?: Record<string, string>; payment_intent?: any };

/** Paid Checkout Sessions of this store created between fromMs and toMs (refund state via the expanded charge). */
async function paidSessions(env: MktEnv, fromMs: number, toMs: number): Promise<Session[]> {
  const out: Session[] = [];
  let after = "";
  for (let page = 0; page < 5; page++) {
    const url = new URL("https://api.stripe.com/v1/checkout/sessions");
    url.searchParams.set("status", "complete");
    url.searchParams.set("created[gte]", String(Math.floor(fromMs / 1000)));
    url.searchParams.set("created[lte]", String(Math.floor(toMs / 1000)));
    url.searchParams.set("limit", "100");
    url.searchParams.append("expand[]", "data.payment_intent.latest_charge");
    if (after) url.searchParams.set("starting_after", after);
    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Stripe ${response.status}`);
    const body = (await response.json()) as { data?: Session[]; has_more?: boolean };
    const rows = Array.isArray(body.data) ? body.data : [];
    out.push(...rows.filter((s) => s?.metadata?.store === STORE.slug && s?.payment_status === "paid"));
    if (!body.has_more || !rows.length) break;
    after = String(rows[rows.length - 1].id || "");
  }
  return out.sort((a, b) => Number(a.created) - Number(b.created));
}

const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

/** purchase-3 (newsletter copy): 21 days after a paid order of this store. */
export async function runPurchase3(env: MktEnv, dry: boolean, probe = false): Promise<FollowupResult> {
  const r: FollowupResult = { job: "purchase-3", dry, candidates: 0, checked: 0, sent: 0, skipped: {}, errors: 0 };
  if (!env.STRIPE_SECRET_KEY) { bump(r, "stripe_not_configured"); return r; }
  const setup = await ensureSetup(env);
  const p3 = setup.ids["purchase-3-nl"];
  if (!p3) { bump(r, "template_missing"); return r; }
  const [from, to] = windowFor(PURCHASE_3_AFTER_MS, dry, probe);
  if (from >= to) return r;
  const sessions = await paidSessions(env, from, to);
  r.candidates = sessions.length;
  const seen = new Set<string>();
  for (const session of sessions) {
    const email = String(session?.customer_details?.email || session?.customer_email || "").trim().toLowerCase();
    if (!(email.length <= 254 && EMAIL.test(email))) { bump(r, "no_email"); continue; }
    if (seen.has(email)) { bump(r, "same_address"); continue; } // one review request per address and run
    seen.add(email);
    const charge = session?.payment_intent?.latest_charge;
    if (charge && typeof charge === "object" && (charge.refunded || Number(charge.amount_refunded) > 0 || charge.disputed)) { bump(r, "refunded"); continue; }
    if (handled.has(`purchase-3|${email}`)) { bump(r, "already_sent"); continue; }
    if (r.checked >= MAX_CHECKS) { bump(r, "next_run"); continue; }
    r.checked++;
    try {
      if (!(await isSubscribed(env, setup, email))) { bump(r, "no_newsletter_consent"); continue; }
      if (await receivedRecently(env, p3, email)) { bump(r, "already_sent"); handled.add(`purchase-3|${email}`); continue; }
      if (dry) { bump(r, "would_send"); continue; }
      const orderNumber = String(session?.metadata?.order_id || "").trim() || String(session.id || "").slice(-12);
      await sendTemplate(env, setup, "purchase-3-nl", email, { order_number: orderNumber, unsubscribe_url: await unsubscribeUrl(env, email) });
      handled.add(`purchase-3|${email}`);
      r.sent++;
    } catch { r.errors++; }
  }
  return r;
}
