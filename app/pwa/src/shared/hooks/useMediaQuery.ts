import { useCallback, useSyncExternalStore } from "react";

/** Phones get the app-style layout: tab bar, bottom sheets, swipe galleries. Keep in step with the CSS. */
export const PHONE_QUERY = "(max-width: 640px)";

/** Live match for a media query. False while server rendering, so CSS should hide whatever must not flash. */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useIsPhone = () => useMediaQuery(PHONE_QUERY);
