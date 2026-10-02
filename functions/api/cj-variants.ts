import { verifyQuote, signQuote } from "../_shared/quote";
import { retailNokFromCost } from "../_shared/pricing";
import { validPid } from "../_shared/cj";
import { listCjVariants, optionNameNb, optionValueNb } from "../_shared/cj-variants";

/**
 * GET /api/cj-variants?quote=<signed product quote from /api/cj-products>
 * -> { ok, options: [{ name, values }], variants: [{ vid, label, values, image, priceNok, quote }] }
 * The product quote proves the store lists that CJ product (only those pids can be looked up). Each variant gets its
 * own encrypted quote (cost of THAT variant, cj_pid + cj_vid), so Stripe charges the price shown for the chosen size /
 * colour (cost x 2.5, min 99, ending in 9; see ../_shared/pricing) and the order goes to CJ with that vid.
 * No supplier cost, SKU or supplier name is returned.
 */
export async function onRequestGet(context: any) {
  const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  const token = new URL(context.request.url).searchParams.get("quote") || "";
  const quote = await verifyQuote(context.env, token);
  const pid = String(quote?.x?.cj_pid || quote?.r || "");
  if (!quote || String(quote.p).toLowerCase() !== "cj" || !validPid(pid)) {
    return Response.json({ ok: false, error: "Invalid product" }, { status: 400, headers });
  }
  const list = await listCjVariants(pid, context.env);
  if (!list || !list.variants.length) {
    return Response.json({ ok: true, single: true, options: [], variants: [] }, { headers });
  }
  const baseName = String(quote.n || "Produkt").replace(/\s+–\s+.*$/, "");
  const options = list.optionNames.map((name, i) => ({
    name: optionNameNb(name),
    values: [...new Set(list.variants.map((v) => optionValueNb(v.values[i] || "")))].filter(Boolean),
  }));
  const variants = await Promise.all(list.variants.map(async (v) => {
    const values = options.map((_, i) => optionValueNb(v.values[i] || ""));
    // Label from the options the customer actually chooses between (single-value options, e.g. "Som bildet", omitted).
    const chosen = values.filter((val, i) => val && options[i].values.length > 1);
    const label = (chosen.length ? chosen : values.filter(Boolean)).join(" / ");
    const name = `${baseName} – ${label}`.slice(0, 200);
    const signed = await signQuote(context.env, { provider: "cj", ref: pid, sku: v.sku, name, cost: v.costUsd, ids: { cj_pid: pid, cj_vid: v.vid } });
    return { vid: v.vid, label, values, image: v.image, priceNok: retailNokFromCost(v.costUsd), quote: signed };
  }));
  const usable = variants.filter((v) => v.quote && v.priceNok > 0);
  return Response.json({ ok: true, single: usable.length <= 1, options, variants: usable }, { headers });
}

export function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
