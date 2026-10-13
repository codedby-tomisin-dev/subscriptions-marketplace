import { useId } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./Input.module.css";

interface SelectProps<T extends string> {
  /** Visible label. Omit only when `ariaLabel` is set. */
  label?: string;
  ariaLabel?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function Select<T extends string>({ label, ariaLabel, value, options, onChange }: SelectProps<T>) {
  const id = useId();
  return (
    <div className={styles.input}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}
      <div className={styles.field}>
        <select id={id} value={value} aria-label={label ? undefined : ariaLabel} onChange={(event) => onChange(event.target.value as T)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className={styles.icon} aria-hidden />
      </div>
    </div>
  );
}
