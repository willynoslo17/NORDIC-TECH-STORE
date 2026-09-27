import { resolveCjVariant, validPid } from "../_shared/cj";

/**
 * GET /api/cj-variant?pid=<CJ product id> -> { ok, pid, vid, sku, source }
 * Returns only the public variant id/SKU (never tokens). Stores without their own CJ_API_KEY
 * use this on the shared CJ store during checkout.
 */
export async function onRequestGet(context: any) {
  const pid = new URL(context.request.url).searchParams.get("pid") || "";
  const headers = { "access-control-allow-origin": "*" };
  if (!validPid(pid)) return Response.json({ ok: false, error: "Invalid pid" }, { status: 400, headers });
  if (!context.env.CJ_API_KEY) return Response.json({ ok: false, error: "CJ is not configured" }, { status: 503, headers });
  const variant = await resolveCjVariant(pid, context.env, { allowFallback: false });
  if (!variant) return Response.json({ ok: false, pid, error: "Variant not found" }, { status: 502, headers });
  return Response.json(
    { ok: true, pid, vid: variant.vid, sku: variant.sku, source: variant.source },
    { headers: { ...headers, "cache-control": "public, max-age=86400" } },
  );
}

export function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
