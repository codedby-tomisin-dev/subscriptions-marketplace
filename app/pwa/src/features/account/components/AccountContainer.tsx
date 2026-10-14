"use client";

import { useState } from "react";
import { HeartHandshake, LoaderCircle, MessageCircle, Plus } from "lucide-react";
import { Button, Card, Tabs } from "@/components/ui";
import { useAuth } from "@/features/auth";
import { useCatalog } from "@/features/catalog";
import { firstName } from "@/features/customers";
import { customerOrderStage, type Order } from "@/features/orders";
import { nextBoxArrives, useSubscriptions, type Subscription } from "@/features/subscriptions";
import { formatDay } from "@/shared/utils";
import { useAccountData } from "../hooks/useAccountData";
import { useSubscriptionActions } from "../hooks/useSubscriptionActions";
import { SignedOutAccount } from "./SignedOutAccount";
import { CancelSubscriptionDialog } from "./CancelSubscriptionDialog";
import { OrderRow } from "./OrderRow";
import { SubscriptionRow } from "./SubscriptionRow";
import styles from "./Account.module.css";

type AccountTab = "subscriptions" | "orders";

/** Live subscriptions first, cancelled ones at the bottom. */
const byLiveFirst = (a: Subscription, b: Subscription) => Number(a.status === "cancelled") - Number(b.status === "cancelled");

function summarise(subscriptions: Subscription[], orders: Order[]) {
  const active = subscriptions.filter((subscription) => subscription.status === "active");
  // One-off boxes have no subscription, so they're counted from their orders.
  const oneOffs = orders.filter((order) => order.cadence === "once" && ["preparing", "transit"].includes(customerOrderStage(order.status)));
  if (!active.length && !oneOffs.length) return "No boxes on the way right now.";
  const nextUp = [...active.map(nextBoxArrives), ...oneOffs.map((order) => order.deliveryDate)].filter((date): date is string => !!date).sort()[0];
  const count = [
    active.length && `${active.length} active subscription${active.length > 1 ? "s" : ""}`,
    oneOffs.length && `${oneOffs.length} one-off box${oneOffs.length > 1 ? "es" : ""} on the way`,
  ]
    .filter(Boolean)
    .join(" · ");
  return nextUp ? `${count} · next box ${formatDay(nextUp).replace(/ /g, " ")}` : count;
}

export function AccountContainer() {
  const { user, isLoading: authLoading } = useAuth();
  const { subscriptions, isLoading } = useSubscriptions();

  if (authLoading || (user && isLoading)) {
    return (
      <main className={`bb-container bb-container-narrow ${styles.page}`}>
        <p className={styles.loading} role="status">
          <LoaderCircle size={20} className={styles.spinner} aria-hidden />
          Loading your boxes…
        </p>
      </main>
    );
  }
  if (!user) return <SignedOutAccount />;
  return <Account subscriptions={subscriptions} email={user.email} />;
}

function Account({ subscriptions, email }: { subscriptions: Subscription[]; email: string | null }) {
  const { customer, orders } = useAccountData();
  const actions = useSubscriptionActions();
  // Until a tab is picked: orders for someone who's only bought one-off boxes, else subscriptions.
  const [pickedTab, setTab] = useState<AccountTab | null>(null);
  const tab = pickedTab ?? (!subscriptions.length && orders.length ? "orders" : "subscriptions");
  const [cancelTarget, setCancelTarget] = useState<Subscription | null>(null);
  const { getBox } = useCatalog();
  const cancelBox = cancelTarget && getBox(cancelTarget.boxId);
  const name = firstName(customer, email);

  return (
    <main className={`bb-container bb-container-narrow ${styles.page}`}>
      <div className={styles.head}>
        <div className={styles.greeting}>
          <h1 className="bb-heading">{name ? `Hi, ${name}.` : "Hi there."}</h1>
          <p className={styles.summary}>{summarise(subscriptions, orders)}</p>
        </div>
        <span className={styles.wideOnly}>
          <Button variant="secondary" iconLeft={Plus} href="/">
            Add another box
          </Button>
        </span>
      </div>

      <Tabs
        variant="underline"
        label="Account sections"
        value={tab}
        onChange={setTab}
        items={[
          { id: "subscriptions", label: "Subscriptions", count: subscriptions.length },
          { id: "orders", label: "Orders", count: orders.length },
        ]}
      />

      {tab === "subscriptions" && (
        <div className={styles.subscriptions}>
          {!subscriptions.length && (
            <Card className={styles.empty}>
              <p className={styles.emptyText}>No boxes yet. Pick one and your first arrives in a few days.</p>
              <Button href="/">Browse boxes</Button>
            </Card>
          )}
          {[...subscriptions].sort(byLiveFirst).map((subscription) => {
            const box = getBox(subscription.boxId);
            if (!box) return null;
            return (
              <SubscriptionRow
                key={subscription.id}
                subscription={subscription}
                box={box}
                onCadenceChange={(cadence) => actions.changeCadence(subscription, cadence)}
                onSkip={() => actions.skipNext(subscription)}
                onPause={() => actions.pause(subscription)}
                onResume={() => actions.resume(subscription)}
                onCancel={() => setCancelTarget(subscription)}
                onRestart={() => actions.restart(subscription)}
                isBusy={actions.busyId === subscription.id}
              />
            );
          })}
          {!!subscriptions.length && (
            <span className={styles.phoneOnly}>
              <Button variant="secondary" iconLeft={Plus} href="/" fullWidth>
                Add another box
              </Button>
            </span>
          )}
          <Card tone="blush" elevation="none" className={styles.help}>
            <HeartHandshake size={24} aria-hidden />
            <div className={styles.helpText}>
              <div className={styles.helpTitle}>Not sure what to change?</div>
              <div className={styles.helpBody}>Our team will happily look at your boxes with you. Real people, usually within the hour.</div>
            </div>
            <Button size="sm" iconLeft={MessageCircle}>
              Chat with us
            </Button>
          </Card>
        </div>
      )}

      {tab === "orders" && (
        <div className={styles.orders}>
          {!orders.length && <p className={styles.emptyText}>Your orders will show up here once your first box is on its way.</p>}
          {orders.map((order) => {
            const box = getBox(order.boxId);
            return box ? <OrderRow key={order.id} order={order} box={box} /> : null;
          })}
        </div>
      )}

      {cancelTarget && cancelBox && (
        <CancelSubscriptionDialog
          subscription={cancelTarget}
          box={cancelBox}
          onClose={() => setCancelTarget(null)}
          onConfirm={(reason) => {
            actions.cancel(cancelTarget, cancelBox.name, reason);
            setCancelTarget(null);
          }}
          onPause={() => {
            actions.pause(cancelTarget, true);
            setCancelTarget(null);
          }}
          onSwitchToMonthly={() => {
            actions.changeCadence(cancelTarget, "month", true);
            setCancelTarget(null);
          }}
        />
      )}
    </main>
  );
}
