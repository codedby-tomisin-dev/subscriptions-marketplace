import { LoaderCircle } from "lucide-react";
import styles from "./ReportState.module.css";

/** Loading or error placeholder for a report that hasn't arrived. */
export function ReportState({ error }: { error: string | null }) {
  return error ? (
    <p className={styles.state} role="alert">
      Couldn’t load this: {error}
    </p>
  ) : (
    <p className={styles.state} role="status">
      <LoaderCircle size={18} className={styles.spinner} aria-hidden />
      Loading…
    </p>
  );
}
