const BASE = "https://api.printify.com/v1";
function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0;
}
function normalize(product: any, index: number) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const enabled = variants.find((v: any) => v?.is_enabled !== false) || variants[0] || {};
  const images = Array.isArray(product?.images) ? product.images : [];
  const image = images.find((img: any) => img?.is_default)?.src || images[0]?.src || "";
  const cost = money(enabled.cost);
  const retail = money(enabled.price) || (cost > 0 ? Math.round(cost * 2.2 * 100) / 100 : 0);
  return {
    id: String(product?.id || `printify-${index}`),
    sku: String(enabled.sku || product?.id || ""),
    supplier: "Printify",
    provider: "printify",
    printifyProductId: String(product?.id || ""),
    printifyVariantId: String(enabled.id || ""),
    name: String(product?.title || "Printify product"),
    category: String(product?.tags?.[0] || "Printify"),
    supplierPriceUsd: cost || retail,
    suggestedRetailUsd: retail,
    image,
  };
}
export default async (req: Request) => {
  if (req.method !== "GET") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const token = Netlify.env.get("PRINTIFY_API_TOKEN");
  if (!token) return Response.json({ error: "Printify is not configured", products: [] }, { status: 503 });
  const shopId = Netlify.env.get("PRINTIFY_SHOP_ID") || "28847802";
  try {
    const url = new URL(BASE + `/shops/${shopId}/products.json`);
    url.searchParams.set("limit", "50");
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "User-Agent": "NordicStore/1.0" } });
    const result: any = await response.json();
    if (!response.ok) return Response.json({ error: result?.message || "Printify product request failed", products: [] }, { status: 502 });
    const list = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
    const products = list.map(normalize).filter((p: any) => p.suggestedRetailUsd > 0).slice(0, 30);
    return Response.json({ ok: true, supplier: "printify", products, markets: ["NO", "EU", "PE"] });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Printify request failed", products: [] }, { status: 502 });
  }
};
export const config = { path: "/api/printify-products" };
