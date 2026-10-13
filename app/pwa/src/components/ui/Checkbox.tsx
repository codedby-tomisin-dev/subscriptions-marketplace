import { Check } from "lucide-react";
import styles from "./Checkbox.module.css";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Visible label. Omit only when `ariaLabel` is set, e.g. in a table row. */
  label?: string;
  ariaLabel?: string;
  /** Shows a dash, for "some rows selected" in a select-all box. */
  indeterminate?: boolean;
}

export function Checkbox({ checked, onChange, label, ariaLabel, indeterminate = false }: CheckboxProps) {
  return (
    <label className={styles.checkbox} onClick={(event) => event.stopPropagation()}>
      <input
        type="checkbox"
        checked={checked}
        aria-checked={indeterminate ? "mixed" : checked}
        aria-label={label ? undefined : ariaLabel}
        onChange={(event) => onChange(event.target.checked)}
        className={styles.input}
      />
      <span className={styles.box} aria-hidden>
        {checked && <Check size={15} className={styles.tick} />}
        {!checked && indeterminate && <span className={styles.dash} />}
      </span>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  );
}
