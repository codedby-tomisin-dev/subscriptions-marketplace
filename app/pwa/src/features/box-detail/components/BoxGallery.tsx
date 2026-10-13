"use client";

import { useState, type CSSProperties, type UIEvent } from "react";
import clsx from "clsx";
import { ProductImage } from "@/components/ui";
import { BoxIcon, type Box } from "@/features/catalog";
import { toneSurface } from "@/shared/types";
import styles from "./BoxDetail.module.css";

/** Art-direction notes for the unboxing shots that follow the hero photo. */
const SUPPORTING_SHOTS = ["Lid off, hands lifting the tissue", "Everything laid out, top-down", "In use, warm evening light"];

/** The photo gallery and the box's quick facts underneath it. */
export function BoxGallery({ box }: { box: Box }) {
  const shots = [{ src: box.image, label: box.shotDescription }, ...SUPPORTING_SHOTS.map((label) => ({ src: undefined, label }))];
  const [selected, setSelected] = useState(0);
  const [swiped, setSwiped] = useState(0);
  const tint = toneSurface(box.tone);

  const onSwipe = (event: UIEvent<HTMLDivElement>) => {
    const track = event.currentTarget;
    setSwiped(Math.round(track.scrollLeft / track.clientWidth));
  };

  return (
    <section className={`bb-rise ${styles.showcase}`} style={{ "--tint": tint } as CSSProperties}>
      {/* Phones swipe through full-width photos; wide screens pick from thumbnails. */}
      <div className={styles.carousel}>
        <div className={styles.track} onScroll={onSwipe}>
          {shots.map((shot) => (
            <div key={shot.label} className={styles.slide}>
              <ProductImage
                src={shot.src}
                alt={`${box.name} box — ${shot.label}`}
                tone={box.tone}
                ratio="1 / 1"
                radius="var(--radius-2xl)"
                label={shot.label}
                background={tint}
                sizes="100vw"
              />
            </div>
          ))}
        </div>
        <div className={styles.dots} aria-hidden>
          {shots.map((shot, index) => (
            <span key={shot.label} className={clsx(index === swiped && styles.dotOn)} />
          ))}
        </div>
      </div>
      <div className={styles.gallery}>
        <ProductImage
          key={selected}
          src={shots[selected].src}
          alt={`${box.name} box — ${shots[selected].label}`}
          tone={box.tone}
          ratio="4 / 3"
          radius="var(--radius-2xl)"
          label={shots[selected].label}
          background={tint}
          sizes="(max-width: 860px) 100vw, 60vw"
        />
        <div className={styles.thumbs}>
          {shots.map((shot, index) => (
            <button
              key={shot.label}
              type="button"
              aria-label={`Show photo ${index + 1}: ${shot.label}`}
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
              className={clsx(styles.thumb, selected === index && styles.thumbSelected)}
            >
              <ProductImage src={shot.src} tone={box.tone} ratio="1 / 1" radius="var(--radius-md)" sizes="72px" />
            </button>
          ))}
        </div>
      </div>
      {box.facts.length > 0 && (
        <ul className={styles.facts}>
          {box.facts.map(({ icon, label }) => (
            <li key={label}>
              <span className={styles.factIcon}>
                <BoxIcon name={icon} size={20} />
              </span>
              {label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
