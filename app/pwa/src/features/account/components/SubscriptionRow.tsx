import Link from "next/link";
import clsx from "clsx";
import { Calendar, CreditCard, History, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { Button, ProductImage, Tabs } from "@/components/ui";
import { boxArt, CADENCE_COPY, type Box, type Cadence } from "@/features/catalog";
import { nextBoxArrives, type Subscription } from "@/features/subscriptions";
import { toneSurface } from "@/shared/types";
import { formatDay, formatMonthYear, formatPrice, formatShortDate } from "@/shared/utils";
import { StatusBadge } from "./StatusBadge";
import styles from "./SubscriptionRow.module.css";

const CADENCE_TABS: { id: Cadence; label: string }[] = [
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
];

interface SubscriptionRowProps {
  subscription: Subscription;
  box: Box;
  onCadenceChange: (cadence: Cadence) => void;
  onSkip: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRestart: () => void;
  /** A change to this subscription is in flight. */
  isBusy: boolean;
}

function DeliveryStatus({ subscription }: { subscription: Subscription }) {
  const nextBox = nextBoxArrives(subscription);
  if (subscription.paymentFailed && subscription.status !== "cancelled") {
    return (
      <>
        <CreditCard size={16} aria-hidden />
        <span>
          <b>Your last payment didn’t go through.</b> We’ll try again in a day or two.
        </span>
      </>
    );
  }
  if (subscription.status === "active" && nextBox) {
    return (
      <>
        <Calendar size={16} aria-hidden />
        <span>
          Next box arrives <b>{formatDay(nextBox)}</b>
        </span>
      </>
    );
  }
  if (subscription.status === "paused") {
    return (
      <>
        <Pause size={16} aria-hidden />
        <span>Paused{subscription.resumesOn && ` · picks back up ${formatShortDate(subscription.resumesOn)}`}</span>
      </>
    );
  }
  return (
    <>
      <History size={16} aria-hidden />
      <span>
        Member {formatMonthYear(subscription.memberSince)}
        {subscription.endedOn && ` – ${formatMonthYear(subscription.endedOn)}`}
        {subscription.finalDelivery && ` · last box arrives ${formatDay(subscription.finalDelivery)}`}
      </span>
    </>
  );
}

export function SubscriptionRow({ subscription, box, onCadenceChange, onSkip, onPause, onResume, onCancel, onRestart, isBusy }: SubscriptionRowProps) {
  const isLive = subscription.status !== "cancelled";
  const { cadence } = subscription;

  return (
    <article className={clsx(styles.row, !isLive && styles.ended)}>
      <Link href={`/boxes/${box.id}`} className={styles.thumb} style={{ background: toneSurface(box.tone) }} aria-label={`View the ${box.name} box`}>
        <ProductImage src={boxArt(box)} tone={box.tone} ratio="1 / 1" radius="var(--radius-md)" label={box.name} background="var(--cream-0)" sizes="120px" />
      </Link>

      <div className={styles.details}>
        <div className={styles.titleLine}>
          <h3 className={styles.title}>{box.name}</h3>
          <StatusBadge status={subscription.status} />
        </div>
        <div className={styles.priceLine}>
          <span className={styles.price}>{formatPrice(subscription.pricePence ?? box.prices[cadence])}</span>
          <span className={styles.plan}>
            / {CADENCE_COPY[cadence].unit} · {box.planNotes[cadence]}
          </span>
        </div>
      </div>

      <div className={styles.delivery}>
        <DeliveryStatus subscription={subscription} />
      </div>

      <div className={styles.actions}>
        {isLive ? (
          <>
            <Tabs label={`${box.name} delivery rhythm`} items={CADENCE_TABS} value={cadence} onChange={onCadenceChange} />
            <div className={styles.buttons}>
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
          </>
        ) : (
          <Button size="sm" variant="secondary" iconLeft={RotateCcw} onClick={onRestart} loading={isBusy}>
            Restart
          </Button>
        )}
      </div>
    </article>
  );
}
