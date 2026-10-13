"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/features/auth";
import { watchSubscriptions } from "./api";
import type { Subscription } from "./types";

interface SubscriptionsContextValue {
  /** The signed-in customer's subscriptions, live from Firestore. Empty when signed out. */
  subscriptions: Subscription[];
  isLoading: boolean;
  loadError: boolean;
}

const SubscriptionsContext = createContext<SubscriptionsContextValue | null>(null);

interface LoadedSubscriptions {
  uid: string;
  subscriptions: Subscription[];
  failed: boolean;
}

export function SubscriptionsProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const uid = user?.uid ?? null;
  // Tagged with the uid it was loaded for, so a stale list never shows for another account.
  const [loaded, setLoaded] = useState<LoadedSubscriptions | null>(null);

  useEffect(() => {
    if (!uid) return;
    return watchSubscriptions(
      uid,
      (subscriptions) => setLoaded({ uid, subscriptions, failed: false }),
      () => setLoaded({ uid, subscriptions: [], failed: true }),
    );
  }, [uid]);

  const current = loaded && loaded.uid === uid ? loaded : null;
  const value = useMemo(
    () => ({
      subscriptions: current?.subscriptions ?? [],
      isLoading: authLoading || (!!uid && !current),
      loadError: current?.failed ?? false,
    }),
    [current, authLoading, uid],
  );

  return <SubscriptionsContext.Provider value={value}>{children}</SubscriptionsContext.Provider>;
}

export function useSubscriptions() {
  const context = useContext(SubscriptionsContext);
  if (!context) throw new Error("useSubscriptions must be used inside <SubscriptionsProvider>");
  return context;
}
