"use client";

import { useState } from "react";
import { Mail, Pause, Play, ReceiptText, SkipForward } from "lucide-react";
import { Button, Dialog, Drawer } from "@/components/ui";
import { firstName, type Customer } from "@/features/customers";
import { useCatalog } from "@/features/catalog";
import type { Order } from "@/features/orders";
import type { Subscription } from "@/features/subscriptions";
import { formatMonthYear, formatPrice, formatShortDate } from "@/shared/utils";
import { AdminBadge, adminStyles as admin, BoxDot } from "../shared";
import { describeActivity } from "./activity";
import { useAdminSubscriptionActions } from "./useAdminSubscriptionActions";
import { useSubscriberDetail } from "./useSubscriberDetail";
import styles from "./Subscribers.module.css";

const REFUNDABLE_ORDERS = 5;

export function SubscriberDrawer({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { subscriptions, orders, events } = useSubscriberDetail(customer.id);
  const { getBox } = useCatalog();
  const name = firstName(customer) ?? "them";
  const actions = useAdminSubscriptionActions(name);
  const [confirmCancel, setConfirmCancel] = useState<Subscription | null>(null);
  const [isRefunding, setIsRefunding] = useState(false);

  return (
    <Drawer open onClose={onClose} label={`${customer.name ?? customer.email}’s subscriptions`}>
      <div className={styles.drawerHead}>
        <h2 className={admin.h1} style={{ fontSize: 28 }}>
          {customer.name ?? customer.email}
        </h2>
        <span className={admin.muted}>{customer.email}</span>
        {customer.city && <span className={admin.subtle}>{customer.city}</span>}
      </div>

      <div className={styles.facts}>
        <div className={styles.fact}>
          <div className={admin.muted}>Lifetime value</div>
          <div className={admin.num} style={{ fontSize: 22, marginTop: 4 }}>
            {formatPrice(customer.ltvPence)}
          </div>
        </div>
        <div className={styles.fact}>
          <div className={admin.muted}>Member since</div>
          <div className={admin.num} style={{ fontSize: 22, marginTop: 4 }}>
            {formatMonthYear(customer.memberSince)}
          </div>
        </div>
      </div>

      <section className={styles.section}>
        <span className={admin.label}>Subscriptions</span>
        {subscriptions?.map((subscription) => (
          <SubscriptionCard
            key={subscription.id}
            subscription={subscription}
            isBusy={actions.busyId === subscription.id}
            onSkip={() => actions.skipNext(subscription)}
            onPause={() => actions.pause(subscription)}
            onResume={() => actions.resume(subscription)}
            onCancel={() => setConfirmCancel(subscription)}
          />
        ))}
      </section>

      <section className={styles.section}>
        <span className={admin.label}>Recent activity</span>
        {events.map((event) => {
          const { icon: Icon, text } = describeActivity(event, (boxId) => getBox(boxId)?.name);
          return (
            <div key={event.id} className={styles.activity}>
              <Icon size={16} color="var(--text-subtle)" aria-hidden />
              <span className={styles.activityText}>{text}</span>
              <span className={admin.subtle}>{formatShortDate(event.at.slice(0, 10))}</span>
            </div>
          );
        })}
        {!events.length && <span className={admin.subtle}>Nothing yet.</span>}
      </section>

      <div className={styles.drawerFoot}>
        <Button size="sm" variant="secondary" iconLeft={Mail} href={`mailto:${customer.email}`}>
          Email
        </Button>
        <Button size="sm" variant="secondary" iconLeft={ReceiptText} onClick={() => setIsRefunding(true)} disabled={!orders.some((o) => o.status !== "refunded")}>
          Refund a box
        </Button>
      </div>

      {confirmCancel && (
        <Dialog
          open
          onClose={() => setConfirmCancel(null)}
          title={`Cancel ${getBox(confirmCancel.boxId)?.name ?? "this box"} for ${name}?`}
          description="Any box already paid for will still ship. They can restart anytime."
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmCancel(null)}>
                Keep it
              </Button>
              <Button
                onClick={() => {
                  actions.cancel(confirmCancel);
                  setConfirmCancel(null);
                }}
              >
                Cancel subscription
              </Button>
            </>
          }
        />
      )}

      {isRefunding && (
        <RefundDialog
          orders={orders.filter((order) => order.status !== "refunded").slice(0, REFUNDABLE_ORDERS)}
          onClose={() => setIsRefunding(false)}
          onRefund={(order) => {
            actions.refund(order.id, formatPrice(order.pricePence));
            setIsRefunding(false);
          }}
        />
      )}
    </Drawer>
  );
}

interface SubscriptionCardProps {
  subscription: Subscription;
  isBusy: boolean;
  onSkip: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

function SubscriptionCard({ subscription, isBusy, onSkip, onPause, onResume, onCancel }: SubscriptionCardProps) {
  const box = useCatalog().getBox(subscription.boxId);
  const pricePence = subscription.pricePence ?? box?.prices[subscription.cadence];
  const price = pricePence != null ? formatPrice(pricePence) : "";
  return (
    <div className={styles.subscription}>
      <div className={styles.subscriptionHead}>
        <BoxDot boxId={subscription.boxId} />
        <span className={admin.subtle}>
          · {price}/{subscription.cadence === "week" ? "wk" : "mo"}
        </span>
        <span style={{ marginLeft: "auto" }}>
          <AdminBadge status={subscription.status} />
        </span>
      </div>
      {subscription.status !== "cancelled" && (
        <div className={styles.subscriptionActions}>
          {subscription.status === "active" ? (
            <>
              <Button size="sm" variant="ghost" iconLeft={SkipForward} onClick={onSkip} disabled={isBusy}>
                Skip next
              </Button>
              <Button size="sm" variant="ghost" iconLeft={Pause} onClick={onPause} disabled={isBusy}>
                Pause
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" iconLeft={Play} onClick={onResume} loading={isBusy}>
              Resume
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={isBusy} style={{ color: "var(--danger-fg)" }}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

function RefundDialog({ orders, onClose, onRefund }: { orders: Order[]; onClose: () => void; onRefund: (order: Order) => void }) {
  const [selectedId, setSelectedId] = useState(orders[0]?.id ?? null);
  const selected = orders.find((order) => order.id === selectedId);
  return (
    <Dialog
      open
      onClose={onClose}
      title="Refund a box"
      description="The charge goes back to their card. A box that hasn’t shipped yet comes out of the packing queue."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Never mind
          </Button>
          <Button onClick={() => selected && onRefund(selected)} disabled={!selected}>
            Refund {selected ? formatPrice(selected.pricePence) : ""}
          </Button>
        </>
      }
    >
      <div className={styles.refundList} role="radiogroup" aria-label="Order to refund">
        {orders.map((order) => (
          <label key={order.id} className={styles.refundOption}>
            <input type="radio" name="refund" checked={order.id === selectedId} onChange={() => setSelectedId(order.id)} />
            <span className={admin.mono}>{order.id}</span>
            <BoxDot boxId={order.boxId} />
            <span className={admin.subtle}>{formatShortDate(order.deliveryDate)}</span>
            <span style={{ marginLeft: "auto" }}>
              <AdminBadge status={order.status} />
            </span>
          </label>
        ))}
      </div>
    </Dialog>
  );
}
