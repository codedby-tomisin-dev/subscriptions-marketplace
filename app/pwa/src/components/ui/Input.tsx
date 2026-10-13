import { useId, type ChangeEvent, type InputHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import styles from "./Input.module.css";

interface InputProps extends Pick<InputHTMLAttributes<HTMLInputElement>, "type" | "placeholder" | "autoComplete" | "autoFocus" | "required" | "disabled" | "name" | "inputMode"> {
  value: string;
  onChange: (value: string) => void;
  /** Visible label. Omit only when `ariaLabel` is set. */
  label?: string;
  ariaLabel?: string;
  hint?: string;
  error?: string;
  iconLeft?: LucideIcon;
}

export function Input({ value, onChange, label, ariaLabel, hint, error, iconLeft: IconLeft, type = "text", ...inputProps }: InputProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;

  return (
    <div className={styles.input}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}
      <div className={styles.field} data-invalid={error ? true : undefined}>
        {IconLeft && <IconLeft size={18} className={styles.icon} aria-hidden />}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
          aria-label={label ? undefined : ariaLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          {...inputProps}
        />
      </div>
      {message && (
        <span id={messageId} className={error ? styles.error : styles.hint}>
          {message}
        </span>
      )}
    </div>
  );
}
