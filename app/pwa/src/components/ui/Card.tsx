import clsx from "clsx";
import type { ReactNode } from "react";
import styles from "./Card.module.css";

interface CardProps {
  tone?: "white" | "blush" | "ink";
  elevation?: "none" | "sm";
  /** Padding and radius come from the caller's class. */
  className?: string;
  children: ReactNode;
}

export function Card({ tone = "white", elevation = "sm", className, children }: CardProps) {
  return <div className={clsx(styles.card, styles[tone], elevation === "sm" && styles.raised, className)}>{children}</div>;
}
