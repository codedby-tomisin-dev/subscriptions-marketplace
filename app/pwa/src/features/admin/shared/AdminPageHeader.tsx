import type { ReactNode } from "react";
import styles from "./AdminPageHeader.module.css";
import admin from "./Admin.module.css";

export function AdminPageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className={styles.header}>
      <div className={styles.titles}>
        <h1 className={admin.h1}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {children && <div className={styles.actions}>{children}</div>}
    </div>
  );
}
