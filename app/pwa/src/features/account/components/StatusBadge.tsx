import { CircleCheck, CircleX, Package, PackageCheck, Pause, ReceiptText, Truck, type LucideIcon } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui";
import type { SubscriptionStatus } from "@/features/subscriptions";
import type { CustomerOrderStage } from "@/features/orders";

const STATUS_DISPLAY: Record<SubscriptionStatus | CustomerOrderStage, { tone: BadgeTone; icon: LucideIcon; label: string }> = {
  active: { tone: "sage", icon: CircleCheck, label: "Active" },
  paused: { tone: "apricot", icon: Pause, label: "Paused" },
  cancelled: { tone: "neutral", icon: CircleX, label: "Cancelled" },
  preparing: { tone: "blush", icon: Package, label: "Being packed" },
  transit: { tone: "apricot", icon: Truck, label: "On its way" },
  delivered: { tone: "sage", icon: PackageCheck, label: "Delivered" },
  refunded: { tone: "neutral", icon: ReceiptText, label: "Refunded" },
};

export function StatusBadge({ status }: { status: SubscriptionStatus | CustomerOrderStage }) {
  const { tone, icon, label } = STATUS_DISPLAY[status];
  return (
    <Badge tone={tone} icon={icon}>
      {label}
    </Badge>
  );
}
