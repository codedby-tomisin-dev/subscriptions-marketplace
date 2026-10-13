import clsx from "clsx";
import styles from "./Tabs.module.css";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  count?: number;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  variant?: "pill" | "underline";
  label: string;
}

export function Tabs<T extends string>({ items, value, onChange, variant = "pill", label }: TabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className={clsx(styles.tabs, styles[variant])}>
      {items.map((item) => (
        <button key={item.id} type="button" role="tab" aria-selected={item.id === value} onClick={() => onChange(item.id)} className={styles.tab}>
          {item.label}
          {item.count != null && <span className={styles.count}>{item.count}</span>}
        </button>
      ))}
    </div>
  );
}
