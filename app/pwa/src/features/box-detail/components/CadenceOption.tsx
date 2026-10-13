import clsx from "clsx";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui";
import { formatPrice } from "@/shared/utils";
import styles from "./PurchaseSection.module.css";

interface CadenceOptionProps {
  selected: boolean;
  onSelect: () => void;
  title: string;
  price: number;
  unit: string;
  badge?: string;
}

/** One radio card in the "How often?" group. */
export function CadenceOption({ selected, onSelect, title, price, unit, badge }: CadenceOptionProps) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className={clsx(styles.cadence, selected && styles.cadenceSelected)}>
      <span className={styles.cadenceHead}>
        <span className={styles.radio} aria-hidden>
          {selected && <Check size={12} color="var(--cream-0)" strokeWidth={3} />}
        </span>
        <span className={styles.cadenceTitle}>{title}</span>
      </span>
      {badge && (
        <Badge tone="blush" size="sm" className={styles.cadenceBadge}>
          {badge}
        </Badge>
      )}
      <span className={styles.cadencePrice}>
        <span className={styles.cadenceAmount}>{formatPrice(price)}</span>
        <span className={styles.cadenceUnit}>/ {unit}</span>
      </span>
    </button>
  );
}
