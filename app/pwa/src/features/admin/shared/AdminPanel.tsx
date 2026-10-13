import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import admin from "./Admin.module.css";
import styles from "./AdminPanel.module.css";

interface AdminPanelProps {
  title?: string;
  action?: ReactNode;
  /** Tables sit flush with the panel edge. */
  flush?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function AdminPanel({ title, action, flush = false, className, style, children }: AdminPanelProps) {
  return (
    <section className={clsx(admin.panel, flush ? styles.flush : styles.padded, className)} style={style}>
      {(title || action) && (
        <div className={styles.head}>
          {title && <h2 className={admin.h2}>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
