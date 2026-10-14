import clsx from "clsx";
import { Button, ProductImage } from "@/components/ui";
import { boxArt, isCadence, lowestPrice, type Box, type PurchaseOption } from "@/features/catalog";
import { formatPrice } from "@/shared/utils";
import styles from "./StickyBuyBar.module.css";

interface StickyBuyBarProps {
  box: Box;
  /** The ways this box is on sale. */
  options: PurchaseOption[];
  visible: boolean;
  /** Phones: the bar is always there and opens the plan sheet. */
  isPhone: boolean;
  onAction: () => void;
}

// How each option reads after its price in a sentence: "£19 a week", "£45 just once".
const PER: Record<PurchaseOption, string> = { week: "a week", month: "a month", once: "just once" };
const OTHER: Record<PurchaseOption, string> = { week: "weekly", month: "monthly", once: "just once" };
const UNIT: Record<PurchaseOption, string> = { week: "/ week", month: "/ month", once: "/ box" };

/** Small-screen shortcut to buying: back up to the panel, or open the plan sheet on phones. */
export function StickyBuyBar({ box, options, visible, isPhone, onAction }: StickyBuyBarProps) {
  const sellsSubscriptions = options.some(isCadence);
  // Phones lead with monthly, the favourite, where it's offered.
  const lead = options.includes("month") ? "month" : options[0];
  const others = options.filter((option) => option !== lead).map((option) => `${formatPrice(box.prices[option] ?? 0)} ${OTHER[option]}`);
  const lowest = lowestPrice(box);

  return (
    <div className={clsx(styles.bar, visible && styles.visible, isPhone && styles.phone)} aria-hidden={!visible} inert={!visible}>
      {isPhone ? (
        <div className={styles.text}>
          <span className={styles.monthly}>
            {formatPrice(box.prices[lead] ?? 0)}
            <small>{UNIT[lead]}</small>
          </span>
          <span className={styles.price}>
            {[others.length ? `or ${others.join(" or ")}` : null, sellsSubscriptions ? "cancel anytime" : "no subscription"].filter(Boolean).join(" · ")}
          </span>
        </div>
      ) : (
        <>
          <div className={styles.thumb}>
            <ProductImage src={boxArt(box)} tone={box.tone} ratio="1 / 1" radius={12} sizes="44px" />
          </div>
          <div className={styles.text}>
            <span className={styles.name}>{box.name}</span>
            <span className={styles.price}>
              {options.length > 1 ? "from " : ""}
              {formatPrice(lowest.pence)} {PER[lowest.option]}
            </span>
          </div>
        </>
      )}
      <Button variant="accent" size={isPhone ? "lg" : "md"} onClick={onAction} style={{ marginLeft: "auto", flex: "none" }}>
        {isPhone ? (sellsSubscriptions ? "Pick my plan" : "Pick my day") : sellsSubscriptions ? "Start my subscription" : "Buy it once"}
      </Button>
    </div>
  );
}
