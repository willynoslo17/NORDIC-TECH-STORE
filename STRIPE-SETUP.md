# Stripe setup for nordic-tech-store

Required Cloudflare Pages production environment variables (do not commit secrets):

- `STRIPE_SECRET_KEY` — live secret key starting with `sk_live_`
- `STRIPE_WEBHOOK_SECRET` — webhook signing secret from Stripe
- `MAKE_ORDERS_WEBHOOK` — Make.com / automation webhook URL

Stripe webhook endpoint URL after deploy:

`https://nordic-tech-store.pages.dev/api/stripe-webhook`

Subscribe at least to `checkout.session.completed`.

Checkout session API:

`POST /api/create-checkout-session`

## POD supplier APIs (Cloudflare Pages / Netlify env)

Free dashboard keys — no test/placeholder mode. Leave unset for empty POD catalogs; set for live API with local `[]` fallback:

- `PRINTIFY_API_TOKEN` — Printify personal access token (shop products). Optional `PRINTIFY_SHOP_ID` (default `28847802`).
- `GELATO_API_KEY` — Gelato API key (`X-API-KEY`). Optional `GELATO_STORE_ID` for priced ecommerce store products.
- `PRINTFUL_API_TOKEN` — Printful private/OAuth token. Optional `PRINTFUL_STORE_ID` (`X-PF-Store-Id`) for account-level tokens.

Catalog endpoints: `/api/printify-products`, `/api/gelato-products`, `/api/printful-products` (same live-with-local-fallback model as CJ).
Storefront keeps suppliers separate via switcher (CJ | Printify | Gelato | Printful); catalogs are never blended into one array.

