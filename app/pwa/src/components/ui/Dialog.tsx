"use client";

import { useId, useRef, type ReactNode } from "react";
import { useOpenPanelBehaviour } from "./useOpenPanelBehaviour";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import styles from "./Dialog.module.css";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  footer?: ReactNode;
  width?: number;
  children?: ReactNode;
}

export function Dialog({ open, onClose, title, description, footer, width = 480, children }: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useOpenPanelBehaviour(open, panelRef, onClose);

  if (!open) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={styles.panel}
        style={{ maxWidth: width }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.close}>
          <IconButton icon={X} label="Close" variant="ghost" size="sm" onClick={onClose} />
        </div>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {description && <p className={styles.description}>{description}</p>}
        {children}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
