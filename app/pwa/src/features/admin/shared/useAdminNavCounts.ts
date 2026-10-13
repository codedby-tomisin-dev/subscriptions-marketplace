import { useEffect, useState } from "react";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { firestore } from "@/shared/api";
import { compactCount, shipDays } from "./shipDays";

interface NavCounts {
  packing: string | null;
  subscribers: string | null;
}

async function loadCounts(): Promise<NavCounts> {
  const days = shipDays(new Date());
  const [packing, subscribers] = await Promise.all([
    getCountFromServer(
      query(
        collection(firestore(), "orders"),
        where("status", "in", ["topack", "packed", "labelled"]),
        where("shipDate", ">=", days[0]),
        where("shipDate", "<=", days[days.length - 1]),
      ),
    ),
    getCountFromServer(query(collection(firestore(), "customers"), where("overallStatus", "in", ["active", "paused", "cancelled"]))),
  ]);
  return { packing: compactCount(packing.data().count), subscribers: compactCount(subscribers.data().count) };
}

/** Badge counts for the sidebar: boxes still to ship this week, and subscribers. Refreshed per page. */
export function useAdminNavCounts(pathname: string): NavCounts {
  const [counts, setCounts] = useState<NavCounts>({ packing: null, subscribers: null });

  useEffect(() => {
    let isCurrent = true;
    loadCounts()
      .then((loaded) => isCurrent && setCounts(loaded))
      .catch(() => {
        // Counts are a nicety; the nav works without them.
      });
    return () => {
      isCurrent = false;
    };
  }, [pathname]);

  return counts;
}
