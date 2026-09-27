/**
 * TEMPORARY admin proxy for linking the storefront catalog to real Printify products (shop 28847802).
 * - Protected by a secret (?k=...) whose SHA-256 must match KEY_SHA256. The secret itself is not in the repo.
 * - The Printify token never leaves the server; responses are Printify's JSON bodies only.
 * - Allowlisted operations only. There is NO order creation (orders.json) and NO delete.
 * To be removed right after the catalog linking is done.
 */
const SHOP = "28847802";
const BASE = "https://api.printify.com/v1";
const KEY_SHA256 = "f406ad7900c960fb6ab8afec5508a26442a2d66e092bcd4d7614399f378773af";

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authorized(url: URL) {
  const key = url.searchParams.get("k") || "";
  if (key.length < 32) return false;
  const hex = await sha256Hex(key);
  let diff = hex.length ^ KEY_SHA256.length;
  for (let i = 0; i < Math.min(hex.length, KEY_SHA256.length); i++) diff |= hex.charCodeAt(i) ^ KEY_SHA256.charCodeAt(i);
  return diff === 0;
}

const CATALOG_PATH = /^(blueprints\.json|blueprints\/\d+\.json|blueprints\/\d+\/print_providers\.json|blueprints\/\d+\/print_providers\/\d+\/(variants|shipping)\.json|print_providers\.json|print_providers\/\d+\.json)$/;
const PRODUCT_ID = /^[0-9a-f]{24}$/;

async function forward(token: string, method: string, path: string, body?: string) {
  const response = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "NordicStore/1.0", ...(body ? { "content-type": "application/json" } : {}) },
    body,
  });
  const text = await response.text();
  return new Response(text, { status: response.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

export async function onRequest(context: any) {
  const url = new URL(context.request.url);
  if (!(await authorized(url))) return new Response("Not found", { status: 404 });
  const token = String(context.env.PRINTIFY_API_TOKEN || "");
  if (!token) return Response.json({ error: "token not configured" }, { status: 503 });
  const action = url.searchParams.get("action") || "";
  const method = context.request.method;
  if (method === "GET" && action === "list") {
    const page = Math.max(1, Math.min(100, Number(url.searchParams.get("page") || 1) | 0));
    return forward(token, "GET", `/shops/${SHOP}/products.json?limit=50&page=${page}`);
  }
  if (method === "GET" && action === "product") {
    const id = url.searchParams.get("id") || "";
    if (!PRODUCT_ID.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
    return forward(token, "GET", `/shops/${SHOP}/products/${id}.json`);
  }
  if (method === "GET" && action === "catalog") {
    const path = url.searchParams.get("path") || "";
    if (!CATALOG_PATH.test(path)) return Response.json({ error: "bad path" }, { status: 400 });
    return forward(token, "GET", `/catalog/${path}`);
  }
  if (method === "POST" && action === "upload") {
    const body = await context.request.text();
    return forward(token, "POST", "/uploads/images.json", body);
  }
  if (method === "POST" && action === "create") {
    const body = await context.request.text();
    return forward(token, "POST", `/shops/${SHOP}/products.json`, body);
  }
  if (method === "PUT" && action === "update") {
    const id = url.searchParams.get("id") || "";
    if (!PRODUCT_ID.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
    const body = await context.request.text();
    return forward(token, "PUT", `/shops/${SHOP}/products/${id}.json`, body);
  }
  if (method === "POST" && action === "shipping") {
    // Shipping cost calculation only (orders/shipping.json). This does not create an order.
    const body = await context.request.text();
    return forward(token, "POST", `/shops/${SHOP}/orders/shipping.json`, body);
  }
  return Response.json({ error: "unsupported" }, { status: 400 });
}
