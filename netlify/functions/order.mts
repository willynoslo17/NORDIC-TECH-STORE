/**
 * Retired order-draft endpoint. It used to relay unauthenticated requests to MAKE_ORDERS_WEBHOOK.
 * Orders now reach Make only from the signed, paid-only Stripe webhook.
 */
export default async () =>
  Response.json(
    { error: "Orders are accepted only through Stripe Checkout (/api/create-checkout-session)." },
    { status: 410 },
  );

export const config = { path: "/api/order" };
