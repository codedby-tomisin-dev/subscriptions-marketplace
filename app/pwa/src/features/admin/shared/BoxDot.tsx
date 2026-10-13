import { useCatalog } from "@/features/catalog";
import styles from "./BoxDot.module.css";

/** A box's colour dot, optionally with its name. */
export function BoxDot({ boxId, showName = true }: { boxId: string; showName?: boolean }) {
  const box = useCatalog().getBox(boxId);
  if (!box) return <span>{boxId}</span>;
  return (
    <span className={styles.boxDot}>
      <span className={styles.dot} style={{ background: boxColor(box.tone) }} aria-hidden />
      {showName && box.name}
    </span>
  );
}

export const boxColor = (tone: string) => `var(--${tone}-300)`;
