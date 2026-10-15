import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { boxArt, lowestPrice, type Box, type PurchaseOption } from "@/features/catalog";
import type { SurfaceTone } from "@/shared/types";
import { formatPrice } from "@/shared/utils";

/** Link previews (Open Graph / X cards): 1200×630 PNGs, drawn on the server. */
export const PREVIEW_SIZE = { width: 1200, height: 630 };

// The card renderer can't read CSS variables, so the palette is spelled out (src/styles/tokens.css).
const TONES: Record<SurfaceTone, { surface: string; edge: string }> = {
  blush: { surface: "#FADFDA", edge: "#EFA295" },
  apricot: { surface: "#FFEFD2", edge: "#FFD48A" },
  sage: { surface: "#E6EFE1", edge: "#BCD3B3" },
  plum: { surface: "#F1E2EA", edge: "#C99AB2" },
  lilac: { surface: "#ECE7F6", edge: "#C9BCE6" },
  cream: { surface: "#F5ECE1", edge: "#D9C4AB" },
};
const INK = "#1F1713";
const MUTED = "#6B5B51";
const ACCENT = "#C24E3A";
const PAPER = "#FFFDFA";
const PER: Record<PurchaseOption, string> = { week: "a week", month: "a month", once: "for one box" };

// Bundled with the server code (next.config.ts traces this folder and public/illustrations).
const FONT_DIR = path.join(process.cwd(), "src/features/share/fonts");

async function fonts() {
  const [display, medium, semibold] = await Promise.all(
    ["FunnelDisplay-ExtraBold.ttf", "Figtree-Medium.ttf", "Figtree-SemiBold.ttf"].map((file) => readFile(path.join(FONT_DIR, file))),
  );
  return [
    { name: "Funnel Display", data: display, weight: 800 as const, style: "normal" as const },
    { name: "Figtree", data: medium, weight: 500 as const, style: "normal" as const },
    { name: "Figtree", data: semibold, weight: 600 as const, style: "normal" as const },
  ];
}

/**
 * A box's illustration (or photo) as a PNG data URI. The launch boxes' are SVGs in /public and drawn
 * ones are WebP in Storage; neither renders in every preview, so both are converted. Null if it can't be read.
 */
async function pictureAsPng(src: string | null, size: number): Promise<string | null> {
  if (!src) return null;
  try {
    const bytes = src.startsWith("/")
      ? await readFile(path.join(process.cwd(), "public", path.normalize(src).replace(/^(\.\.[/\\])+/, "")))
      : Buffer.from(await (await fetch(src)).arrayBuffer());
    const png = await sharp(bytes, { density: 300 }).resize(size, size, { fit: "cover" }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

function Wordmark({ size = 34 }: { size?: number }) {
  return <span style={{ fontFamily: "Funnel Display", fontWeight: 800, fontSize: size, letterSpacing: "-0.04em", color: INK }}>bonbon</span>;
}

/** A box: its colour, its illustration on a tilted card, the pitch and where the price starts. */
export async function boxPreview(box: Box): Promise<ImageResponse> {
  const tone = TONES[box.tone] ?? TONES.blush;
  const picture = await pictureAsPng(boxArt(box), 720);
  const from = lowestPrice(box);
  const pitchSize = box.pitch.length > 34 ? 64 : 76;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 56, padding: "64px 72px", background: tone.surface }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}>
          <Wordmark />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 22 }}>
            <span style={{ fontFamily: "Figtree", fontWeight: 600, fontSize: 22, letterSpacing: "0.12em", textTransform: "uppercase", color: ACCENT }}>
              {`${box.name} box · ${box.audience.toLowerCase()}`}
            </span>
            <span style={{ fontFamily: "Funnel Display", fontWeight: 800, fontSize: pitchSize, lineHeight: 1.02, letterSpacing: "-0.035em", color: INK }}>
              {box.pitch}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: "Figtree", fontWeight: 500, fontSize: 24, color: MUTED }}>from</span>
            <span style={{ fontFamily: "Funnel Display", fontWeight: 800, fontSize: 52, letterSpacing: "-0.04em", color: INK }}>{formatPrice(from.pence)}</span>
            <span style={{ fontFamily: "Figtree", fontWeight: 500, fontSize: 24, color: MUTED }}>{PER[from.option]}</span>
          </div>
        </div>
        {picture && (
          <div
            style={{
              display: "flex",
              width: 430,
              height: 430,
              flexShrink: 0,
              padding: 0,
              borderRadius: 40,
              border: `8px solid ${tone.edge}`,
              background: PAPER,
              overflow: "hidden",
              transform: "rotate(3deg)",
              boxShadow: "0 24px 48px rgba(74, 44, 30, 0.16)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG, not a page */}
            <img src={picture} width={414} height={414} alt="" style={{ width: "100%", height: "100%" }} />
          </div>
        )}
      </div>
    ),
    { ...PREVIEW_SIZE, fonts: await fonts() },
  );
}

/** The shop: the headline and a fan of box illustrations. */
export async function sitePreview(boxes: Box[]): Promise<ImageResponse> {
  const shown = boxes.slice(0, 5);
  const pictures = await Promise.all(shown.map((box) => pictureAsPng(boxArt(box), 360)));
  const tilts = [-6, 3, -2, 5, -3];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "60px 72px", background: PAPER }}>
        <Wordmark />
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 34 }}>
          <span style={{ fontFamily: "Funnel Display", fontWeight: 800, fontSize: 84, lineHeight: 1, letterSpacing: "-0.04em", color: INK }}>
            Little boxes of joy, delivered on repeat.
          </span>
          <span style={{ fontFamily: "Figtree", fontWeight: 500, fontSize: 28, color: MUTED }}>
            Romance, self-care, beauty, snacks and home, as often as you’d like.
          </span>
        </div>
        <div style={{ display: "flex", gap: 28, marginTop: "auto" }}>
          {shown.map((box, i) => {
            const tone = TONES[box.tone] ?? TONES.blush;
            const picture = pictures[i];
            return (
              <div
                key={box.id}
                style={{
                  display: "flex",
                  width: 176,
                  height: 176,
                  borderRadius: 28,
                  padding: 6,
                  background: tone.surface,
                  border: `5px solid ${tone.edge}`,
                  transform: `rotate(${tilts[i % tilts.length]}deg)`,
                }}
              >
                {picture && (
                  // eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG, not a page
                  <img src={picture} width={154} height={154} alt="" style={{ width: "100%", height: "100%", borderRadius: 20 }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    ),
    { ...PREVIEW_SIZE, fonts: await fonts() },
  );
}
