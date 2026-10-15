import type { MetadataRoute } from "next";
import { SITE_URL } from "@/constants";
import { fetchActiveBoxes } from "@/features/catalog/api";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const boxes = await fetchActiveBoxes();
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...boxes.map((box) => ({ url: `${SITE_URL}/boxes/${box.id}`, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
