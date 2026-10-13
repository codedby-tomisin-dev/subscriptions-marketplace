# Bonbon backend

Firebase (Auth, Firestore, Python Cloud Functions) and Stripe test mode. The web app in `app/pwa` reads Firestore directly, with security rules deciding what each user can see. Every write goes through a Cloud Function.

## Run it locally

Local development uses the `subscription-business-511510` project id, but every service (Auth, Firestore, Functions) runs on the emulators, so no real data is touched. Start them with `npm run emulators` (it passes the project). The automated tests use a throwaway `demo-bonbon` project instead, which can't reach real services at all.

```bash
# once
cd cloud && npm install
cd functions && python3.13 -m venv venv && venv/bin/pip install -r requirements-dev.txt

# each time
cd cloud && npm run emulators                       # auth :9099, firestore :8080, functions :5001, UI :4000
cd cloud/functions && venv/bin/python scripts/seed_firestore.py --admin you@example.com   # boxes + demo data
cd app/pwa && npm run dev                           # .env.development points it at the emulators
```

**Signing in:** sign-in links aren't emailed by the emulator. They're printed in the emulator log and listed in the Emulator UI under Auth. Seeded customers can sign in with their own emails (e.g. `maya.o@gmail.com`). The `--admin` email can open `/admin`.

**`APP_BASE_URL`** (where Stripe sends customers back to) defaults to `http://localhost:3000`. Keep any emulator-only value in `functions/.env.local`, which is never deployed. Don't put it in `.env.subscription-business-511510`, which is.

**Ports taken?** Override the web app's emulator ports in `app/pwa/.env.development.local` (`NEXT_PUBLIC_*_EMULATOR_PORT`).

## Stripe (needed for checkout)

1. Put the keys in `functions/.env` (gitignored). Firebase loads it under the emulator and on deploy:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...   # printed by `stripe listen`
   ```
2. Create the products and prices: `venv/bin/python scripts/seed_stripe.py`. It's safe to re-run.
3. Forward webhooks: `stripe listen --forward-to localhost:5001/subscription-business-511510/us-central1/stripe_webhook`.
4. Pay with `4242 4242 4242 4242`.

Seeded subscriptions have no Stripe subscription behind them. Changing one skips the Stripe calls, so the account and admin screens work without keys.

## The catalog

Boxes live in Firestore (`boxes/{id}`) and are edited in the admin under **Boxes & stock**, with **New box** and **Edit**. Saving a box:
- validates it;
- creates inventory docs for new packing items, starting at 0 stock;
- if the price changed, creates a new Stripe price and moves the `{box}_{week|month}` lookup key to it. New subscribers pay the new price; existing ones keep theirs, which is recorded on each subscription as `pricePence`. With no Stripe key set, boxes still save and the prices just aren't synced.

Archiving takes a box off the storefront; existing subscriptions carry on. Photos upload to Storage under `boxes/`, which only admins can write (`storage.rules`). Storefront pages revalidate every minute, so edits appear within about a minute.

**Fresh project:** load the five starter boxes once with `venv/bin/python scripts/seed_catalog.py --live --project subscription-business-511510`. It skips boxes that already exist. `scripts/seed_stripe.py` creates their Stripe prices; boxes made in the admin sync their own.

## How billing works

- The first box is charged at checkout. Every later box is charged 3 days before it arrives: we set the Stripe subscription's `trial_end` to that charge time.
- Skip, pause, resume and cadence changes all just move that date. Stripe shows the subscriptions as "trialing" between charges; our `status` field is the truth.
- `invoice.paid` creates the order, marks that box as packed (`packedDelivery`) and moves the schedule on one delivery. It runs in one Firestore transaction keyed by the invoice id, so a webhook delivered twice creates one order.
- Cancelling sets `cancel_at_period_end`, so nothing more is charged, and a box already paid for still ships. Undo works until Stripe actually ends the subscription. After that, "Restart" starts a new Stripe subscription with the saved card.

## Layout

```
functions/
  core/            config (.env values/params), telemetry (Logfire), firestore client
  modules/
    shared/        handler decorators (traced_*), Document base, clock, errors
    catalog/       boxes in Firestore, editing (admin_save_box), Stripe price sync; starter_boxes.json
    subscriptions/ schedule + lifecycle (pure), repository, service, manage_subscription
    billing/       Stripe gateway, checkout, webhook, refunds
    customers/     customer docs and their subscription summary
    fulfilment/    orders, packing statuses, delivered sweep
    inventory/     stock vs next round, reorders
    analytics/     overview, churn, nightly snapshot
  scripts/         seed_firestore, seed_stripe, grant_admin
  tests/           pytest; emulator-backed tests skip without FIRESTORE_EMULATOR_HOST
firestore.rules    customers read their own docs, admins read everything, nobody writes
rules-tests/       rules tests against the emulator
```

## Tests

```bash
cd cloud && npm run test:functions   # pytest, including Firestore-backed service tests
cd cloud && npm run test:rules       # security rules
```

## Admins

The admin portal (`/admin`) is invite-only, with one exception: on a freshly provisioned project with no admins, the first person to sign in there becomes the first admin. Do that yourself right after deploying.

From then on, admins invite people by email on the **Team** page. An invited person signs in at `/admin` with that email's sign-in link and is let in. Admins can also cancel invites and remove members; nobody can remove themselves, and the last admin can't be removed.

How it works: `join_admin_team` (in `modules/team`) runs whenever a signed-in non-admin opens `/admin`. The "no admins yet?" check and invite use run in one Firestore transaction, so two people signing in at once can't both become the first admin. Access itself is the `role: "admin"` custom claim, checked by the Firestore rules and `traced_call(require_admin=True)`; `admins/{uid}` lists the team.

For local dev, `seed_firestore.py --admin you@example.com` (or `scripts/grant_admin.py`) adds someone directly, without an invite.
