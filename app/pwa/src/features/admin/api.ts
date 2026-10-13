import { callFunction } from "@/shared/api";

/** Responses from the admin-only analytics and inventory functions (cloud/functions/modules/analytics). */

export interface HeadlineMetrics {
  activeSubscriptions: number;
  mrrPence: number;
  churnRate: number;
  weekly: number;
  monthly: number;
}

export type AttentionItem =
  | { kind: "low_stock"; itemId: string; name: string; boxId: string; stock: number; needed: number }
  | { kind: "failed_payments"; count: number; finalRetryCount: number; nextRetryAt: string | null };

export interface Overview {
  today: string;
  current: HeadlineMetrics;
  previous: (HeadlineMetrics & { date: string }) | null;
  shipping: { byDay: { date: string; total: number; shipped: number }[]; total: number; packed: number };
  mrrByBox: { boxId: string; mrrPence: number }[];
  cadenceByBox: Record<string, { week: number; month: number }>;
  attention: AttentionItem[];
}

export interface StockItem {
  itemId: string;
  name: string;
  boxId: string;
  stock: number;
  needed: number;
}

export interface StockReport {
  boxes: { boxId: string; weekly: number; monthly: number; items: StockItem[] }[];
  shortages: StockItem[];
}

export interface ChurnReport {
  reasons: { reason: string; percent: number }[];
  saves: { pausedInstead: number; switchedToMonthly: number; cancelledAnyway: number; percentSaved: number };
  recent: { customerId: string; name: string; boxId: string; reason: string; at: string; tenure: string | null }[];
}

export const getOverview = () => callFunction<Record<string, never>, Overview>("admin_get_overview", {});
export const getStock = () => callFunction<Record<string, never>, StockReport>("admin_get_stock", {});
export const getChurn = () => callFunction<Record<string, never>, ChurnReport>("admin_get_churn", {});
export const createReorder = (itemId: string) =>
  callFunction<{ itemId: string }, { id: string; itemName: string; quantity: number }>("admin_create_reorder", { itemId });
export const refundOrder = (orderId: string) =>
  callFunction<{ orderId: string }, { orderId: string; status: string }>("admin_refund_order", { orderId });
