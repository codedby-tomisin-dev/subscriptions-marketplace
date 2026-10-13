import { useEffect, useState, type RefObject } from "react";

/** True while the buy panel is still below the viewport, so the bar can offer a shortcut to it. */
export function useStickyBuyBar(purchaseRef: RefObject<HTMLElement | null>) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const purchase = purchaseRef.current;
    if (!purchase) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(!entry.isIntersecting && entry.boundingClientRect.top > 0));
    observer.observe(purchase);
    return () => observer.disconnect();
  }, [purchaseRef]);

  return isVisible;
}
