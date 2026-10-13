import type { Metadata } from "next";
import { AdminShell } from "@/features/admin/shared";

export const metadata: Metadata = {
  title: { template: "%s · Bonbon Ops", default: "Bonbon Ops" },
  robots: { index: false },
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminShell>{children}</AdminShell>;
}
