import type { Metadata } from "next";
import { CancellationsContainer } from "@/features/admin/cancellations";

export const metadata: Metadata = { title: "Cancellations" };

export default function CancellationsPage() {
  return <CancellationsContainer />;
}
