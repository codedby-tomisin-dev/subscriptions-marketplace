import type { Metadata } from "next";
import { StockContainer } from "@/features/admin/stock";

export const metadata: Metadata = { title: "Boxes & stock" };

export default function StockPage() {
  return <StockContainer />;
}
