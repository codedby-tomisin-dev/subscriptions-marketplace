import Link from "next/link";
import clsx from "clsx";
import { ArrowUpRight } from "lucide-react";
import { Badge, ProductImage } from "@/components/ui";
import { toneSurface } from "@/shared/types";
import { formatPrice } from "@/shared/utils";
import { boxArt, lowestPrice, type Box } from "../types";
import styles from "./BoxTile.module.css";

interface BoxTileProps {
  box: Box;
  /** Position in the row; staggers the reveal animation. */
  index: number;
  /** Vertical nudge for the playful staggered row on the home page. */
  offset?: number;
  /** On phones, the home page's lead tile: full width, landscape, badged. */
  featured?: boolean;
}

export function BoxTile({ box, index, offset = 0, featured = false }: BoxTileProps) {
  return (
    <Link
      href={`/boxes/${box.id}`}
      className={clsx(styles.tile, featured && styles.featured, "bb-rise")}
      style={{ marginTop: offset, animationDelay: `${120 + index * 60}ms`, background: toneSurface(box.tone) }}
    >
      <ProductImage
        src={boxArt(box)}
        alt={`${box.name} box illustration`}
        tone={box.tone}
        ratio="1 / 1"
        radius="var(--radius-lg)"
        label={`Illustration · ${box.name.toLowerCase()} box`}
        background="var(--cream-0)"
        sizes={featured ? "(max-width: 640px) 100vw, 20vw" : "(max-width: 640px) 50vw, (max-width: 760px) 42vw, 20vw"}
      >
        <span className={styles.go} aria-hidden>
          <ArrowUpRight size={18} />
        </span>
        {featured && (
          <Badge tone="blush" size="sm" className={styles.badge}>
            Most loved
          </Badge>
        )}
      </ProductImage>
      <div className={styles.foot}>
        <span className={styles.identity}>
          <span className={styles.name}>{box.name}</span>
          <span className={styles.audience}>{box.audience}</span>
        </span>
        <span className={styles.price}>
          <small>from</small>{formatPrice(lowestPrice(box).pence)}
        </span>
      </div>
    </Link>
  );
}
