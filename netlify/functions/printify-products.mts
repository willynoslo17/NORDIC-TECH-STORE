import LINKED from "../../functions/_shared/catalog-data/printify-selected.json";

/** Netlify mirror (Cloudflare Pages is the live host): serves ONLY rows linked to real products in Printify shop 28847802. */
const PRODUCT_ID = /^[0-9a-f]{24}$/;
export default async (req: Request) => {
  if (req.method !== "GET") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const products = (Array.isArray(LINKED) ? LINKED : []).filter(
    (p: any) => p && PRODUCT_ID.test(String(p.printifyProductId || "")) && /^\d+$/.test(String(p.printifyVariantId || "")) && Number(p.suggestedRetailUsd) > 0,
  );
  return Response.json(
    { ok: true, supplier: "printify", products, count: products.length, source: "printify-shop-linked", shopId: "28847802" },
    { status: products.length ? 200 : 503, headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=60" } },
  );
};
export const config = { path: "/api/printify-products" };
