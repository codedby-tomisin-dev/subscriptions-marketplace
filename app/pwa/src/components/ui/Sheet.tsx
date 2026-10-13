"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { useOpenPanelBehaviour } from "./useOpenPanelBehaviour";
import styles from "./Sheet.module.css";

/** How long the slide-down runs before the sheet unmounts. */
const CLOSE_MS = 340;

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name; the sheet's own heading is usually enough to show. */
  label: string;
  children: ReactNode;
}

/** A panel that slides up from the bottom of a phone screen, over a blurred scrim. */
export function Sheet({ open, onClose, label, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => setMounted(false), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useOpenPanelBehaviour(open && mounted, panelRef, onClose);

  if (!mounted) return null;

  return createPortal(
    <div className={clsx(styles.wrap, open && styles.open)}>
      <div className={styles.scrim} onClick={onClose} aria-hidden />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={styles.sheet}>
        <div className={styles.handle} aria-hidden />
        {children}
      </div>
    </div>,
    document.body,
  );
}
