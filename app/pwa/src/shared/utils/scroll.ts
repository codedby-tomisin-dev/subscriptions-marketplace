/** Smooth-scrolls so `element` sits `offset` px below the top (clears the sticky nav). */
export function scrollToElement(element: HTMLElement | null, offset: number) {
  if (!element) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({
    top: element.getBoundingClientRect().top + window.scrollY - offset,
    behavior: reduceMotion ? "auto" : "smooth",
  });
}
