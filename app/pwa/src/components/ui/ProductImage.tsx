import Image from "next/image";
import clsx from "clsx";
import { ImageIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { toneSurface, type SurfaceTone } from "@/shared/types";
import styles from "./ProductImage.module.css";

const PLACEHOLDER_ICON_COLOR: Record<SurfaceTone, string> = {
  blush: "var(--blush-400)",
  apricot: "var(--apricot-500)",
  sage: "var(--sage-500)",
  plum: "var(--plum-300)",
  lilac: "var(--lilac-300)",
  cream: "var(--cream-300)",
};

interface ProductImageProps {
  src?: string | null;
  alt?: string;
  tone?: SurfaceTone;
  /** Caption shown on the placeholder until real photography exists. */
  label?: string;
  ratio?: string;
  radius?: string | number;
  /** Background behind the placeholder; defaults to the tone tint. */
  background?: string;
  sizes?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function ProductImage({
  src,
  alt = "",
  tone = "blush",
  label,
  ratio = "4 / 5",
  radius = "var(--radius-lg)",
  background,
  sizes = "(max-width: 1000px) 100vw, 50vw",
  className,
  style,
  children,
}: ProductImageProps) {
  return (
    <div
      className={clsx(styles.frame, className)}
      style={{ aspectRatio: ratio, borderRadius: radius, background: background ?? toneSurface(tone), ...style }}
    >
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} className={styles.image} />
      ) : (
        <div className={styles.placeholder} role={alt ? "img" : undefined} aria-label={alt || undefined}>
          <ImageIcon size={28} color={PLACEHOLDER_ICON_COLOR[tone]} aria-hidden />
          {label && <span className={styles.label}>{label}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
