import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { firestore } from "@/shared/api";
import type { Customer } from "./types";

const toCustomer = (id: string, data: object) => ({ id, ...data }) as Customer;

/** One customer's profile. Calls back with null until checkout has created it. */
export function watchCustomer(uid: string, onChange: (customer: Customer | null) => void) {
  return onSnapshot(
    doc(firestore(), "customers", uid),
    (snapshot) => onChange(snapshot.exists() ? toCustomer(snapshot.id, snapshot.data()) : null),
    () => onChange(null),
  );
}

/** Every customer (admins only), live. Filtering happens client-side; fine up to a few thousand. */
export function watchAllCustomers(onChange: (customers: Customer[]) => void, onError: (error: Error) => void) {
  return onSnapshot(
    collection(firestore(), "customers"),
    (snapshot) => onChange(snapshot.docs.map((item) => toCustomer(item.id, item.data()))),
    onError,
  );
}

/** A one-off read of several customers (admins only), e.g. addresses for packing slips. */
export async function getCustomers(uids: string[]): Promise<Customer[]> {
  const snapshots = await Promise.all([...new Set(uids)].map((uid) => getDoc(doc(firestore(), "customers", uid))));
  return snapshots.filter((snapshot) => snapshot.exists()).map((snapshot) => toCustomer(snapshot.id, snapshot.data()));
}
