import { fetchActiveBoxes } from "@/features/catalog/api";
import { PREVIEW_SIZE, sitePreview } from "@/features/share";

export const revalidate = 3600;
export const size = PREVIEW_SIZE;
export const contentType = "image/png";
export const alt = "Bonbon: little boxes of joy, delivered on repeat";

export default async function SitePreviewImage() {
  return sitePreview(await fetchActiveBoxes());
}
