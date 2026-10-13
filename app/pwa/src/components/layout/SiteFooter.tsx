import { PartnerLogos } from "@/components/trust";
import { BRAND_NAME, BRAND_WORDMARK } from "@/constants";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`bb-container ${styles.inner}`}>
        <div className={styles.brand}>
          <span className={styles.wordmark}>{BRAND_WORDMARK}</span>
          <span className={styles.tagline}>Little boxes of joy, packed by hand.</span>
        </div>
        <div className={styles.meta}>
          <PartnerLogos />
          <span className={styles.copyright}>
            © {new Date().getFullYear()} {BRAND_NAME}. Made with tissue paper and good intentions.
          </span>
        </div>
      </div>
    </footer>
  );
}
