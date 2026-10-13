import { collection, onSnapshot, orderBy, query, where, type QueryConstraint } from "firebase/firestore";
import { firestore } from "@/shared/api";
import type { Order } from "./types";

function watchOrders(constraints: QueryConstraint[], onChange: (orders: Order[]) => void, onError: (error: Error) => void) {
  return onSnapshot(
    query(collection(firestore(), "orders"), ...constraints),
    (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Order)),
    onError,
  );
}

/** One customer's orders, newest first. */
export function watchCustomerOrders(customerId: string, onChange: (orders: Order[]) => void, onError: (error: Error) => void) {
  return watchOrders([where("customerId", "==", customerId), orderBy("placedOn", "desc")], onChange, onError);
}

/** Every order shipping between two ISO dates, inclusive (admins only). */
export function watchOrdersShippingBetween(from: string, to: string, onChange: (orders: Order[]) => void, onError: (error: Error) => void) {
  return watchOrders([where("shipDate", ">=", from), where("shipDate", "<=", to)], onChange, onError);
}
