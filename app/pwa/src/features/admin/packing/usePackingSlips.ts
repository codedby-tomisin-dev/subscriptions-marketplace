import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getCustomers, type Customer } from "@/features/customers";
import { watchOrdersShippingBetween, type Order } from "@/features/orders";
import { toISODate } from "@/shared/utils";

export interface PackingSlip {
  order: Order;
  customer: Customer | null;
}

/** Slips for every unrefunded order shipping on `?date=`, with the customer's address. */
export function usePackingSlips() {
  const date = useSearchParams().get("date") ?? toISODate(new Date());
  const [slips, setSlips] = useState<PackingSlip[] | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const stop = watchOrdersShippingBetween(
      date,
      date,
      async (orders) => {
        const live = orders.filter((order) => order.status !== "refunded").sort((a, b) => a.id.localeCompare(b.id));
        const customers = await getCustomers(live.map((order) => order.customerId));
        const byId = new Map(customers.map((customer) => [customer.id, customer]));
        if (isCurrent) setSlips(live.map((order) => ({ order, customer: byId.get(order.customerId) ?? null })));
      },
      () => isCurrent && setSlips([]),
    );
    return () => {
      isCurrent = false;
      stop();
    };
  }, [date]);

  return { date, slips };
}
