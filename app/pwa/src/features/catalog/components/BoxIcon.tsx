import { Sparkles } from "lucide-react";
import { BOX_ICONS } from "../icons";

/** A box fact's icon, stored by name. Unknown names fall back to a sparkle. */
export function BoxIcon({ name, size = 20 }: { name: string; size?: number }) {
  const Icon = BOX_ICONS[name] ?? Sparkles;
  return <Icon size={size} aria-hidden />;
}
