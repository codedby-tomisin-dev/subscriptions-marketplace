"use client";

import { Button, Dialog, ProductImage } from "@/components/ui";
import { boxArt, type Box } from "@/features/catalog";
import { toneSurface } from "@/shared/types";
import { formatDay, formatPrice } from "@/shared/utils";
import { useCheckoutReturn } from "../hooks/useCheckoutReturn";
import { SubscriptionStartedDialog } from "./SubscriptionStartedDialog";
import styles from "./SubscriptionStartedDialog.module.css";

/** Shown when Stripe Checkout sends the customer back to this box's page. */
export function CheckoutReturnDialog({ box }: { box: Box }) {
  const { isWaiting, started, boughtFor, dismiss } = useCheckoutReturn();
  if (boughtFor) return <OneOffBoughtDialog box={box} delivery={boughtFor} onClose={dismiss} />;
  return <SubscriptionStartedDialog box={box} isWaiting={isWaiting} subscription={started} onClose={dismiss} />;
}

function OneOffBoughtDialog({ box, delivery, onClose }: { box: Box; delivery: string; onClose: () => void }) {
  return (
    <Dialog
      open
      onClose={onClose}
      width={460}
      title="Ordered. Lovely."
      description={`Your ${box.name.toLowerCase()} box arrives ${formatDay(delivery)}. No subscription, nothing to cancel. Track it from your account.`}
      footer={
        <>
          <Button variant="ghost" href="/">
            Keep browsing
          </Button>
          <Button href="/account">See my orders</Button>
        </>
      }
    >
      <div className={styles.summary} style={{ background: toneSurface(box.tone) }}>
        <div className={styles.thumb}>
          <ProductImage src={boxArt(box)} tone={box.tone} ratio="1 / 1" radius={12} sizes="64px" />
        </div>
        <div className={styles.text}>
          <b className={styles.name}>{box.name}</b>
          <span className={styles.price}>{box.prices.once !== undefined && `${formatPrice(box.prices.once)} · `}just once</span>
        </div>
      </div>
    </Dialog>
  );
}
