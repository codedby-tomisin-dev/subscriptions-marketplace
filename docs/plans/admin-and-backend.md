# Plan: Bonbon admin dashboard + real backend

## Context

The storefront (`app/pwa`) is built, but it runs entirely on the client: subscriptions live in `localStorage` (`src/features/subscriptions/storage.ts`), orders and the member ("Maya") are hard-coded demo data, there's no sign-in and no payment. The design project also has an ops dashboard, **Bonbon Admin.html**, with five screens: Overview, Packing queue, Subscribers, Boxes & stock and Cancellations. It assumes real subscribers, Stripe billing, orders moving through packing, stock levels and cancellation analytics.

**Goal:** replace the client-only data with a Firebase + Stripe backend that serves both the customer storefront and a new `/admin` dashboard, so one source of truth drives both.

**Decisions already made:**
- Stripe in test mode, using Checkout plus Billing subscriptions.
- Customers sign in with an email magic link (Firebase passwordless).
- The admin lives at `/admin` in the same Next.js app, guarded by an `admin` role claim.
- Royal Mail labels and stock reorders only **record state**; no carrier or supplier APIs.

- **Currency: GBP (£).** Stripe prices are created in `gbp`. The storefront and admin switch every price from `$` to `£`, including the copy in `features/catalog/data.ts` (“Worth $100+ every month”), the price and cadence displays, and `CADENCE_COPY` users. Add a single `formatPrice(pence)` helper in `src/shared/utils/` and use it instead of hard-coded `$` signs. Python stores amounts as `*_pence` instead of `*_cents`.
- **Tracking:** no GitHub issues for now, because `origin` points at the starter template. Work goes on a local feature branch with a commit per milestone; open issues once this project has its own repo.

---

## Architecture in one picture

```
Next.js (storefront + /admin)
  ├─ reads:  Firestore client SDK, rules-protected
  │          customers see their own docs; admins see everything
  ├─ writes: callable Cloud Functions only — the client never writes Firestore
  └─ checkout: callable → Stripe Checkout redirect

Cloud Functions (Python, cloud/functions/modules/*)
  ├─ callables:  customer actions + admin actions, via traced_call
  ├─ webhook:    stripe_webhook (on_request), signature-verified, idempotent
  └─ schedules:  nightly metrics snapshot; daily "shipped → delivered" sweep

Stripe: Products and Prices (lookup keys), Customers, Subscriptions, Invoices
```

**Read/write rule:** plain lists are read directly from Firestore, which also makes them live. All writes, and anything computed (KPIs, stock needed, churn), go through callables. Writes must keep Stripe in sync, so they can't be client writes.

### The billing ↔ delivery rule (the core design decision)

Each box is charged **3 days before its delivery date**, which matches the existing `upcomingDeliveryDates` lead time. We control the next charge by setting the Stripe subscription's `trial_end` to `nextDelivery − 3 days`, with `proration_behavior: none`.

That gives one mechanism for every schedule change. Skip, pause, resume and switching weekly/monthly all recompute `nextDelivery` and then push `trial_end`. The cycle:

1. `invoice.paid` → create the order for `nextDelivery`.
2. Advance `nextDelivery` by one cadence.
3. Push the new `trial_end`.

This trade-off goes in the subscriptions README: Stripe will show these subscriptions as "trialing" between charges, and our own `status` field is the truth.

