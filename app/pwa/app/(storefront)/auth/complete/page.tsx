import { Suspense } from "react";
import type { Metadata } from "next";
import { CompleteSignInContainer } from "@/features/auth";

export const metadata: Metadata = { title: "Signing in" };

export default function CompleteSignInPage() {
  // useSearchParams needs a Suspense boundary to prerender.
  return (
    <Suspense>
      <CompleteSignInContainer />
    </Suspense>
  );
}
