import { notFound } from "next/navigation";
import { fetchBox } from "@/features/catalog/api";
import { boxPreview, PREVIEW_SIZE } from "@/features/share";

// Catalog edits (a new illustration, a price) reach previews within a minute, like the page.
export const revalidate = 60;
export const size = PREVIEW_SIZE;
export const contentType = "image/png";
export const alt = "A Bonbon box: its illustration, pitch and price";

export default async function BoxPreviewImage({ params }: { params: Promise<{ id: string }> }) {
  const box = await fetchBox((await params).id);
  if (!box || box.status !== "active") notFound();
  return boxPreview(box);
}
