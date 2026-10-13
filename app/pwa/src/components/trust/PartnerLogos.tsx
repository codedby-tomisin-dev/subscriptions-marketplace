import clsx from "clsx";
import styles from "./PartnerLogos.module.css";

/** Payment and delivery partner wordmarks, set in type until real logo files exist. */
export function PartnerLogos({ center = false }: { center?: boolean }) {
  return (
    <div className={clsx(styles.partners, center && styles.center)}>
      <span className={styles.partner}>
        <span className={styles.label}>Secure payments by</span>
        <span className={clsx(styles.mark, styles.stripe)}>stripe</span>
      </span>
      <span className={styles.divider} aria-hidden />
      <span className={styles.partner}>
        <span className={styles.label}>Delivered by</span>
        <span className={clsx(styles.mark, styles.royalMail)}>Royal Mail</span>
      </span>
    </div>
  );
}
