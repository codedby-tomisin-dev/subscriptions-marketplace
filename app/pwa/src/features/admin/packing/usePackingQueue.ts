import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui";
import { watchOrdersShippingBetween, type Order, type OrderStatus } from "@/features/orders";
import { describeError } from "@/shared/api";
import { shipDays } from "../shared";
import { updateOrderStatus, type PackerStatus } from "./api";

export const PACKING_STAGES = ["topack", "packed", "labelled", "shipped"] as const satisfies OrderStatus[];
export type PackingStage = (typeof PACKING_STAGES)[number];

const MOVE_LABEL: Record<PackerStatus, string> = {
  packed: "marked packed",
  labelled: "labelled with Royal Mail",
  shipped: "handed to Royal Mail",
};

const matchesSearch = (order: Order, search: string) =>
  !search || `${order.customerName} ${order.id} ${order.city}`.toLowerCase().includes(search.toLowerCase());

/** This week's packing queue: live orders by ship day, with filters and bulk status moves. */
export function usePackingQueue() {
  const { showToast } = useToast();
  const days = useMemo(() => shipDays(new Date()), []);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [day, setDay] = useState(days[0]);
  const [stage, setStage] = useState<PackingStage | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isMoving, setIsMoving] = useState(false);

  useEffect(
    () =>
      watchOrdersShippingBetween(days[0], days[days.length - 1], setOrders, () => {
        setOrders([]);
        showToast({ tone: "danger", title: "Couldn’t load the packing queue" });
      }),
    [days, showToast],
  );

  const live = useMemo(() => (orders ?? []).filter((order) => order.status !== "refunded"), [orders]);
  const forDay = useMemo(() => live.filter((order) => order.shipDate === day), [live, day]);
  const rows = useMemo(
    () => forDay.filter((order) => (!stage || order.status === stage) && matchesSearch(order, search)).sort((a, b) => a.id.localeCompare(b.id)),
    [forDay, stage, search],
  );

  const dayCounts = useMemo(() => Object.fromEntries(days.map((d) => [d, live.filter((order) => order.shipDate === d).length])), [days, live]);
  const stageCounts = useMemo(
    () => Object.fromEntries(PACKING_STAGES.map((s) => [s, forDay.filter((order) => order.status === s).length])) as Record<PackingStage, number>,
    [forDay],
  );

  const chooseDay = useCallback((next: string) => {
    setDay(next);
    setSelected(new Set());
  }, []);

  const toggle = useCallback((orderId: string, isOn: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (isOn) next.add(orderId);
      else next.delete(orderId);
      return next;
    });
  }, []);

  const toggleAll = useCallback((isOn: boolean) => setSelected(isOn ? new Set(rows.map((order) => order.id)) : new Set()), [rows]);

  const moveSelected = useCallback(
    async (status: PackerStatus) => {
      const ids = [...selected];
      setIsMoving(true);
      try {
        await updateOrderStatus(ids, status);
        showToast({ tone: "success", title: `${ids.length} order${ids.length > 1 ? "s" : ""} ${MOVE_LABEL[status]}` });
        setSelected(new Set());
      } catch (error) {
        showToast({ tone: "danger", title: "Nothing was changed", message: describeError(error) });
      } finally {
        setIsMoving(false);
      }
    },
    [selected, showToast],
  );

  return {
    isLoading: orders === null,
    days,
    day,
    chooseDay,
    dayCounts,
    stage,
    setStage,
    stageCounts,
    search,
    setSearch,
    rows,
    selected,
    toggle,
    toggleAll,
    allSelected: rows.length > 0 && rows.every((order) => selected.has(order.id)),
    moveSelected,
    isMoving,
  };
}