Consequences:
- **Cancel** uses `cancel_at_period_end`. "Undo" clears it, and stays possible until the next charge date.
- **"Your box is already packed, it's still coming"** only appears when an order already exists for `nextDelivery` (it's already been charged). Otherwise the copy says nothing else will be charged or sent. This is more accurate than today's local logic.
- **Restart** creates a new Stripe subscription with the saved payment method. If that card fails, the customer is sent back through Checkout.

---

## Data model (Firestore)

| Collection | Key fields | Who reads it |
|---|---|---|
| `customers/{uid}` | name, email, city, shipping address, stripeCustomerId, memberSince, ltvPence, plus summaries kept in sync on every change: `subscriptionSummary[]` (boxId, cadence, status), `nextDelivery`, `overallStatus` | owner, admin |
| `subscriptions/{id}` | customerId, boxId, cadence, status (active/paused/cancelled/past_due), nextDelivery, resumesOn, endedOn, finalDelivery, cancelAt, isGift, stripeSubscriptionId, monthlyValuePence (weekly × 52/12) | owner, admin |
| `orders/{BB-xxxxx}` | customerId, customerName and city (copied in for the packing queue), subscriptionId, boxId, cadence, isGift, deliveryDate, shipDate (delivery − 2 days), status (topack/packed/labelled/shipped/delivered/refunded), pricePence, stripeInvoiceId, placedOn | owner, admin |
| `events/{id}` | customerId, subscriptionId, type (created, cadence_changed, skipped, unskipped, paused, resumed, cancel_started, cancel_reason, retention_paused, retention_monthly, cancelled, cancel_undone, restarted, payment_paid, payment_failed, refunded, delivered), actor (customer/admin uid), data, at | admin |
| `payments/{invoiceId}` | customerId, subscriptionId, amountPence, status (paid/failed/refunded), attemptCount, nextRetryAt | admin |
| `inventory/{itemId}` | boxId, name, stock, usedIn (`["week","month"]`) | admin |
| `reorders/{id}` | itemId, quantity, status `draft`, createdBy, createdAt | admin |
| `metrics_snapshots/{YYYY-MM-DD}` | activeSubs, mrrPence, churnRate, cadence counts | admin |
| `counters/orders`, `stripe_events/{eventId}` | order-number sequence; webhook idempotency | functions only |

The events log is the single source for the subscriber drawer's "Recent activity", the cancellation reasons and save rate, and an audit trail of admin actions.

**Indexes** (`cloud/firestore.indexes.json`):
- `subscriptions(customerId, createdAt desc)`
- `subscriptions(status, nextDelivery)`
- `orders(customerId, placedOn desc)`
- `orders(shipDate, status)`
- `events(customerId, at desc)`
- `events(type, at desc)`

---

## Backend: `cloud/functions`

Follow the existing domain-first layout. Each module has `models.py`, a repository built on `modules/shared/repository.py` `BaseRepository` where it fits, `service.py` for logic, and `handlers.py`, which `utils.discover_handlers` picks up automatically. Keep logic pure and unit-testable, and keep all I/O (Firestore, Stripe) behind repositories or gateways passed into services, per `.agent/rules/python_coding_standards.md`.

### Foundations
- **`core/telemetry.py`** and **`modules/shared/handler_context.py`**: these are required by `.agent/rules/observability_standards.md` but don't exist yet. Create them:
  - `setup_telemetry()`, `get_logger`, `event`, `run_scope`, `context` and `span` in telemetry.
  - `traced_call`, `traced_request`, `traced_schedule` and `traced_firestore` in handler_context.
  - Extend `traced_call` with `require_admin=True`, which checks `req.auth.token.get("role") == "admin"`.
  - Call `setup_telemetry()` from `main.py`, with `send_to_logfire=False` under the emulator.
  - Add `logfire` to `requirements.txt` and delete the unused `core/logger.py`.
- **`core/config.py`**: the one config module. Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) and `APP_BASE_URL` come from `functions/.env` (no Firebase secrets). Add `stripe` to `requirements.txt`.
- **`main.py`**: fix the emulator block, which hard-codes `"your-project-id"`, so it uses the emulator's project env.
- **`modules/shared/base.py`**: `BaseCRUDHandler` gives anyone CRUD over a collection. **Don't register it for any of these collections.** Every endpoint below is a purpose-built callable.

### Modules
1. **`modules/catalog/catalog.py`**: box ids, prices in pence for each cadence, Stripe lookup keys (`datenight_week`, …) and inventory recipes. No handlers.
2. **`modules/subscriptions/`**
   - `schedule.py` (pure): a Python port of `app/pwa/src/shared/utils/dates.ts` (`upcoming_delivery_dates`, `add_months` with clamping) and `src/features/subscriptions/lifecycle.ts` (skip, pause → 1st of the month two months out, resume, cancel, restart), plus `billing_date_for(delivery)`.
   - `service.py`: runs each action:
     1. Check ownership: `sub.customerId == uid`, or the caller is an admin.
     2. Apply the schedule logic.
     3. Push `trial_end` or the cancel setting to Stripe through the billing gateway.
     4. Write the subscription, the customer summary and an event together in one batch.
   - Handler `manage_subscription` (`traced_call`), with actions `change_cadence`, `skip_next`, `unskip`, `pause`, `resume`, `cancel` (with optional reason), `undo_cancel`, `restart` and `record_retention` (pause or monthly). Customers and admins use the same handler; the event records who acted.
