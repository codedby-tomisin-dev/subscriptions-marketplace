import Link from "next/link";
import { AnimatedHeadline } from "@/components/typography";
import type { Box } from "@/features/catalog";
import { toneSurface } from "@/shared/types";
import styles from "./BoxDetail.module.css";

/** The tinted band at the top of the page: where you are, who it's for, and the pitch. */
export function BoxIntro({ box }: { box: Box }) {
  return (
    <section className={styles.intro} style={{ background: toneSurface(box.tone) }}>
      <div className={`bb-container ${styles.introCopy}`}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <Link href="/">All boxes</Link>
          <span aria-hidden>/</span>
          <span aria-current="page">{box.name}</span>
        </nav>
        <span className="bb-eyebrow">
          {box.name} box · {box.audience.toLowerCase()}
        </span>
        <h1 className="bb-display" style={{ fontSize: "clamp(40px, 5vw, 72px)" }}>
          <AnimatedHeadline text={box.pitch} />
        </h1>
        <p className="bb-lede" style={{ maxWidth: 560, color: "var(--text-body)" }}>
          {box.story}
        </p>
      </div>
    </section>
  );
}
