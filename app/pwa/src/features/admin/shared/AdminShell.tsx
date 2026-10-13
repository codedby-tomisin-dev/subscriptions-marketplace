"use client";

import Link from "next/link";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Boxes, ExternalLink, HeartCrack, LayoutDashboard, LogOut, Package, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { IconButton } from "@/components/ui";
import { useAuth } from "@/features/auth";
import { BRAND_WORDMARK } from "@/constants";
import { AdminAccessGate } from "./AdminAccessGate";
import { useAdminNavCounts } from "./useAdminNavCounts";
import styles from "./AdminShell.module.css";

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  count?: "packing" | "subscribers";
}

const NAV: NavItem[] = [
  { href: "/admin", icon: LayoutDashboard, label: "Overview" },
  { href: "/admin/packing", icon: Package, label: "Packing queue", count: "packing" },
  { href: "/admin/subscribers", icon: Users, label: "Subscribers", count: "subscribers" },
  { href: "/admin/stock", icon: Boxes, label: "Boxes & stock" },
  { href: "/admin/cancellations", icon: HeartCrack, label: "Cancellations" },
  { href: "/admin/team", icon: ShieldCheck, label: "Team" },
];

const isCurrent = (href: string, pathname: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminAccessGate>
      <AdminLayout>{children}</AdminLayout>
    </AdminAccessGate>
  );
}

function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const counts = useAdminNavCounts(pathname);
  const { user, signOut } = useAuth();
  const displayName = user?.displayName || user?.email || "Admin";

  return (
    <div className={styles.shell}>
      <aside className={styles.side}>
        <div className={styles.brand}>
          <span className={styles.wordmark}>{BRAND_WORDMARK}</span>
          <span className={styles.ops}>Ops</span>
        </div>
        <nav className={styles.nav} aria-label="Admin">
          {NAV.map(({ href, icon: Icon, label, count }) => (
            <Link key={href} href={href} className={clsx(styles.navItem, isCurrent(href, pathname) && styles.current)} aria-current={isCurrent(href, pathname) ? "page" : undefined}>
              <Icon size={18} aria-hidden />
              {label}
              {count && counts[count] && <span className={styles.count}>{counts[count]}</span>}
            </Link>
          ))}
        </nav>
        <div className={styles.foot}>
          <Link href="/" className={styles.storefront}>
            <ExternalLink size={16} aria-hidden />
            View storefront
          </Link>
          <div className={styles.me}>
            <span className={styles.avatar} aria-hidden>
              {displayName[0]?.toUpperCase()}
            </span>
            <div className={styles.meText}>
              <span className={styles.meName}>{displayName}</span>
              <span className={styles.meRole}>Operations</span>
            </div>
            <IconButton icon={LogOut} label="Sign out" variant="ghost" size="sm" onClick={signOut} style={{ marginLeft: "auto" }} />
          </div>
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
