import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { firestore } from "@/shared/api";

export interface ActivityEvent {
  id: string;
  customerId: string;
  subscriptionId: string | null;
  type: string;
  actor: string;
  data: Record<string, string | number | boolean | null | undefined>;
  at: string;
}

/** A customer's latest events, newest first (admins only). */
export function watchCustomerEvents(customerId: string, count: number, onChange: (events: ActivityEvent[]) => void) {
  return onSnapshot(
    query(collection(firestore(), "events"), where("customerId", "==", customerId), orderBy("at", "desc"), limit(count)),
    (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ActivityEvent)),
    () => onChange([]),
  );
}
