import type { Metadata } from "next";
import { SubscribersContainer } from "@/features/admin/subscribers";

export const metadata: Metadata = { title: "Subscribers" };

export default function SubscribersPage() {
  return <SubscribersContainer />;
}
