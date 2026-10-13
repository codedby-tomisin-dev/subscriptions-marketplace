/** Pastel families from the Bonbon palette; each has a `--{tone}-100` surface tint. */
export type SurfaceTone = "blush" | "apricot" | "sage" | "plum" | "lilac" | "cream";

export const toneSurface = (tone: SurfaceTone) => `var(--${tone}-100)`;
