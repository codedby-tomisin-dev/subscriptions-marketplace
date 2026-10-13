import Link from "next/link";
import clsx from "clsx";
import { ArrowUpRight } from "lucide-react";
import { ProductImage } from "@/components/ui";
import { toneSurface } from "@/shared/types";
import { formatPrice } from "@/shared/utils";
import type { Box } from "../types";
import styles from "./BoxTile.module.css";

interface BoxTileProps {
  box: Box;
  /** Position in the row; staggers the reveal animation. */
  index: number;
  /** Vertical nudge for the playful staggered row on the home page. */
  offset?: number;
}

export function BoxTile({ box, index, offset = 0 }: BoxTileProps) {
  return (
    <Link
      href={`/boxes/${box.id}`}
      className={clsx(styles.tile, "bb-rise")}
      style={{ marginTop: offset, animationDelay: `${120 + index * 60}ms`, background: toneSurface(box.tone) }}
    >
      <ProductImage
        src={box.image}
        alt={`${box.name} box`}
        tone={box.tone}
        ratio="1 / 1"
        radius="var(--radius-lg)"
        label={box.shotDescription}
        background="var(--cream-0)"
        sizes="(max-width: 760px) 42vw, 20vw"
      >
        <span className={styles.go} aria-hidden>
          <ArrowUpRight size={18} />
        </span>
      </ProductImage>
      <div className={styles.foot}>
        <span className={styles.name}>{box.name}</span>
        <span className={styles.audience}>{box.audience}</span>
        <span className={styles.price}>
          <small>from</small>{formatPrice(box.prices.week)}
        </span>
      </div>
    </Link>
  );
}
