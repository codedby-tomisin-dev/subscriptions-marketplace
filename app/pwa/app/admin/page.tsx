import type { Metadata } from "next";
import { OverviewContainer } from "@/features/admin/overview";

export const metadata: Metadata = { title: "Overview" };

export default function AdminOverviewPage() {
  return <OverviewContainer />;
}
