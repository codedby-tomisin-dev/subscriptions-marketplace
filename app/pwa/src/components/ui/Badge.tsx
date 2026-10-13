import clsx from "clsx";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import styles from "./Badge.module.css";

export type BadgeTone = "neutral" | "blush" | "apricot" | "sage" | "plum";

interface BadgeProps {
  tone?: BadgeTone;
  icon?: LucideIcon;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = "neutral", icon: Icon, size = "md", className, children }: BadgeProps) {
  return (
    <span className={clsx(styles.badge, styles[tone], styles[size], className)}>
      {Icon && <Icon size={size === "sm" ? 12 : 13} aria-hidden />}
      {children}
    </span>
  );
}
