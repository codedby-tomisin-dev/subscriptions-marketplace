import clsx from "clsx";
import { Button, ProductImage } from "@/components/ui";
import type { Box } from "@/features/catalog";
import { formatPrice } from "@/shared/utils";
import styles from "./StickyBuyBar.module.css";

interface StickyBuyBarProps {
  box: Box;
  visible: boolean;
  /** Phones: the bar is always there and opens the plan sheet. */
  isPhone: boolean;
  onAction: () => void;
}

/** Small-screen shortcut to buying: back up to the panel, or open the plan sheet on phones. */
export function StickyBuyBar({ box, visible, isPhone, onAction }: StickyBuyBarProps) {
  return (
    <div className={clsx(styles.bar, visible && styles.visible, isPhone && styles.phone)} aria-hidden={!visible} inert={!visible}>
      {isPhone ? (
        <div className={styles.text}>
          <span className={styles.monthly}>
            {formatPrice(box.prices.month)}
            <small>/ month</small>
          </span>
          <span className={styles.price}>or {formatPrice(box.prices.week)} weekly · cancel anytime</span>
        </div>
      ) : (
        <>
          <div className={styles.thumb}>
            <ProductImage src={box.image} tone={box.tone} ratio="1 / 1" radius={12} sizes="44px" />
          </div>
          <div className={styles.text}>
            <span className={styles.name}>{box.name}</span>
            <span className={styles.price}>from {formatPrice(box.prices.week)} a week</span>
          </div>
        </>
      )}
      <Button variant="accent" size={isPhone ? "lg" : "md"} onClick={onAction} style={{ marginLeft: "auto", flex: "none" }}>
        {isPhone ? "Pick my plan" : "Start my subscription"}
      </Button>
    </div>
  );
}
