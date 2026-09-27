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

## Checkout v2 (shipping address, supplier IDs, paid-only webhook)

- Stripe Checkout collects a **shipping address** (NO/EEA, EU-27, GB, CH, US, CA, PE) and a **phone number**.
- Subscribe the webhook to `checkout.session.completed` **and** `checkout.session.async_payment_succeeded`.
  Only sessions with `payment_status = paid` and `metadata.store = nordic-tech-store` are forwarded to `MAKE_ORDERS_WEBHOOK`.
- Payload schema `nordic-order/v2`: per-line provider, sku, quantity and supplier IDs, `groups`, `providers`, `missing_ids`,
  `shipping`, `event_id` (deduplicate on it or on `stripe_session_id`). See `functions/_shared/order-payload.ts`.
- Prices are never taken from the browser: each line is priced from a server-signed catalog quote
  (key derived from `STRIPE_SECRET_KEY`) or from the bundled `catalog/*.json`. Anything else is rejected.
- CJ lines: the default variant `vid` is resolved at checkout with `CJ_API_KEY`. Stores without the key ask
  `https://nordic-beauty-perfumes.pages.dev/api/cj-variant`. If that fails, the line is listed in `missing_ids`.
- `/api/order` is retired (HTTP 410) and no longer posts to Make.

