import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { APP_NAME } from "@/constants";
import { BoxDetailContainer } from "@/features/box-detail";
import { fetchActiveBoxes, fetchBox } from "@/features/catalog";

// Catalog edits in the admin show up within a minute; new boxes render on first visit.
export const revalidate = 60;

interface BoxPageProps {
  params: Promise<{ id: string }>;
}

const loadBox = cache(fetchBox);

export async function generateStaticParams() {
  return (await fetchActiveBoxes()).map((box) => ({ id: box.id }));
}

export async function generateMetadata({ params }: BoxPageProps): Promise<Metadata> {
  const box = await loadBox((await params).id);
  if (!box) return {};
  const title = `${box.name} box — ${box.pitch}`;
  const url = `/boxes/${box.id}`;
  // The preview image is this route's opengraph-image.tsx: the box's illustration on its colour.
  return {
    title: `${box.name} box`,
    description: box.story,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title, description: box.story, siteName: APP_NAME, locale: "en_GB" },
    twitter: { card: "summary_large_image", title, description: box.story },
  };
}

export default async function BoxPage({ params }: BoxPageProps) {
  const { id } = await params;
  const [box, boxes] = await Promise.all([loadBox(id), fetchActiveBoxes()]);
  if (!box || box.status !== "active") notFound();
  return <BoxDetailContainer key={id} box={box} otherBoxes={boxes.filter((other) => other.id !== id)} />;
}
