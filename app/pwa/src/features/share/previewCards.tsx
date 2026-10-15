import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
// From the module itself, not the feature index: that also exports styled components, and their CSS
// in a route handler's graph ends up in every page's main script bundle.
import { boxArt, lowestPrice, type Box, type PurchaseOption } from "@/features/catalog/types";
import type { SurfaceTone } from "@/shared/types";
import { formatPrice } from "@/shared/utils";

/** Link previews (Open Graph / X cards): 1200×630 PNGs, drawn on the server. */
export const PREVIEW_SIZE = { width: 1200, height: 630 };

// The card renderer can't read CSS variables, so the palette is spelled out (src/styles/tokens.css).
// `tilt` is how far the box's card leans, so neighbouring previews don't all lean the same way.
const TONES: Record<SurfaceTone, { surface: string; edge: string; tilt: number }> = {
  blush: { surface: "#FADFDA", edge: "#EFA295", tilt: -4 },
  apricot: { surface: "#FFEFD2", edge: "#FFD48A", tilt: 5 },
  sage: { surface: "#E6EFE1", edge: "#BCD3B3", tilt: 4 },
  plum: { surface: "#F1E2EA", edge: "#C99AB2", tilt: -5 },
  lilac: { surface: "#ECE7F6", edge: "#C9BCE6", tilt: -5 },
  cream: { surface: "#F5ECE1", edge: "#D9C4AB", tilt: 4 },
};
const INK = "#1F1713";
const BODY = "#4A3C34";
const MUTED = "#6B5B51";
const ACCENT = "#C24E3A";
const UNDERLINE = "#E8735F";
const PAPER = "#FFFDFA";
const PER: Record<PurchaseOption, string> = { week: "/ week", month: "/ month", once: "/ box" };
const COUNTS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

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

/** `share` of `hex` over paper, e.g. the copy side of a box card: its colour, washed out. */
function onPaper(hex: string, share: number): string {
  const channel = (from: string, i: number) => parseInt(from.slice(1 + i * 2, 3 + i * 2), 16);
  const mixed = [0, 1, 2].map((i) => Math.round(channel(hex, i) * share + channel(PAPER, i) * (1 - share)));
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
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

/** A box's illustration on a paper card edged in its colour. */
function Tile({ picture, edge, size, radius, tilt, style }: { picture: string | null; edge: string; size: number; radius: number; tilt: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: radius,
        border: `4px solid ${edge}`,
        background: PAPER,
        overflow: "hidden",
        transform: `rotate(${tilt}deg)`,
        ...style,
      }}
    >
      {picture && (
        // eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG, not a page
        <img src={picture} width={size - 8} height={size - 8} alt="" style={{ width: "100%", height: "100%" }} />
      )}
    </div>
  );
}

/** The left half of every card: wordmark at the top, the headline in the middle, a footnote at the bottom. */
function Copy({ children, foot }: { children: React.ReactNode; foot: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 48px 60px 72px" }}>
      <span style={{ fontFamily: "Funnel Display", fontWeight: 800, fontSize: 38, lineHeight: 1, letterSpacing: "-0.04em", color: INK }}>bonbon</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>{children}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>{foot}</div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <span style={{ flex: 1, minWidth: 0, fontFamily: "Figtree", fontWeight: 500, fontSize: 20, lineHeight: 1.35, color: BODY }}>{children}</span>;
}

/** A box: its pitch and price on a wash of its colour, its illustration on a tilted card. */
export async function boxPreview(box: Box): Promise<ImageResponse> {
  const tone = TONES[box.tone] ?? TONES.blush;
  const picture = await pictureAsPng(boxArt(box), 680);
  const from = lowestPrice(box);
  const pitchSize = box.pitch.length > 34 ? 64 : 76;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: onPaper(tone.surface, 0.45) }}>
        <Copy
          foot={[
            <div key="price" style={{ display: "flex", alignItems: "baseline", flexShrink: 0, gap: 6 }}>
              <span style={{ fontFamily: "Funnel Display", fontWeight: 800, fontSize: 40, lineHeight: 1, letterSpacing: "-0.04em", color: INK }}>
                {formatPrice(from.pence)}
              </span>
              <span style={{ fontFamily: "Figtree", fontWeight: 500, fontSize: 20, color: MUTED }}>{PER[from.option]}</span>
            </div>,
            <div key="dot" style={{ width: 6, height: 6, flexShrink: 0, borderRadius: 3, background: "rgba(31, 23, 19, 0.3)" }} />,
            <Note key="note">{`${box.audience.replace(/\.$/, "")}. Cancel anytime in two taps.`}</Note>,
          ]}
        >
          <span style={{ fontFamily: "Figtree", fontWeight: 600, fontSize: 17, lineHeight: 1, letterSpacing: "0.12em", textTransform: "uppercase", color: ACCENT }}>
            {`The ${box.name} box`}
          </span>
          <span style={{ fontFamily: "Funnel Display", fontWeight: 800, fontSize: pitchSize, lineHeight: 1.02, letterSpacing: "-0.035em", color: INK }}>
            {box.pitch}
          </span>
        </Copy>
        <div style={{ width: 500, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: tone.surface }}>
          <Tile picture={picture} edge={tone.edge} size={340} radius={32} tilt={tone.tilt} />
        </div>
      </div>
    ),
    { ...PREVIEW_SIZE, fonts: await fonts() },
  );
}

