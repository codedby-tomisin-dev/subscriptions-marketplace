"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { watchBoxes } from "./api";
import type { Box } from "./types";

interface CatalogContextValue {
  /** Every box, archived included, in display order. */
  boxes: Box[];
  /** The boxes on sale. */
  activeBoxes: Box[];
  getBox: (id: string) => Box | undefined;
  isLoading: boolean;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

/** The catalog, live, for client components (account, admin). Storefront pages fetch it on the server. */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [boxes, setBoxes] = useState<Box[] | null>(null);

  useEffect(() => watchBoxes(setBoxes, () => setBoxes([])), []);

  const byId = useMemo(() => new Map((boxes ?? []).map((box) => [box.id, box])), [boxes]);
  const getBox = useCallback((id: string) => byId.get(id), [byId]);
  const value = useMemo(
    () => ({
      boxes: boxes ?? [],
      activeBoxes: (boxes ?? []).filter((box) => box.status === "active"),
      getBox,
      isLoading: boxes === null,
    }),
    [boxes, getBox],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error("useCatalog must be used inside <CatalogProvider>");
  return context;
}
