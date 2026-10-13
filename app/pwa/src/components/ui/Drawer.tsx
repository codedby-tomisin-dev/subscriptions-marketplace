"use client";

import { useId, useRef, type ReactNode } from "react";
import { useOpenPanelBehaviour } from "./useOpenPanelBehaviour";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import styles from "./Drawer.module.css";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the panel; the visible heading is part of `children`. */
  label: string;
  children: ReactNode;
}

/** A panel that slides in from the right over a blurred scrim. */
export function Drawer({ open, onClose, label, children }: DrawerProps) {
  const labelId = useId();
  const panelRef = useRef<HTMLElement>(null);

  useOpenPanelBehaviour(open, panelRef, onClose);

  if (!open) return null;

  return createPortal(
    <>
      <div className={styles.scrim} onClick={onClose} />
      <aside ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={labelId} tabIndex={-1} className={styles.panel}>
        <span id={labelId} hidden>
          {label}
        </span>
        <div className={styles.close}>
          <IconButton icon={X} label="Close" variant="ghost" size="sm" onClick={onClose} />
        </div>
        {children}
      </aside>
    </>,
    document.body,
  );
}