3. **`modules/billing/`**
   - `stripe_gateway.py`: a thin wrapper around the Stripe calls. It's the only file that imports `stripe`, so tests can swap in a fake.
   - Callable `create_checkout_session(boxId, cadence, firstDelivery, isGift)`:
     - Rejects a `firstDelivery` that isn't in `upcoming_delivery_dates(today)`.
     - Resolves the price by lookup key on the server and never trusts a price from the client.
     - Creates the Checkout session with `mode=subscription`, shipping address collection and metadata, and returns its URL.
   - `stripe_webhook` (`traced_request`): verifies the signature, then skips events already recorded in `stripe_events/{id}`.
     - `checkout.session.completed` → write the customer's name, city and address, create the subscription, set the first `trial_end`.
     - `invoice.paid` → record the payment, create the order with the next number from `counters/orders` in a transaction, add to `ltvPence`, advance the schedule.
     - `invoice.payment_failed` → record the failed payment.
     - `customer.subscription.updated` / `deleted` → sync status (`past_due`, `cancelled`).
   - Callable `admin_refund_order(orderNumber)` (admin only): refunds through Stripe, then marks the order and payment refunded and logs an event.
4. **`modules/fulfilment/`**
   - `orders.py` (pure): allowed status moves are topack → packed → labelled → shipped → delivered; refunded is allowed from any status before shipped.
   - Callable `admin_update_order_status(orderNumbers[], status)`: one batch write. Marking orders **packed** subtracts stock using the catalog recipe for each order's cadence.
   - Scheduled `mark_delivered_orders` (`traced_schedule`, daily): shipped orders whose delivery date has passed become delivered.
5. **`modules/inventory/`**
   - Callable `admin_get_stock()`: per box, stock vs. **needed for next round**. Needed = orders still to pack for that box, plus active subscriptions with `nextDelivery` in the next 7 days, multiplied by recipe usage. Also returns weekly/monthly subscriber counts.
   - Callable `admin_create_reorder(itemId)`: drafts a reorder of `need × 2 − stock`.
6. **`modules/analytics/`**
   - `metrics.py` (pure): monthly recurring revenue, churn rate, weekly/monthly split, reason shares, save rate (stayed by pausing / stayed by going monthly / cancelled anyway).
   - Callable `admin_get_overview()`: live numbers from Firestore `count()`/`sum()` aggregations, compared against the snapshot from about 30 days ago. Also returns:
     - **Shipping this week**: orders per ship date, with how many have shipped.
     - **Monthly recurring revenue by box.**
     - **Needs your attention**: items below the next round's need, and payments that failed in the last 24h.
   - Callable `admin_get_churn()`: last 30 days of reasons, save rate and recent cancellations.
   - Scheduled `snapshot_daily_metrics` (`traced_schedule`).

### Security
- **`cloud/firestore.rules`**: replace the expired allow-everything rule.
  - Customers can read only documents where `customerId == request.auth.uid`, plus their own `customers/{uid}`.
  - Admins (`request.auth.token.role == 'admin'`) can read every collection.
  - **No client writes anywhere.**
- **`cloud/firebase.json`**: add the `firestore` rules and indexes, plus emulators for auth (9099), firestore (8080), functions (5001) and the UI.
- **Admin access:** `cloud/functions/scripts/grant_admin.py <email>` sets the `role: admin` custom claim.

### Seed and dev tooling (`cloud/functions/scripts/`)
- `seed_stripe.py`: creates the Stripe test-mode products and prices by lookup key, and is safe to re-run.
- `seed_firestore.py`: loads inventory and the design's demo subscribers, orders, events and payments into the emulator so the admin looks real (data from `admin-data.js`, which matches today's account demo data).
- Developer README: run the emulators and `stripe listen --forward-to localhost:5001/<project>/us-central1/stripe_webhook`.

---

## Frontend: `app/pwa`

### Shared plumbing
- **Route groups:**
  - Move the storefront pages into `app/(storefront)/`, with a layout holding `SiteHeader`/`SiteFooter`.
  - Add `app/admin/` with its own layout (`AdminShell`).
  - The root `app/layout.tsx` keeps only fonts and `AppProviders`.
- **`src/shared/api/firebase.ts`**: connect to the emulators only when `NEXT_PUBLIC_USE_EMULATORS=true`, not on every dev run.
- **New `src/shared/api/functions.ts`**: a typed `callFunction<Req, Res>(name, data)` wrapper around `httpsCallable`.
- **New design-system components in `src/components/ui/`:**
  - `Input` (with a left icon) and `Checkbox`, ported from the design system bundle.
  - `Drawer`: the right-hand panel from the admin design, with a scrim, Escape to close, and a portal like `Dialog.tsx`.
  - A `soft` variant in `Button.module.css`, used by the Reorder button.

