import type { Metadata } from "next";
import { PackingQueueContainer } from "@/features/admin/packing";

export const metadata: Metadata = { title: "Packing queue" };

export default function PackingPage() {
  return <PackingQueueContainer />;
}
