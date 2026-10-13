import type { Metadata } from "next";
import { BoxEditorContainer } from "@/features/admin/boxes";

export const metadata: Metadata = { title: "Edit box" };

export default async function EditBoxPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BoxEditorContainer key={id} boxId={id} />;
}
