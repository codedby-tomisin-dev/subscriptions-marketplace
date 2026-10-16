import clsx from "clsx";
import styles from "./PartnerLogos.module.css";

interface PartnerLogosProps {
  center?: boolean;
  /** Just the logos, without "Secure payments by" / "Delivered by", e.g. on the buy card. */
  bare?: boolean;
}

/** Payment and delivery partner wordmarks, set in type until real logo files exist. */
export function PartnerLogos({ center = false, bare = false }: PartnerLogosProps) {
  return (
    <div className={clsx(styles.partners, (center || bare) && styles.center)}>
      <span className={styles.partner}>
        {!bare && <span className={styles.label}>Secure payments by</span>}
        <span className={clsx(styles.mark, styles.stripe)} title="Payments by Stripe">
          stripe
        </span>
      </span>
      <span className={styles.divider} aria-hidden />
      <span className={styles.partner}>
        {!bare && <span className={styles.label}>Delivered by</span>}
        <span className={clsx(styles.mark, styles.royalMail)} title="Delivered by Royal Mail">
          Royal Mail
        </span>
      </span>
    </div>
  );
}
