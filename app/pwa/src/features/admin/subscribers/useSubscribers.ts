import { useEffect, useMemo, useState } from "react";
import { watchAllCustomers, type Customer } from "@/features/customers";
import type { Cadence } from "@/features/catalog";
import { useCatalog } from "@/features/catalog";
import type { SubscriptionStatus } from "@/features/subscriptions";
import { downloadCsv, toISODate } from "@/shared/utils";

export type StatusFilter = SubscriptionStatus | "all";
export type CadenceFilter = Cadence | "all";

function matches(customer: Customer, status: StatusFilter, cadence: CadenceFilter, search: string) {
  if (customer.overallStatus === "none") return false;
  if (status !== "all" && customer.overallStatus !== status) return false;
  if (cadence !== "all" && !customer.subscriptionSummary.some((sub) => sub.cadence === cadence && sub.status !== "cancelled")) return false;
  return !search || `${customer.name ?? ""} ${customer.email} ${customer.city ?? ""}`.toLowerCase().includes(search.toLowerCase());
}

/** Every subscriber, live, with the list's filters. Fine client-side up to a few thousand. */
export function useSubscribers() {
  const { getBox } = useCatalog();
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [cadence, setCadence] = useState<CadenceFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => watchAllCustomers(setCustomers, () => setCustomers([])), []);

  const subscribers = useMemo(
    () => (customers ?? []).filter((customer) => customer.overallStatus !== "none").sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email)),
    [customers],
  );
  const rows = useMemo(() => subscribers.filter((customer) => matches(customer, status, cadence, search)), [subscribers, status, cadence, search]);
  const activeSubscriptions = useMemo(
    () => subscribers.reduce((sum, customer) => sum + customer.subscriptionSummary.filter((sub) => sub.status === "active").length, 0),
    [subscribers],
  );

  const exportCsv = () =>
    downloadCsv(
      `bonbon-subscribers-${toISODate(new Date())}.csv`,
      ["Name", "Email", "City", "Status", "Boxes", "Next box", "Member since", "Lifetime value (£)"],
      rows.map((customer) => [
        customer.name,
        customer.email,
        customer.city,
        customer.overallStatus,
        customer.subscriptionSummary
          .filter((sub) => sub.status !== "cancelled")
          .map((sub) => `${getBox(sub.boxId)?.name ?? sub.boxId} (${sub.cadence}ly, ${sub.status})`)
          .join("; "),
        customer.nextDelivery,
        customer.memberSince,
        (customer.ltvPence / 100).toFixed(2),
      ]),
    );

  return {
    isLoading: customers === null,
    subscribers,
    rows,
    activeSubscriptions,
    status,
    setStatus,
    cadence,
    setCadence,
    search,
    setSearch,
    exportCsv,
  };
}
