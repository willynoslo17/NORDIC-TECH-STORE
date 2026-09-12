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
