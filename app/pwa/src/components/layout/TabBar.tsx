"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Package, Store } from "lucide-react";
import { useSubscriptions } from "@/features/subscriptions";
import styles from "./TabBar.module.css";

/** Phone-only floating tabs. Box pages hide it; their buy bar takes the spot. */
export function TabBar() {
  const pathname = usePathname();
  const { subscriptions } = useSubscriptions();
  const activeCount = subscriptions.filter((subscription) => subscription.status === "active").length;
  if (pathname.startsWith("/boxes/")) return null;

  const tabs = [
    { href: "/", icon: Store, label: "Shop", current: pathname === "/" },
    { href: "/account", icon: Package, label: "My boxes", current: pathname.startsWith("/account"), count: activeCount },
  ];

  return (
    <nav className={styles.bar} aria-label="Tabs">
      {tabs.map(({ href, icon: Icon, label, current, count }) => (
        <Link key={href} href={href} className={clsx(styles.tab, current && styles.current)} aria-current={current ? "page" : undefined}>
          <Icon size={20} aria-hidden />
          <span>{label}</span>
          {!!count && (
            <b className={styles.count} aria-label={`${count} active`}>
              {count}
            </b>
          )}
        </Link>
      ))}
    </nav>
  );
}
