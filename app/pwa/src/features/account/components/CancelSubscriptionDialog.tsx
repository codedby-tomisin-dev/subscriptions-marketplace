"use client";

import { useState } from "react";
import { Button, Dialog, Tag } from "@/components/ui";
import type { Box } from "@/features/catalog";
import { pauseResumeDate, type Subscription } from "@/features/subscriptions";
import { formatDay, formatMonthName } from "@/shared/utils";
import styles from "./CancelSubscriptionDialog.module.css";

const REASONS = ["Too many boxes", "A bit pricey", "Not my vibe anymore", "Just need a break", "Something else"] as const;
type Reason = (typeof REASONS)[number];

/** Reasons where a lighter change might suit better than cancelling. */
const RETENTION_REASONS: Reason[] = ["Just need a break", "Too many boxes", "A bit pricey"];

interface CancelSubscriptionDialogProps {
  subscription: Subscription;
  box: Box;
  onClose: () => void;
  onConfirm: (reason: string | null) => void;
  onPause: () => void;
  onSwitchToMonthly: () => void;
}

/** Mount only while open, so the chosen reason resets each time. */
export function CancelSubscriptionDialog({ subscription, box, onClose, onConfirm, onPause, onSwitchToMonthly }: CancelSubscriptionDialogProps) {
  const [reason, setReason] = useState<Reason | null>(null);
  const isActive = subscription.status === "active";
  const packedBox = subscription.packedDelivery;
  const offer = isActive && reason && RETENTION_REASONS.includes(reason) ? retentionOffer(reason, subscription) : null;

  return (
    <Dialog
      open
      onClose={onClose}
      width={520}
      title={`Cancel your ${box.name.toLowerCase()} box?`}
      description={
        packedBox
          ? `No hard feelings. Your ${formatDay(packedBox)} box is already packed, so that one still arrives — nothing after it.`
          : "No hard feelings. Nothing else will be charged or sent."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep my box
          </Button>
          <Button onClick={() => onConfirm(reason)}>Cancel subscription</Button>
        </>
      }
    >
      <div className={styles.reasons}>
        <span className={styles.label}>
          Mind telling us why? <span className={styles.optional}>Optional</span>
        </span>
        <div className={styles.tags}>
          {REASONS.map((option) => (
            <Tag key={option} selected={reason === option} onClick={() => setReason(reason === option ? null : option)}>
              {option}
            </Tag>
          ))}
        </div>
        {offer && (
          <div className={styles.offer}>
            <span className={styles.offerText}>{offer.message}</span>
            <Button size="sm" variant="secondary" onClick={offer.kind === "monthly" ? onSwitchToMonthly : onPause}>
              {offer.kind === "monthly" ? "Go monthly" : "Pause instead"}
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function retentionOffer(reason: Reason, subscription: Subscription): { kind: "pause" | "monthly"; message: string } {
  if (reason === "Just need a break") {
    return { kind: "pause", message: `Want to pause instead? We’ll hold your spot until ${formatMonthName(pauseResumeDate(new Date()))}.` };
  }
  if (subscription.cadence === "week") {
    return { kind: "monthly", message: "Monthly might suit better — one full box, less often." };
  }
  return { kind: "pause", message: "You could pause for a couple of months instead." };
}
