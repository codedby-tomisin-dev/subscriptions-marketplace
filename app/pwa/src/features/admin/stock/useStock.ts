import { useCallback, useState } from "react";
import { useToast } from "@/components/ui";
import { describeError } from "@/shared/api";
import { createReorder, getStock } from "../api";
import { useAdminReport } from "../useAdminReport";

export function useStock() {
  const report = useAdminReport(getStock);
  const { showToast } = useToast();
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const reorder = useCallback(
    async (itemId: string) => {
      setReorderingId(itemId);
      try {
        const draft = await createReorder(itemId);
        showToast({ tone: "success", title: "Reorder drafted", message: `${draft.quantity} × ${draft.itemName}` });
      } catch (error) {
        showToast({ tone: "danger", title: "Couldn’t draft that reorder", message: describeError(error) });
      } finally {
        setReorderingId(null);
      }
    },
    [showToast],
  );

  return { ...report, reorder, reorderingId };
}
