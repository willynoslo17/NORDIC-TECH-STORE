import { cjFreightOptions, validFreightRequest } from "../_shared/cj";
import { cheapestLogistic } from "../_shared/provider-orders";

/**
 * POST /api/cj-freight  {endCountryCode, zip?, products:[{vid, quantity}]}
 *   -> { ok, logisticName, logisticPrice, options:[{logisticName, logisticPrice, logisticAging}] }
 * Shipping methods from CJ freightCalculate (start country CN). Returns only public shipping options, never tokens.
 * Stores without their own CJ_API_KEY call this on the shared CJ store from the Stripe webhook.
 */
export async function onRequestPost(context: any) {
  const headers = { "access-control-allow-origin": "*" };
  if (!context.env.CJ_API_KEY) return Response.json({ ok: false, error: "CJ is not configured" }, { status: 503, headers });
  const body = await context.request.json().catch(() => null);
  const request = validFreightRequest(body);
  if (!request) return Response.json({ ok: false, error: "Invalid request" }, { status: 400, headers });
  try {
    const options = await cjFreightOptions(String(context.env.CJ_API_KEY), request);
    const best = cheapestLogistic(options);
    if (!best) return Response.json({ ok: false, error: "No shipping method" }, { status: 502, headers });
    return Response.json(
      {
        ok: true,
        logisticName: best.name,
        logisticPrice: best.price,
        options: options.slice(0, 30).map((o: any) => ({
          logisticName: String(o?.logisticName || ""),
          logisticPrice: Number(o?.logisticPrice),
          logisticAging: String(o?.logisticAging || ""),
        })),
      },
      { headers },
    );
  } catch {
    return Response.json({ ok: false, error: "CJ freight lookup failed" }, { status: 502, headers });
  }
}

export function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
