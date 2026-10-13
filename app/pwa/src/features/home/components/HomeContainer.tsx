"use client";

import { useRef } from "react";
import { ArrowRight, HeartHandshake, MessageCircle, Package, Repeat } from "lucide-react";
import { Button } from "@/components/ui";
import { PartnerLogos, Stars, STORE_RATING } from "@/components/trust";
import { BoxTile, type Box } from "@/features/catalog";
import { scrollToElement } from "@/shared/utils";
import { AnimatedHeadline } from "@/components/typography";
import styles from "./Home.module.css";

const HEADLINE = "Little joys, delivered on repeat.";
/** Playful vertical stagger for the five tiles on wide screens. */
const TILE_OFFSETS = [8, 0, 14, 2, 10];
const REASSURANCES = [
  { icon: HeartHandshake, label: "Real people to help you choose" },
  { icon: Package, label: "Physical boxes, packed by hand" },
  { icon: Repeat, label: "Your rhythm. Cancel in two taps" },
];

export function HomeContainer({ boxes }: { boxes: Box[] }) {
  const boxRowRef = useRef<HTMLDivElement>(null);

  return (
    <main className={`bb-container ${styles.page}`}>
      <div className={`bb-rise ${styles.intro}`}>
        <h1 className="bb-display">
          <AnimatedHeadline text={HEADLINE} />
        </h1>
        <p className="bb-lede" style={{ maxWidth: 560 }}>
          Romance, self-care, beauty, snacks and home — arriving as often as you’d like. Not sure which one’s you? That’s
          what we’re here for.
        </p>
        <div className={styles.ctas}>
          <Button size="lg" iconRight={ArrowRight} onClick={() => scrollToElement(boxRowRef.current, 100)}>
            Browse all boxes
          </Button>
          <Button size="lg" variant="secondary" iconLeft={MessageCircle}>
            Help me pick
          </Button>
        </div>
        <div className={styles.rating}>
          <Stars value={STORE_RATING.score} />
          <span>
            <b>{STORE_RATING.score}</b> from {STORE_RATING.boxesDelivered} boxes delivered
          </span>
        </div>
      </div>

      <div ref={boxRowRef} className={styles.boxRow}>
        {boxes.map((box, index) => (
          <BoxTile key={box.id} box={box} index={index} offset={TILE_OFFSETS[index] ?? 0} />
        ))}
      </div>

      <ul className={styles.reassurances}>
        {REASSURANCES.map(({ icon: Icon, label }) => (
          <li key={label}>
            <Icon size={16} aria-hidden />
            {label}
          </li>
        ))}
      </ul>
      <div className={styles.partners}>
        <PartnerLogos center />
      </div>
    </main>
  );
}
