/**
 * /api/newsletter-unsubscribe - unsubscribe link in the welcome and abandoned-cart e-mails.
 * GET ?k=<sealed token> shows a confirmation button (so link scanners cannot unsubscribe anyone);
 * POST k=<token> removes the address from "<Store> nyhetsbrev" only (other stores/lists are untouched) and cancels
 * welcome/abandoned-cart e-mails already scheduled in Brevo. Without a valid token the page explains how to
 * unsubscribe by e-mail.
 */
import { STORE } from "../_shared/store";
import { unseal, unsubscribe, type MktEnv } from "../_shared/brevo-marketing";

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const mail = `kontakt@${STORE.domain}`;

function page(no: string, es: string, status = 200) {
  const html = `<!doctype html><html lang="nb"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${esc(STORE.brand)} | Nyhetsbrev</title><meta name="robots" content="noindex"><link rel="stylesheet" href="/legal.css">` +
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml"></head><body>` +
    `<header class="lg-nav"><a class="lg-brand" href="/">${esc(STORE.brand)}</a><a class="lg-back" href="/">← Tilbake til butikken · Volver a la tienda</a></header>` +
    `<main class="lg-main"><article id="no" lang="nb">${no}</article><article id="es" lang="es">${es}</article></main></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}

const noToken = () => page(
  `<h1>Meld deg av nyhetsbrevet</h1><p>Bruk lenken nederst i e-posten fra ${esc(STORE.brand)}, eller skriv til <a href="mailto:${mail}?subject=Avmelding">${mail}</a> med emnet «Avmelding», så melder vi deg av.</p>`,
  `<h1>Darse de baja del boletín</h1><p>Usa el enlace al final del correo de ${esc(STORE.brand)}, o escribe a <a href="mailto:${mail}?subject=Baja%20del%20bolet%C3%ADn">${mail}</a> con el asunto «Baja del boletín» y te daremos de baja.</p>`);

async function tokenEmail(env: MktEnv, k: string) {
  const t = await unseal<{ e?: string; d?: string }>(env, "unsub", k);
  return t?.e ? { email: String(t.e).toLowerCase(), day: String(t.d || "") } : null;
}

export async function onRequestGet(context: { request: Request; env: MktEnv }) {
  const k = new URL(context.request.url).searchParams.get("k") || "";
  if (!context.env.BREVO_API_KEY || !(await tokenEmail(context.env, k))) return noToken();
  const form = (label: string) => `<form method="post" action="/api/newsletter-unsubscribe"><input type="hidden" name="k" value="${esc(k)}"><button type="submit" style="padding:10px 18px;cursor:pointer">${label}</button></form>`;
  return page(
    `<h1>Meld deg av nyhetsbrevet fra ${esc(STORE.brand)}</h1><p>Trykk på knappen for å bekrefte. Du får ikke flere nyhetsbrev eller påminnelser fra ${esc(STORE.brand)}. Ordre- og kjøpsinformasjon sendes fortsatt ved kjøp.</p>${form("Meld meg av")}`,
    `<h1>Darse de baja del boletín de ${esc(STORE.brand)}</h1><p>Pulsa el botón para confirmar. No recibirás más boletines ni recordatorios de ${esc(STORE.brand)}. La información de pedidos se seguirá enviando cuando compres.</p>${form("Darme de baja")}`);
}

export async function onRequestPost(context: { request: Request; env: MktEnv }) {
  const { request, env } = context;
  let k = "";
  try { k = String((await request.formData()).get("k") || ""); } catch (_) {}
  const who = env.BREVO_API_KEY ? await tokenEmail(env, k) : null;
  if (!who) return noToken();
  try {
    await unsubscribe(env, who.email, who.day);
  } catch (_) {
    return page(`<h1>Noe gikk galt</h1><p>Prøv igjen senere, eller skriv til <a href="mailto:${mail}?subject=Avmelding">${mail}</a> med emnet «Avmelding».</p>`,
      `<h1>Algo salió mal</h1><p>Inténtalo más tarde o escribe a <a href="mailto:${mail}?subject=Baja%20del%20bolet%C3%ADn">${mail}</a> con el asunto «Baja del boletín».</p>`, 502);
  }
  return page(`<h1>Du er meldt av</h1><p>${esc(who.email)} får ikke lenger nyhetsbrev eller påminnelser fra ${esc(STORE.brand)}. Du kan melde deg på igjen når som helst nederst på nettsiden.</p><p><a href="/">Tilbake til butikken</a></p>`,
    `<h1>Te has dado de baja</h1><p>${esc(who.email)} ya no recibirá boletines ni recordatorios de ${esc(STORE.brand)}. Puedes volver a suscribirte cuando quieras al final de la web.</p><p><a href="/">Volver a la tienda</a></p>`);
}

export function onRequest() {
  return new Response("Method not allowed", { status: 405 });
}
