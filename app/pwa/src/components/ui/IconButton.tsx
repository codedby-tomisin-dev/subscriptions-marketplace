import Link from "next/link";
import clsx from "clsx";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import styles from "./IconButton.module.css";

interface IconButtonProps {
  icon: LucideIcon;
  /** Accessible name; also shown as the tooltip. */
  label: string;
  variant?: "ghost" | "secondary";
  size?: "sm" | "md";
  /** Small count bubble, hidden when 0 or undefined. */
  badge?: number;
  href?: string;
  onClick?: () => void;
  style?: CSSProperties;
}

export function IconButton({ icon: Icon, label, variant = "secondary", size = "md", badge, href, onClick, style }: IconButtonProps) {
  const classes = clsx(styles.iconButton, styles[variant], styles[size]);
  const content = (
    <>
      <Icon size={size === "sm" ? 16 : 20} aria-hidden />
      {!!badge && (
        <span className={styles.badge} aria-hidden>
          {badge}
        </span>
      )}
    </>
  );
  const accessibleLabel = badge ? `${label} (${badge})` : label;

  if (href) {
    return (
      <Link href={href} aria-label={accessibleLabel} title={label} className={classes} style={style}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={accessibleLabel} title={label} onClick={onClick} className={classes} style={style}>
      {content}
    </button>
  );
}
