import { Button, Dialog, ProductImage } from "@/components/ui";
import { boxArt, CADENCE_COPY, type Box } from "@/features/catalog";
import { nextBoxArrives, type Subscription } from "@/features/subscriptions";
import { toneSurface } from "@/shared/types";
import { formatDay, formatPrice } from "@/shared/utils";
import styles from "./SubscriptionStartedDialog.module.css";

interface SubscriptionStartedDialogProps {
  box: Box;
  /** Back from Stripe, but the subscription hasn't been recorded yet. */
  isWaiting: boolean;
  subscription: Subscription | null;
  onClose: () => void;
}

export function SubscriptionStartedDialog({ box, isWaiting, subscription, onClose }: SubscriptionStartedDialogProps) {
  const copy = subscription && CADENCE_COPY[subscription.cadence];
  const firstBox = subscription && nextBoxArrives(subscription);

  if (isWaiting) {
    return (
      <Dialog
        open
        onClose={onClose}
        width={460}
        title="Confirming your payment…"
        description="This usually takes a few seconds. You can close this — your box will show up in your account."
      />
    );
  }

  return (
    <Dialog
      open={!!subscription}
      onClose={onClose}
      width={460}
      title="You’re in. Lovely."
      description={
        firstBox &&
        copy &&
        `Your first ${box.name.toLowerCase()} box arrives ${formatDay(firstBox)}, then every ${copy.unit} after. Change or cancel anytime from your account.`
      }
      footer={
        <>
          <Button variant="ghost" href="/">
            Keep browsing
          </Button>
          <Button href="/account">See my subscriptions</Button>
        </>
      }
    >
      {subscription && copy && (
        <div className={styles.summary} style={{ background: toneSurface(box.tone) }}>
          <div className={styles.thumb}>
            <ProductImage src={boxArt(box)} tone={box.tone} ratio="1 / 1" radius={12} sizes="64px" />
          </div>
          <div className={styles.text}>
            <b className={styles.name}>{box.name}</b>
            <span className={styles.price}>
              {formatPrice(subscription.pricePence ?? box.prices[subscription.cadence] ?? 0)} / {copy.unit}
              {subscription.isGift && " · gift"}
            </span>
          </div>
        </div>
      )}
    </Dialog>
  );
}
