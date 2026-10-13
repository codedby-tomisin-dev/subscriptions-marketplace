import { Package, PackageCheck, ReceiptText, Tag, Truck, type LucideIcon } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui";
import type { OrderStatus } from "@/features/orders";
import type { SubscriptionStatus } from "@/features/subscriptions";

export type AdminStatus = OrderStatus | SubscriptionStatus;

const DISPLAY: Record<AdminStatus, { tone: BadgeTone; icon?: LucideIcon; label: string }> = {
  topack: { tone: "neutral", icon: Package, label: "To pack" },
  packed: { tone: "blush", icon: PackageCheck, label: "Packed" },
  labelled: { tone: "apricot", icon: Tag, label: "Label printed" },
  shipped: { tone: "sage", icon: Truck, label: "Shipped" },
  delivered: { tone: "sage", icon: PackageCheck, label: "Delivered" },
  refunded: { tone: "neutral", icon: ReceiptText, label: "Refunded" },
  active: { tone: "sage", label: "Active" },
  paused: { tone: "apricot", label: "Paused" },
  cancelled: { tone: "neutral", label: "Cancelled" },
};

export const adminStatusLabel = (status: AdminStatus) => DISPLAY[status].label;

export function AdminBadge({ status }: { status: AdminStatus }) {
  const { tone, icon, label } = DISPLAY[status];
  return (
    <Badge tone={tone} icon={icon} size="sm">
      {label}
    </Badge>
  );
}
