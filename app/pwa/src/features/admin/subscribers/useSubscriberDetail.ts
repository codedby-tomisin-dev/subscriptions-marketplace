import { useEffect, useState } from "react";
import { watchCustomerOrders, type Order } from "@/features/orders";
import { watchSubscriptions, type Subscription } from "@/features/subscriptions";
import { watchCustomerEvents, type ActivityEvent } from "./api";

const ACTIVITY_COUNT = 8;

interface Detail {
  customerId: string;
  subscriptions: Subscription[] | null;
  orders: Order[];
  events: ActivityEvent[];
}

/** Live subscriptions, orders and recent activity for the subscriber open in the drawer. */
export function useSubscriberDetail(customerId: string | null) {
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    if (!customerId) return;
    const update = (patch: Partial<Detail>) =>
      setDetail((current) => ({ ...(current?.customerId === customerId ? current : { customerId, subscriptions: null, orders: [], events: [] }), ...patch }));
    const stops = [
      watchSubscriptions(customerId, (subscriptions) => update({ subscriptions }), () => update({ subscriptions: [] })),
      watchCustomerOrders(customerId, (orders) => update({ orders }), () => update({ orders: [] })),
      watchCustomerEvents(customerId, ACTIVITY_COUNT, (events) => update({ events })),
    ];
    return () => stops.forEach((stop) => stop());
  }, [customerId]);

  const current = detail?.customerId === customerId ? detail : null;
  return { subscriptions: current?.subscriptions ?? null, orders: current?.orders ?? [], events: current?.events ?? [] };
}
