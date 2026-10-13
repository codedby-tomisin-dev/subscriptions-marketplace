import { useId } from "react";
import styles from "./Input.module.css";

interface TextAreaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
  required?: boolean;
}

export function TextArea({ label, value, onChange, rows = 3, placeholder, hint, required }: TextAreaProps) {
  const id = useId();
  return (
    <div className={styles.input}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={`${styles.field} ${styles.multiline}`}>
        <textarea
          id={id}
          rows={rows}
          value={value}
          placeholder={placeholder}
          required={required}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {hint && (
        <span id={`${id}-hint`} className={styles.hint}>
          {hint}
        </span>
      )}
    </div>
  );
}
