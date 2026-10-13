import { useCallback, useEffect, useState } from "react";
import { describeError } from "@/shared/api";

/** Loads one admin report from a callable, with a reload for after changes. */
export function useAdminReport<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    load()
      .then((report) => {
        if (!isCurrent) return;
        setData(report);
        setError(null);
      })
      .catch((reason) => isCurrent && setError(describeError(reason)));
    return () => {
      isCurrent = false;
    };
  }, [load, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  return { data, error, reload };
}
