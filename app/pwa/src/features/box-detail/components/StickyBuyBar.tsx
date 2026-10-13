import clsx from "clsx";
import { Button, ProductImage } from "@/components/ui";
import type { Box } from "@/features/catalog";
import { formatPrice } from "@/shared/utils";
import styles from "./StickyBuyBar.module.css";

interface StickyBuyBarProps {
  box: Box;
  visible: boolean;
  onStart: () => void;
}

/** Phone-only shortcut back up to the buy panel. */
export function StickyBuyBar({ box, visible, onStart }: StickyBuyBarProps) {
  return (
    <div className={clsx(styles.bar, visible && styles.visible)} aria-hidden={!visible} inert={!visible}>
      <div className={styles.thumb}>
        <ProductImage src={box.image} tone={box.tone} ratio="1 / 1" radius={12} sizes="44px" />
      </div>
      <div className={styles.text}>
        <span className={styles.name}>{box.name}</span>
        <span className={styles.price}>from {formatPrice(box.prices.week)} a week</span>
      </div>
      <Button variant="accent" onClick={onStart} style={{ marginLeft: "auto" }}>
        Start my subscription
      </Button>
    </div>
  );
}
