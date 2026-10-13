import type { Metadata } from "next";
import { AccountContainer } from "@/features/account";

export const metadata: Metadata = { title: "My subscriptions" };

export default function AccountPage() {
  return <AccountContainer />;
}
