import type { Cadence } from "@/features/catalog";

/** Where an order is in the warehouse. Customers see a simpler version (see `customerOrderStage`). */
export type OrderStatus = "topack" | "packed" | "labelled" | "shipped" | "delivered" | "refunded";

/** `orders/{number}`, created by the backend when a box is charged. */
export interface Order {
  /** The order number, e.g. "BB-20450". */
  id: string;
  customerId: string;
  customerName: string;
  city: string;
  subscriptionId: string;
  boxId: string;
  cadence: Cadence;
  isGift: boolean;
  /** What goes in the box, recorded when it was charged. */
  items: string[];
  /** ISO date it arrives (or arrived). */
  deliveryDate: string;
  /** ISO date it leaves the warehouse; the packing queue is grouped by this. */
  shipDate: string;
  status: OrderStatus;
  pricePence: number;
  /** ISO date it was charged. */
  placedOn: string;
}

export type CustomerOrderStage = "preparing" | "transit" | "delivered" | "refunded";

export function customerOrderStage(status: OrderStatus): CustomerOrderStage {
  switch (status) {
    case "shipped":
      return "transit";
    case "delivered":
    case "refunded":
      return status;
    default:
      return "preparing";
  }
}
