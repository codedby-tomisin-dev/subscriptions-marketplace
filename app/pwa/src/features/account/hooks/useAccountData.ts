import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth";
import { watchCustomer, type Customer } from "@/features/customers";
import { watchCustomerOrders, type Order } from "@/features/orders";

interface Loaded<T> {
  uid: string;
  value: T;
}

/** The signed-in customer's profile and order history, live. */
export function useAccountData() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  // Tagged with the uid they were loaded for, so another account's data never flashes up.
  const [customer, setCustomer] = useState<Loaded<Customer | null> | null>(null);
  const [orders, setOrders] = useState<Loaded<Order[]> | null>(null);

  useEffect(() => {
    if (!uid) return;
    const stopCustomer = watchCustomer(uid, (value) => setCustomer({ uid, value }));
    const stopOrders = watchCustomerOrders(
      uid,
      (value) => setOrders({ uid, value }),
      () => setOrders({ uid, value: [] }),
    );
    return () => {
      stopCustomer();
      stopOrders();
    };
  }, [uid]);

  return {
    customer: customer?.uid === uid ? customer.value : null,
    orders: orders?.uid === uid ? orders.value : [],
  };
}
