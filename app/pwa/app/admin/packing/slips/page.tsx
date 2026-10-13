import { Suspense } from "react";
import type { Metadata } from "next";
import { PackingSlipsContainer } from "@/features/admin/packing";

export const metadata: Metadata = { title: "Packing slips" };

export default function PackingSlipsPage() {
  // Reads ?date=, which needs a Suspense boundary to prerender.
  return (
    <Suspense>
      <PackingSlipsContainer />
    </Suspense>
  );
}