### `src/features/auth/` (new)
- `AuthProvider` + `useAuth()`: wraps `onAuthStateChanged` and exposes `user`, `isAdmin` (from `getIdTokenResult` claims), `isLoading` and `signOut`.
- `SignInDialog`: an email field that calls `sendSignInLinkToEmail`. The email goes in sessionStorage through a small `storage.ts`, keeping storage access in one place as the React rules require.
- `app/(storefront)/auth/complete/page.tsx`: finishes the sign-in link, then returns the customer to where they started.
- Header: the account icon opens sign-in when signed out.

### Storefront changes
- **`features/subscriptions`**:
  - Replace `storage.ts` and `demoData.ts` with `api.ts`: an `onSnapshot` listener on `subscriptions where customerId == uid`, plus callables for each action.
  - `SubscriptionsProvider` keeps its shape (`subscriptions`) and gains `isLoading`. `addSubscription`, `updateSubscription` and `restoreSubscription` become async calls to the server.
  - `lifecycle.ts` keeps only what the UI needs for wording (e.g. `pauseResumeDate`). The server makes every real decision.
- **`features/box-detail/hooks/useStartSubscription.ts`**:
  - On "Start my subscription": if signed out, open the sign-in dialog and remember the box, cadence, first-delivery date and gift choice in sessionStorage so they survive the email link.
  - Then call `create_checkout_session` and redirect to Stripe.
  - The success URL is `/boxes/{id}?checkout={sessionId}`. On return, wait for the new subscription to arrive through the listener, then show the existing `SubscriptionStartedDialog`.
