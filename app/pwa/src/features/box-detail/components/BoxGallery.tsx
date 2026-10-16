"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Pause, Play } from "lucide-react";
import { IconButton, ProductImage } from "@/components/ui";
import { BoxIcon, boxArt, type Box } from "@/features/catalog";
import { useMediaQuery } from "@/shared/hooks";
import { toneSurface } from "@/shared/types";
import styles from "./BoxDetail.module.css";

/** The box's video (or, until it has one, its photo) and its quick facts underneath. */
export function BoxGallery({ box }: { box: Box }) {
  const tint = toneSurface(box.tone);

  return (
    <section className={`bb-rise ${styles.showcase}`} style={{ "--tint": tint } as CSSProperties}>
      <div className={styles.media}>
        {box.video ? (
          <BoxVideo src={box.video} poster={box.image ?? boxArt(box)} label={`${box.name} box, unboxed`} background={tint} />
        ) : (
          <ProductImage
            src={box.image}
            alt={`${box.name} box — ${box.shotDescription}`}
            tone={box.tone}
            ratio="var(--media-ratio)"
            radius="var(--radius-2xl)"
            label={box.shotDescription || box.name}
            background={tint}
            sizes="(max-width: 860px) 100vw, 60vw"
          />
        )}
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

/**
 * A silent, looping clip that plays by itself, with a button to pause it. People who've asked their
 * device for less motion get the first frame and a play button instead.
 */
function BoxVideo({ src, poster, label, background }: { src: string; poster: string | null; label: string; background: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (reduceMotion) element.pause();
    else element.play().catch(() => setIsPlaying(false)); // e.g. Low Power Mode blocks autoplay
  }, [reduceMotion, src]);

  const toggle = () => {
    const element = video.current;
    if (!element) return;
    if (element.paused) void element.play();
    else element.pause();
  };

  return (
    <div className={styles.videoFrame} style={{ background }}>
      <video
        ref={video}
        className={styles.video}
        src={src}
        poster={poster ?? undefined}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={label}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      <span className={styles.videoControl}>
        <IconButton icon={isPlaying ? Pause : Play} label={isPlaying ? "Pause video" : "Play video"} variant="glass" size="sm" onClick={toggle} />
      </span>
    </div>
  );
}
