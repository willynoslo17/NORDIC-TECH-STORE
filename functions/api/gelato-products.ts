const PRODUCT_BASE = "https://product.gelatoapis.com";
const ECOM_BASE = "https://ecommerce.gelatoapis.com";

function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0;
}

function normalizeEcom(product: any, index: number) {
  const retail = money(
    product?.price?.basePrice ??
    product?.price?.amount ??
    product?.price ??
    product?.suggestedRetailUsd ??
    product?.retailPrice
  );
  return {
    id: String(product?.id || product?.productUid || `gelato-${index}`),
    sku: String(product?.sku || product?.productUid || product?.id || ""),
    supplier: "Gelato",
    provider: "gelato",
    name: String(product?.title || product?.name || "Gelato product"),
    category: String(product?.category || "Gelato"),
    supplierPriceUsd: retail,
    suggestedRetailUsd: retail,
    image: String(product?.previewUrl || product?.imageUrl || product?.image || product?.thumbnailUrl || ""),
  };
}

async function loadStoreProducts(headers: Record<string, string>, storeId: string) {
  const response = await fetch(`${ECOM_BASE}/v1/stores/${storeId}/products`, { headers });
  const result: any = await response.json().catch(() => ({}));
  if (!response.ok) return [];
  const list = Array.isArray(result?.products) ? result.products : Array.isArray(result) ? result : [];
  return list.map(normalizeEcom).filter((p: any) => p.suggestedRetailUsd > 0).slice(0, 30);
}

export async function onRequestGet(context: any) {
  const apiKey = context.env.GELATO_API_KEY;
  if (!apiKey) return Response.json({ error: "Gelato is not configured", products: [] }, { status: 503 });
  const headers = { "X-API-KEY": apiKey, "content-type": "application/json" };
  try {
    let storeId = context.env.GELATO_STORE_ID || "";
    if (!storeId) {
      const storesRes = await fetch(`${ECOM_BASE}/v1/stores`, { headers });
      if (storesRes.ok) {
        const stores: any = await storesRes.json();
        const list = Array.isArray(stores?.stores) ? stores.stores : Array.isArray(stores) ? stores : [];
        storeId = String(list[0]?.id || list[0]?.storeId || "");
      }
    }
    if (storeId) {
      const products = await loadStoreProducts(headers, storeId);
      return Response.json({ ok: true, supplier: "gelato", products, storeId, markets: ["NO", "EU", "PE"] });
    }

    // No ecommerce store: confirm API key by listing catalogs, but do not invent retail prices.
    const catalogsRes = await fetch(`${PRODUCT_BASE}/v3/catalogs`, { headers });
    if (!catalogsRes.ok) {
      const err: any = await catalogsRes.json().catch(() => ({}));
      return Response.json({ error: err?.message || "Gelato request failed", products: [] }, { status: 502 });
    }
    return Response.json({
      ok: true,
      supplier: "gelato",
      products: [],
      note: "API key valid. Add ecommerce store products in Gelato (or set GELATO_STORE_ID) for a live priced catalog.",
      markets: ["NO", "EU", "PE"],
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Gelato request failed", products: [] }, { status: 502 });
  }
}
