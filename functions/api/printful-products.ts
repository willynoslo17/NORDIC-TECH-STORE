const BASE = "https://api.printful.com";

function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0;
}

function normalize(row: any, index: number) {
  const sync = row?.sync_product || row;
  const retail = money(sync?.retail_price || row?.retail_price);
  return {
    id: String(sync?.id || `printful-${index}`),
    sku: String(sync?.external_id || sync?.id || ""),
    supplier: "Printful",
    provider: "printful",
    name: String(sync?.name || "Printful product"),
    category: "Printful",
    supplierPriceUsd: retail,
    suggestedRetailUsd: retail,
    image: String(sync?.thumbnail_url || sync?.image || ""),
  };
}

export async function onRequestGet(context: any) {
  const token = context.env.PRINTFUL_API_TOKEN;
  if (!token) return Response.json({ error: "Printful is not configured", products: [] }, { status: 503 });
  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (context.env.PRINTFUL_STORE_ID) headers["X-PF-Store-Id"] = String(context.env.PRINTFUL_STORE_ID);
    const url = new URL(BASE + "/store/products");
    url.searchParams.set("limit", "20");
    url.searchParams.set("offset", "0");
    const response = await fetch(url, { headers });
    const result: any = await response.json();
    if (!response.ok) {
      return Response.json({ error: result?.error?.message || result?.result || "Printful product request failed", products: [] }, { status: 502 });
    }
    const list = Array.isArray(result?.result) ? result.result : [];
    const products = list.map(normalize).filter((p: any) => p.name).slice(0, 30);
    // Fetch detail for retail price when list lacks it
    const detailed = [];
    for (const product of products.slice(0, 20)) {
      try {
        const detailRes = await fetch(`${BASE}/store/products/${product.id}`, { headers });
        const detail: any = await detailRes.json();
        if (!detailRes.ok) { detailed.push(product); continue; }
        const variants = Array.isArray(detail?.result?.sync_variants) ? detail.result.sync_variants : [];
        const priced = variants.find((v: any) => money(v?.retail_price) > 0) || variants[0];
        const retail = money(priced?.retail_price);
        detailed.push({
          ...product,
          sku: String(priced?.sku || product.sku || ""),
          supplierPriceUsd: retail || product.supplierPriceUsd,
          suggestedRetailUsd: retail || product.suggestedRetailUsd,
          image: product.image || String(priced?.files?.find?.((f: any) => f?.type === "preview")?.preview_url || ""),
        });
      } catch (_) {
        detailed.push(product);
      }
    }
    return Response.json({
      ok: true,
      supplier: "printful",
      products: detailed.filter((p: any) => p.suggestedRetailUsd > 0).slice(0, 30),
      markets: ["NO", "EU", "PE"],
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Printful request failed", products: [] }, { status: 502 });
  }
}
