import clsx from "clsx";
import { Star } from "lucide-react";
import { Button, ProductImage } from "@/components/ui";
import type { Box } from "@/features/catalog";
import { formatDay, formatPrice, formatShortDate } from "@/shared/utils";
import { customerOrderStage, type CustomerOrderStage, type Order } from "@/features/orders";
import { StatusBadge } from "./StatusBadge";
import styles from "./OrderRow.module.css";

const TRACKING_STEPS = ["Packed", "Shipped", "Delivered"];
const TRACKING_STEP_INDEX: Record<CustomerOrderStage, number> = { preparing: 0, transit: 1, delivered: 2, refunded: -1 };

export function OrderRow({ order, box }: { order: Order; box: Box }) {
  const stage = customerOrderStage(order.status);
  const isDelivered = stage === "delivered";
  const isSettled = isDelivered || stage === "refunded";
  const currentStep = TRACKING_STEP_INDEX[stage];

  return (
    <article className={styles.row}>
      <div className={styles.thumb}>
        <ProductImage src={box.image} tone={box.tone} ratio="1 / 1" radius={14} sizes="56px" />
      </div>
      <div className={styles.identity}>
        <span className={styles.name}>{box.name}</span>
        <span className={styles.number}>
          {order.id} · placed {formatShortDate(order.placedOn)}
        </span>
      </div>
      <div className={styles.status}>
        <div className={styles.statusLine}>
          <StatusBadge status={stage} />
          {stage !== "refunded" && (
            <span className={styles.when}>
              {isDelivered ? `Delivered ${formatShortDate(order.deliveryDate)}` : `Arrives ${formatDay(order.deliveryDate)}`}
            </span>
          )}
        </div>
        {!isSettled && (
          <ol className={styles.tracker} aria-label="Delivery progress">
            {TRACKING_STEPS.map((step, index) => (
              <li key={step} className={clsx(index <= currentStep && styles.reached)}>
                {step}
              </li>
            ))}
          </ol>
        )}
      </div>
      <span className={styles.price}>{formatPrice(order.pricePence)}</span>
      <div className={styles.actions}>
        {isDelivered && (
          <Button size="sm" variant="ghost" iconLeft={Star} href={`/boxes/${box.id}`}>
            Rate
          </Button>
        )}
        <Button size="sm" variant="ghost">
          Get help
        </Button>
      </div>
    </article>
  );
}
