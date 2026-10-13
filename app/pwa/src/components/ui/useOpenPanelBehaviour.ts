import { useEffect, useRef, type RefObject } from "react";

/**
 * Focus and Escape handling for Dialog and Drawer.
 *
 * Focus moves into the panel once, when it opens, and only if nothing inside
 * already has it (so an `autoFocus` field keeps focus). `onClose` is read
 * through a ref: callers often pass a fresh function each render, and
 * re-running the effect on every keystroke would pull focus out of inputs.
 */
export function useOpenPanelBehaviour(open: boolean, panelRef: RefObject<HTMLElement | null>, onClose: () => void) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus();
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open, panelRef]);
}
