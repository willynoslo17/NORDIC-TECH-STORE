import { chooseOffer, configuredSuppliers, type Market, type SupplierOffer } from "./_shared/suppliers.mts";

const validMarkets = new Set<Market>(["NO", "EU", "PE"]);

export default async (request: Request) => {
  if (request.method === "GET") {
    return Response.json({
      ok: true,
      service: "ML Internasjonal supplier router",
      configured: configuredSuppliers(),
      markets: ["NO", "EU", "PE"],
    });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: { market?: Market; offers?: SupplierOffer[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.market || !validMarkets.has(body.market) || !Array.isArray(body.offers)) {
    return Response.json({ error: "market and offers are required" }, { status: 400 });
  }

  const selected = chooseOffer(body.market, body.offers);
  return Response.json({ selected, evaluated: body.offers.length });
};

export const config = {
  path: "/api/supplier-route",
};

