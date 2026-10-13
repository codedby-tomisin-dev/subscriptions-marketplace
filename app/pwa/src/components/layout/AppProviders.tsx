"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui";
import { AuthProvider } from "@/features/auth";
import { CatalogProvider } from "@/features/catalog";
import { SubscriptionsProvider } from "@/features/subscriptions";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <CatalogProvider>
          <SubscriptionsProvider>{children}</SubscriptionsProvider>
        </CatalogProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
