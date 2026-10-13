"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ChevronLeft, Search, Share, User } from "lucide-react";
import { IconButton, useToast } from "@/components/ui";
import { BRAND_WORDMARK } from "@/constants";
import { useAuth } from "@/features/auth";
import { useCatalog } from "@/features/catalog";
import { useSubscriptions } from "@/features/subscriptions";
import styles from "./SiteHeader.module.css";

/** On a box page, the bar turns solid (and shows the box name) once the intro has scrolled away. */
const SCROLLED_PAST_INTRO = 150;

function useScrolledPast(offset: number) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > offset);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [offset]);
  return scrolled;
}

export function SiteHeader() {
  const pathname = usePathname();
  const { user, isLoading, openSignIn } = useAuth();
  const { subscriptions } = useSubscriptions();
  const { getBox } = useCatalog();
  const { showToast } = useToast();
  const scrolled = useScrolledPast(SCROLLED_PAST_INTRO);
  const activeCount = subscriptions.filter((subscription) => subscription.status === "active").length;
  const boxId = pathname.match(/^\/boxes\/([^/]+)/)?.[1];
  const box = boxId ? getBox(boxId) : undefined;

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: box ? `The ${box.name.toLowerCase()} box` : document.title, url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url);
    showToast({ title: "Link copied", message: "Send it to someone who deserves a treat." });
  };

  return (
    <header className={clsx(styles.header, boxId && styles.onBox, boxId && scrolled && styles.scrolled)}>
      <nav className={styles.nav} aria-label="Main">
        <Link href="/" className={styles.wordmark}>
          {BRAND_WORDMARK}
        </Link>
        {boxId && (
          <>
            <span className={styles.phoneOnly}>
              <IconButton icon={ChevronLeft} label="Back to all boxes" variant="glass" href="/" />
            </span>
            <span className={styles.boxTitle} aria-hidden={!scrolled}>
              {box?.name}
            </span>
          </>
        )}
        <div className={styles.actions}>
          <span className={styles.search}>
            <IconButton icon={Search} label="Search" variant="ghost" />
          </span>
          {/* Phones reach the account from the tab bar. */}
          <span className={styles.account}>
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
          </span>
          {boxId && (
            <span className={styles.phoneOnly}>
              <IconButton icon={Share} label="Share this box" variant="glass" onClick={share} />
            </span>
          )}
        </div>
      </nav>
    </header>
  );
}
