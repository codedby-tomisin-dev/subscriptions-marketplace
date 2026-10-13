import clsx from "clsx";
import type { ReactNode } from "react";
import styles from "./Tag.module.css";

interface TagProps {
  selected?: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** Selectable pill chip — toggles via aria-pressed. */
export function Tag({ selected = false, onClick, children }: TagProps) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={clsx(styles.tag, selected && styles.selected)}>
      {children}
    </button>
  );
}
