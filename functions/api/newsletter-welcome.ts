/**
 * /api/newsletter-welcome?k=<sealed token> - redirect target after the Brevo double opt-in link has been clicked.
 * /api/newsletter puts a sealed token (e-mail + time, AES-GCM with a key derived from BREVO_API_KEY) in the
 * redirectionUrl. Here we check in Brevo that the address really is in "<Store> nyhetsbrev" (DOI confirmed), then send
 * welcome e-mail 1 at once and schedule 2 (+24 h) and 3 (+~72 h) via Brevo; e-mail 4 needs a Brevo automation.
 * The visitor is always redirected to /nyhetsbrev-bekreftet.html.
 */
import { startWelcome, unseal, type MktEnv } from "../_shared/brevo-marketing";

const TOKEN_MAX_AGE_MS = 30 * 24 * 3600 * 1000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function welcomeWithRetry(env: MktEnv, email: string) {
  // Brevo may need a moment to move the contact into the list after the DOI click.
  for (const wait of [0, 2000, 4000, 8000]) {
    if (wait) await sleep(wait);
    try {
      const result = await startWelcome(env, email);
      if (result.sent || result.reason === "already_sent") return;
    } catch (_) {}
  }
}

export async function onRequestGet(context: { request: Request; env: MktEnv; waitUntil?: (p: Promise<unknown>) => void }) {
  const { request, env } = context;
  const url = new URL(request.url);
  const target = new URL("/nyhetsbrev-bekreftet.html", url.origin).toString();
  if (env.BREVO_API_KEY) {
    const token = await unseal<{ e?: string; t?: number }>(env, "welcome", url.searchParams.get("k") || "");
    const email = String(token?.e || "").toLowerCase();
    if (email && Number(token?.t) > Date.now() - TOKEN_MAX_AGE_MS) {
      const job = welcomeWithRetry(env, email);
      if (context.waitUntil) context.waitUntil(job); else await job;
    }
  }
  return new Response(null, { status: 302, headers: { location: target, "cache-control": "no-store" } });
}
