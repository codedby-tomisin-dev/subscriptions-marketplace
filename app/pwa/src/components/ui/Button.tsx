import Link from "next/link";
import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import { LoaderCircle, type LucideIcon } from "lucide-react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "accent" | "secondary" | "soft" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const ICON_SIZE: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 20 };

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: LucideIcon;
  iconRight?: LucideIcon;
  fullWidth?: boolean;
  disabled?: boolean;
  /** Shows a spinner in place of the left icon and blocks clicks. */
  loading?: boolean;
  /** Accessible name when the visible text isn't enough on its own, e.g. a row of "Edit" links. */
  ariaLabel?: string;
  /** Renders a Next.js link styled as a button. */
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  iconLeft: IconLeft,
  iconRight: IconRight,
  fullWidth = false,
  disabled = false,
  loading = false,
  ariaLabel,
  href,
  onClick,
  type = "button",
  className,
  style,
  children,
}: ButtonProps) {
  const classes = clsx(styles.button, styles[variant], styles[size], fullWidth && styles.fullWidth, className);
  const content = (
    <>
      {loading ? (
        <LoaderCircle size={ICON_SIZE[size]} className={styles.spinner} aria-hidden />
      ) : (
        IconLeft && <IconLeft size={ICON_SIZE[size]} aria-hidden />
      )}
      {children}
      {IconRight && <IconRight size={ICON_SIZE[size]} aria-hidden />}
    </>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} aria-label={ariaLabel} className={classes} style={style}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
      className={classes}
      style={style}
    >
      {content}
    </button>
  );
}
