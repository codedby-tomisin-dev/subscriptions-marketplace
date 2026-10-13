import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui";
import styles from "./BoxEditor.module.css";

interface RowListProps<T> {
  rows: T[];
  onChange: (rows: T[]) => void;
  makeRow: () => T;
  renderRow: (row: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
  addLabel: string;
  /** Used in the remove button's accessible name, e.g. "fact". */
  rowName: string;
  max?: number;
}

/** An editable list of rows with add and remove. */
export function RowList<T>({ rows, onChange, makeRow, renderRow, addLabel, rowName, max }: RowListProps<T>) {
  const updateRow = (index: number) => (patch: Partial<T>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <div className={styles.rows}>
      {rows.map((row, index) => (
        <div key={index} className={styles.row}>
          <div className={styles.rowFields}>{renderRow(row, updateRow(index), index)}</div>
          <IconButton icon={Trash2} label={`Remove ${rowName} ${index + 1}`} variant="ghost" size="sm" onClick={() => onChange(rows.filter((_, i) => i !== index))} />
        </div>
      ))}
      {(max === undefined || rows.length < max) && (
        <div>
          <Button size="sm" variant="ghost" iconLeft={Plus} onClick={() => onChange([...rows, makeRow()])}>
            {addLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
