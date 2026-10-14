import type { Metadata } from "next";
import { BoxEditorContainer } from "@/features/admin/boxes";

export const metadata: Metadata = { title: "New box" };

export default async function NewBoxPage({ searchParams }: { searchParams: Promise<{ generate?: string }> }) {
  const { generate } = await searchParams;
  return <BoxEditorContainer boxId={null} startGenerating={generate === "1"} />;
}
