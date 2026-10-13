import styles from "./Bar.module.css";

interface BarProps {
  /** 0–100; clamped. */
  percent: number;
  color?: string;
  height?: number;
  label?: string;
}

export function Bar({ percent, color = "var(--cocoa-900)", height = 8, label }: BarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={styles.track} style={{ height }} role={label ? "img" : undefined} aria-label={label}>
      <div className={styles.fill} style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
}
