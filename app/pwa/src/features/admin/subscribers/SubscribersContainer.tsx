"use client";

import clsx from "clsx";
import { useState } from "react";
import { ChevronRight, Download, Search } from "lucide-react";
import { Button, Input, Tag } from "@/components/ui";
import type { Customer } from "@/features/customers";
import { formatDay, formatMonthYear, formatPrice } from "@/shared/utils";
import { AdminBadge, AdminPageHeader, AdminPanel, adminStyles as admin, BoxDot } from "../shared";
import { SubscriberDrawer } from "./SubscriberDrawer";
import { useSubscribers, type CadenceFilter, type StatusFilter } from "./useSubscribers";
import styles from "./Subscribers.module.css";

const STATUS_FILTERS: [StatusFilter, string][] = [
  ["all", "Everyone"],
  ["active", "Active"],
  ["paused", "Paused"],
  ["cancelled", "Cancelled"],
];
const CADENCE_FILTERS: [CadenceFilter, string][] = [
  ["all", "Any rhythm"],
  ["week", "Weekly"],
  ["month", "Monthly"],
];

export function SubscribersContainer() {
  const list = useSubscribers();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = list.subscribers.find((customer) => customer.id === openId) ?? null;

  return (
    <>
      <AdminPageHeader
        title="Subscribers"
        subtitle={`${list.subscribers.length.toLocaleString("en-GB")} people · ${list.activeSubscriptions.toLocaleString("en-GB")} active subscriptions`}
      >
        <Button variant="secondary" size="sm" iconLeft={Download} onClick={list.exportCsv} disabled={!list.rows.length}>
          Export CSV
        </Button>
      </AdminPageHeader>

      <AdminPanel flush>
        <div className={admin.toolbar}>
          <div className={admin.search}>
            <Input iconLeft={Search} ariaLabel="Search subscribers" placeholder="Search name, email or city" value={list.search} onChange={list.setSearch} />
          </div>
          <div className={styles.tags} role="group" aria-label="Status">
            {STATUS_FILTERS.map(([value, label]) => (
              <Tag key={value} selected={list.status === value} onClick={() => list.setStatus(value)}>
                {label}
              </Tag>
            ))}
          </div>
          <div className={styles.tags} role="group" aria-label="Rhythm">
            {CADENCE_FILTERS.map(([value, label]) => (
              <Tag key={value} selected={list.cadence === value} onClick={() => list.setCadence(value)}>
                {label}
              </Tag>
            ))}
          </div>
        </div>
        <div className={admin.tableWrap}>
          <table className={admin.table}>
            <thead>
              <tr>
                <th>Subscriber</th>
                <th>Boxes</th>
                <th>Next box</th>
                <th>Member since</th>
                <th className={admin.right}>Lifetime value</th>
                <th>Status</th>
                <th aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((customer) => (
                <SubscriberRow key={customer.id} customer={customer} isOpen={customer.id === openId} onOpen={() => setOpenId(customer.id)} />
              ))}
              {!list.isLoading && !list.rows.length && (
                <tr>
                  <td colSpan={7} className={admin.emptyRow}>
                    No one matches that. Try loosening the filters?
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      {open && <SubscriberDrawer customer={open} onClose={() => setOpenId(null)} />}
    </>
  );
}

function SubscriberRow({ customer, isOpen, onOpen }: { customer: Customer; isOpen: boolean; onOpen: () => void }) {
  const live = customer.subscriptionSummary.filter((sub) => sub.status !== "cancelled");
  return (
    <tr className={clsx(admin.clickable, isOpen && admin.selected)} onClick={onOpen}>
      <td>
        <button type="button" className={styles.nameButton} onClick={onOpen}>
          <span className={admin.strong}>{customer.name ?? customer.email}</span>
          <span className={styles.email}>{customer.email}</span>
        </button>
      </td>
      <td>
        <div className={styles.boxes}>
          {live.map((sub) => (
            <span key={sub.boxId}>
              <BoxDot boxId={sub.boxId} /> <span className={admin.subtle}>· {sub.cadence === "week" ? "weekly" : "monthly"}</span>
            </span>
          ))}
          {!live.length && <span className={admin.subtle}>—</span>}
        </div>
      </td>
      <td>{customer.nextDelivery ? formatDay(customer.nextDelivery) : <span className={admin.subtle}>—</span>}</td>
      <td>{formatMonthYear(customer.memberSince)}</td>
      <td className={`${admin.right} ${admin.strong}`}>{formatPrice(customer.ltvPence)}</td>
      <td>{customer.overallStatus !== "none" && <AdminBadge status={customer.overallStatus} />}</td>
      <td style={{ width: 40 }}>
        <ChevronRight size={18} color="var(--text-subtle)" aria-hidden />
      </td>
    </tr>
  );
}
