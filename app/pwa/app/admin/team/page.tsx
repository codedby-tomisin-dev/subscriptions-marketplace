import type { Metadata } from "next";
import { TeamContainer } from "@/features/admin/team";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return <TeamContainer />;
}
