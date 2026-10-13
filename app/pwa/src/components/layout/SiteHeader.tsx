"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, User } from "lucide-react";
import { IconButton } from "@/components/ui";
import { BRAND_WORDMARK } from "@/constants";
import { useAuth } from "@/features/auth";
import { useSubscriptions } from "@/features/subscriptions";
import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  const pathname = usePathname();
  const { user, isLoading, openSignIn } = useAuth();
  const { subscriptions } = useSubscriptions();
  const activeCount = subscriptions.filter((subscription) => subscription.status === "active").length;

  return (
    <header className={styles.header}>
      <nav className={styles.nav} aria-label="Main">
        <Link href="/" className={styles.wordmark}>
          {BRAND_WORDMARK}
        </Link>
        <div className={styles.actions}>
          <IconButton icon={Search} label="Search" variant="ghost" />
          {user || isLoading ? (
            <IconButton
              icon={User}
              label="My subscriptions"
              href="/account"
              variant={pathname === "/account" ? "secondary" : "ghost"}
              badge={activeCount}
            />
          ) : (
            <IconButton icon={User} label="Sign in" variant="ghost" onClick={() => openSignIn("/account")} />
          )}
        </div>
      </nav>
    </header>
  );
}
