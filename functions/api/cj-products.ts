const BASE = "https://developers.cjdropshipping.com/api2.0/v1";
const TERMS = new Set(["electronics", "smart home", "computer accessories", "phone accessories", "wearable technology"]);

async function getToken(apiKey: string) {
  const response = await fetch(BASE + "/authentication/getAccessToken", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  const result: any = await response.json();
  if (!response.ok || !result?.data?.accessToken) {
    throw new Error(result?.message || "CJ authentication failed");
  }
  return result.data.accessToken as string;
}

export async function onRequestGet(context: any) {
  const apiKey = context.env.CJ_API_KEY;
  if (!apiKey) return Response.json({ error: "CJ is not configured" }, { status: 503 });
  const url = new URL(context.request.url);
  const wanted = (url.searchParams.get("q") || "electronics").toLowerCase();
  const query = TERMS.has(wanted) ? wanted : "electronics";
  try {
    const accessToken = await getToken(apiKey);
    const productsUrl = new URL(BASE + "/product/listV2");
    productsUrl.searchParams.set("page", "1");
    productsUrl.searchParams.set("size", "20");
    productsUrl.searchParams.set("keyWord", query);
    const response = await fetch(productsUrl, { headers: { "CJ-Access-Token": accessToken } });
    const result: any = await response.json();
    if (!response.ok || result?.success === false) {
      return Response.json({ error: result?.message || "CJ product request failed" }, { status: 502 });
    }
    return Response.json({ ok: true, supplier: "cj", sector: "technology", query, markets: ["NO", "EU", "PE"], data: result.data });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "CJ request failed" }, { status: 502 });
  }
}