- **`features/account`**:
  - `useSubscriptionActions` calls `manage_subscription`. Undo calls the matching inverse action (`unskip` / `undo_cancel`).
  - Cancel-dialog retention clicks call `record_retention`.
  - Add `useOrders()` (listener on the customer's orders) and use the greeting name from `customers/{uid}`.
  - Delete `demoData.ts`.
  - Add a signed-out state.

### `src/features/admin/` (new)

**Pages:** `app/admin/page.tsx` (Overview), `admin/packing`, `admin/subscribers`, `admin/stock`, `admin/cancellations`.

**Guard:** `AdminShell` shows a "no access" panel unless `isAdmin`. This is only for the interface; the security comes from the Firestore rules and `require_admin`.

**Shared admin components** (`features/admin/shared/`):
- `AdminShell`: sidebar nav with live counts for the packing queue and subscribers, a "View storefront" link and the signed-in admin's card.
- `AdminPageHeader`, `AdminPanel`, `AdminBadge` (statuses to pack / packed / label printed / shipped / active / paused / cancelled), `BoxDot`, `ProgressBar`.
- Table styles ported from `.ad-table`.
- A `downloadCsv(rows, filename)` helper in `src/shared/utils/` for the Export buttons.

**Screens.** Each has a container plus a hook, following `.agent/rules/react_coding_standards.md`:

| Screen | Data | Actions |
|---|---|---|
| Overview | `useOverview()` → `admin_get_overview` | Export CSV; "Open packing queue". Attention-list buttons link to the stock and subscriber screens. |
| Packing queue | `usePackingQueue(shipDate)`: live listener on `orders where shipDate == d` | Day tabs, stage filter cards, search; multi-select then Mark packed / Print labels (→ labelled) / Mark shipped via `admin_update_order_status`; a printable packing-slips page (`admin/packing/slips?date=`, prices hidden on gifts) |
| Subscribers | listener on `customers` (all of them; filter and search in the browser — fine up to roughly 5k) | Detail drawer: events and payments, plus skip / pause / resume / cancel through `manage_subscription`, with a confirm dialog and undo; refund through `admin_refund_order`; email via `mailto:`; Export CSV |
| Boxes & stock | `admin_get_stock` | Reorder → `admin_create_reorder` |
| Cancellations | `admin_get_churn` | read-only |

Load the `dataviz` skill before building the Overview and Cancellations bars, then match the design's simple CSS bars.

**Not in this phase:** these controls are hidden rather than left doing nothing.
- "New box": the catalog copy stays in code.
- The Settings cog.
- Royal Mail delivery exceptions: nothing produces them without a carrier integration.
- Live chat.

---

## Delivery (per the `change-management` skill)

0. Commit the uncommitted storefront work on a local feature branch (`feature/admin-backend`). Skip GitHub issues until the project has its own repo.
   Also in this step: switch the storefront to £ with `formatPrice`.
1. **Foundations:** telemetry and handler context, config, emulators, rules, pytest setup, route groups, auth (magic link), and `callFunction`.
2. **Billing and subscriptions:** catalog, the schedule port, the Stripe gateway, checkout, webhook, `manage_subscription`, and the storefront switched to Firestore with checkout.
3. **Fulfilment:** order numbering, order status moves, the customer orders tab, and the admin packing queue with packing slips.
4. **Admin:** the shell, Subscribers (with drawer and refunds), Boxes & stock, Cancellations, Overview, the metrics snapshot, and seed scripts.

Commit at least once per milestone; each milestone builds and passes its tests on its own.

---

## Verification

**Backend unit tests**: add `pytest` with `cloud/functions/tests/`. Fake the Stripe gateway and repositories.
- `schedule.py`: lead days, weekend skipping, month clamping, pause date, billing date.
- `metrics.py`: monthly recurring revenue with weekly normalisation, churn rate, save rate, reason shares.
- `orders.py`: allowed status moves, and stock subtracted on packed.
- Webhook mapping: `invoice.paid` creates exactly one order even when the same event is delivered twice.
- Price drift: compare `catalog.py` prices against `app/pwa/src/features/catalog/data.ts` (regex on `prices: { week, month }`), so the storefront and Stripe can't disagree unnoticed.

**Firestore rules:** use `@firebase/rules-unit-testing` against the emulator. Check that:
- a customer can't read another customer's subscriptions or orders;
- a non-admin can't read `events`, `inventory` or `metrics_snapshots`;
- no one can write from the client.

**Frontend:** `npx next lint` and `npx next build` stay clean.

**End to end:** emulators plus `stripe listen`, driven by a Playwright script like the existing one in the scratchpad.
1. Sign in with an email link, getting the link from the auth emulator's `/emulator/v1/projects/{p}/oobCodes`.
2. Subscribe to Date night monthly and pay with test card 4242 → the "You're in" dialog appears → the account shows the subscription.
3. Run `stripe trigger invoice.paid` (or advance a Stripe test clock) → an order appears in Orders.
4. Skip and undo, pause and resume, cancel and undo; check each against Stripe's `trial_end` and `cancel_at_period_end`.
5. Run `grant_admin.py`, then in `/admin`:
   - Packing queue: mark the order packed (stock goes down), labelled, then shipped.
   - Subscribers drawer: cancel a subscription, then refund an order.
   - Overview and Cancellations: the numbers reflect these actions.
6. A non-admin opening `/admin` sees "no access", and a direct admin callable from that account fails with PERMISSION_DENIED.

---

## Implementation notes (where the build differs from this plan)

- **The first box is charged at checkout.** Stripe Checkout won't take a `trial_end` less than 48 hours out, and a first delivery can be just 3 days away. `trial_end` steers every charge after that.
- **Two delivery fields on a subscription:**
  - `packedDelivery` is a box already paid for and on its way; it always ships.
  - `nextDelivery` is the next box not yet charged; skip, pause and cadence changes move this one.

  This is what makes the "already packed, still coming" copy accurate.
- **No `stripe_events` collection.** `invoice.paid` is idempotent because one Firestore transaction keys on `payments/{invoiceId}` and writes the order, payment, schedule advance, event and lifetime value together. Every other webhook just re-syncs state, so a repeat is harmless.
- **Failed payments are a `paymentFailed` flag**, not a `past_due` status. Our `status` stays active/paused/cancelled; if Stripe ends the subscription after its retries, it becomes cancelled.
- **Ship date is the working day before delivery** (Tracked 24), not delivery − 2 days.
- **Orders record their `items`** from the catalog recipe when charged, so packing slips don't duplicate the recipe on the frontend.
- **Undoing a skip uses `skippedDelivery`, and undoing a cancel uses a `beforeCancel` snapshot.** Monthly date arithmetic can't be reversed exactly, so the original values are kept instead.
- **Cancellations that were undone don't count** toward churn, reasons or save rate (`effective_cancellations`).
- **Admin sidebar counts** use Firestore `count()` from the client; there's no callable for them.
- **Revenue-by-box bars use one colour.** The box pastels failed the palette validator (lightness, chroma, CVD), and each bar is already labelled with its box name.
- **The seed script landed in Milestone 2**, so the account flows could be tested without Stripe keys. Seeded subscriptions have no Stripe subscription, and changing one skips the Stripe calls.
- **Emulator ports can be overridden** with `NEXT_PUBLIC_*_EMULATOR_PORT`.
- **Not yet verified against real Stripe.** Checkout, the webhook and refunds are tested against a fake gateway (`tests/fakes.py`). A real `stripe listen` run needs test keys in `functions/.env`; see `cloud/README.md`.
- **The catalog moved to Firestore** after launch (`boxes/{id}`, edited in the admin). Price changes create new Stripe prices for new subscribers only. Each subscription records its own `pricePence`.
