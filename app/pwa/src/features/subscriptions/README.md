# Subscriptions

A customer's box subscriptions, and the calls that change them.

- **Source of truth:** Firestore `subscriptions/{id}`, written only by Cloud Functions (`cloud/functions/modules/subscriptions` and `billing`). `SubscriptionsProvider` keeps a live listener on the signed-in customer's subscriptions; there's nothing to save client-side.
- **Changes:** `manageSubscription(id, { action, ... })` calls the `manage_subscription` function, which checks ownership, applies the rule, moves Stripe billing and logs an event. The listener then delivers the new state. Undo is the inverse action (`unskip`, `undo_cancel`), not a client-side restore.
- **New subscriptions** come from Stripe Checkout (`createCheckoutSession`). The record appears in the customer's list when the Stripe webhook lands; the box page waits for it there.

## Two delivery dates

- `packedDelivery` is a box that's already been paid for (charged 3 days before it arrives). It always ships, even if the customer then skips, pauses or cancels.
- `nextDelivery` is the next box not yet charged. Skip, pause and cadence changes move this one.
- `nextBoxArrives()` picks whichever the customer will see first.

## Assumptions

- A pause lasts until the 1st of the month two months out; billing resumes by itself then.
- Stripe shows these subscriptions as "trialing" between charges (we steer each charge with `trial_end`). Our `status` is the truth.
