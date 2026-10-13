import type { Metadata } from "next";
import { BoxEditorContainer } from "@/features/admin/boxes";

export const metadata: Metadata = { title: "New box" };

export default function NewBoxPage() {
  return <BoxEditorContainer boxId={null} />;
}
