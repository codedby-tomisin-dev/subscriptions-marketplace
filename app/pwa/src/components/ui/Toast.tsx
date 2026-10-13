import { CircleAlert, CircleCheck, Sparkles, X, type LucideIcon } from "lucide-react";
import styles from "./Toast.module.css";

type ToastTone = "neutral" | "success" | "danger";

const TONE_ICON: Record<ToastTone, { icon: LucideIcon; color: string }> = {
  neutral: { icon: Sparkles, color: "var(--blush-300)" },
  success: { icon: CircleCheck, color: "var(--sage-300)" },
  danger: { icon: CircleAlert, color: "var(--apricot-300)" },
};

export interface ToastOptions {
  tone?: ToastTone;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastProps extends ToastOptions {
  onClose: () => void;
}

export function Toast({ tone = "neutral", title, message, actionLabel, onAction, onClose }: ToastProps) {
  const { icon: Icon, color } = TONE_ICON[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={styles.toast}>
      <Icon size={20} color={color} aria-hidden />
      <div className={styles.body}>
        <div className={styles.title}>{title}</div>
        {message && <div className={styles.message}>{message}</div>}
      </div>
      {actionLabel && (
        <button type="button" onClick={onAction} className={styles.action}>
          {actionLabel}
        </button>
      )}
      <button type="button" aria-label="Dismiss" onClick={onClose} className={styles.dismiss}>
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
