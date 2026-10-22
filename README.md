# Have A Time Cafe

Static cafe frontend with a Node API for Supabase email/password accounts and Stripe Checkout.

## One-time live service setup

The frontend uses the existing Render API at `https://have-a-time-api.onrender.com`. In Render, open the `have-a-time-api` web service and add these environment variables. Keep secret values in Render only; never put them in `index.html`, Vercel variables for this static site, GitHub, or chat.

| Variable | Value |
| --- | --- |
| `FRONTEND_URL` | `https://cafe-theta-blush.vercel.app` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase publishable/anon key (safe for browser use) |
| `STRIPE_SECRET_KEY` | Stripe secret key; begin with `sk_test_` for test payments |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the webhook endpoint below |

The two Stripe variables enable payment. Configure Supabase separately for real user accounts; add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and (optionally) `SUPABASE_SERVICE_ROLE_KEY` if you want account login and a cafe-side orders table. The service role key is server-only.

If you configure Supabase, enable email/password and set the site URL and allowed redirect URL to `https://cafe-theta-blush.vercel.app`. Apply [`backend/orders.sql`](backend/orders.sql) in the Supabase SQL Editor to save successful payments in the cafe database. Do not create public access policies for the orders table. Without Supabase order storage, payments are still recorded in Stripe and can be viewed in its Dashboard.

In Stripe, add a webhook endpoint at `https://have-a-time-api.onrender.com/api/stripe/webhook` and subscribe it to `checkout.session.completed`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`. For launch, replace the test Stripe key with the live key and update the webhook secret for the live-mode endpoint.

The API builds with `npm --prefix backend install` and starts with `npm --prefix backend start`. The existing Vercel project can keep using the repository root as a static site; `index.html` is the frontend entry. Commit/push changes to `main` to trigger its connected GitHub deployments.

## Important

- Checkout uses Stripe-hosted payment pages and INR prices defined on the server in `backend/server.js`.
- Email receipts and payment processing are handled by Stripe. Confirm Supabase email delivery and Stripe receipt settings before taking customer orders.
- Successful payments are recorded by the Stripe webhook. A webhook delivery failure should be reviewed and retried in the Stripe dashboard.
- Real account and payment flows remain disabled until their respective service credentials and settings are configured.