// The shop card's fan: the middle card on top, the outer ones lower and tucked behind.
const FAN = [
  { x: -130, y: 30, tilt: -12, layer: 1 },
  { x: -65, y: -10, tilt: -6, layer: 2 },
  { x: 0, y: -30, tilt: 0, layer: 3 },
  { x: 65, y: -10, tilt: 6, layer: 2 },
  { x: 130, y: 30, tilt: 12, layer: 1 },
];
const FAN_WIDTH = 520;
const MINI = 150;

/** The shop: the headline, what's on offer, and the boxes fanned out like a hand of cards. */
export async function sitePreview(boxes: Box[]): Promise<ImageResponse> {
  const shown = boxes.slice(0, FAN.length);
  const pictures = await Promise.all(shown.map((box) => pictureAsPng(boxArt(box), 300)));
  const weekly = boxes.flatMap((box) => (box.prices.week ? [box.prices.week] : []));
  const count = COUNTS[boxes.length] ?? String(boxes.length);
  const offer = `${count} ${boxes.length === 1 ? "box" : "boxes"}${weekly.length ? `, from ${formatPrice(Math.min(...weekly))} a week` : ""}.`;
  // The renderer has no z-index, so cards are drawn back to front.
  const fan = shown.map((box, i) => ({ box, picture: pictures[i], ...FAN[i] })).sort((a, b) => a.layer - b.layer);
  const headline = { fontFamily: "Funnel Display", fontWeight: 800, fontSize: 64, lineHeight: 1.02, letterSpacing: "-0.035em", color: INK } as const;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: onPaper(TONES.blush.surface, 0.45) }}>
        <Copy foot={<Note>{`${offer} Skip, swap or pause in a tap.`}</Note>}>
          <div style={{ display: "flex", flexDirection: "column", ...headline }}>
            <span>Little boxes of joy,</span>
            <span style={{ display: "flex" }}>
              delivered&nbsp;
              {/* Drawn rather than text-decoration, which can't be thickened or offset here. */}
              <span style={{ display: "flex", position: "relative" }}>
                <div style={{ position: "absolute", left: 0, right: 4, top: 64, height: 6, borderRadius: 3, background: UNDERLINE }} />
                on repeat.
              </span>
            </span>
          </div>
        </Copy>
        <div style={{ width: FAN_WIDTH, flexShrink: 0, display: "flex", position: "relative", background: TONES.blush.surface }}>
          {fan.map(({ box, picture, x, y, tilt }) => (
            <Tile
              key={box.id}
              picture={picture}
              edge={(TONES[box.tone] ?? TONES.blush).edge}
              size={MINI}
              radius={26}
              tilt={tilt}
              style={{ position: "absolute", left: (FAN_WIDTH - MINI) / 2 + x, top: (PREVIEW_SIZE.height - MINI) / 2 + y }}
            />
          ))}
        </div>
      </div>
    ),
    { ...PREVIEW_SIZE, fonts: await fonts() },
  );
}
