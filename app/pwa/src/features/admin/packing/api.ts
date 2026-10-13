import { callFunction } from "@/shared/api";

export type PackerStatus = "packed" | "labelled" | "shipped";

export function updateOrderStatus(orderIds: string[], status: PackerStatus) {
  return callFunction<{ orderIds: string[]; status: PackerStatus }, { updated: string[] }>("admin_update_order_status", { orderIds, status });
}
