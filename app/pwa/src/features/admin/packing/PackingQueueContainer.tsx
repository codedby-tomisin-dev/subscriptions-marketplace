"use client";

import clsx from "clsx";
import { PackageCheck, Printer, Search, Tag, Truck } from "lucide-react";
import { Button, Checkbox, Input, Tabs } from "@/components/ui";
import { PURCHASE_COPY } from "@/features/catalog";
import { AdminBadge, AdminPageHeader, AdminPanel, adminStyles as admin, BoxDot, formatShipDay } from "../shared";
import { PACKING_STAGES, usePackingQueue } from "./usePackingQueue";
import styles from "./PackingQueue.module.css";

export function PackingQueueContainer() {
  const queue = usePackingQueue();
  const selectedCount = queue.selected.size;

  return (
    <>
      <AdminPageHeader title="Packing queue" subtitle="Everything that needs to leave the warehouse, by ship date.">
        <Button variant="secondary" size="sm" iconLeft={Printer} href={`/admin/packing/slips?date=${queue.day}`}>
          Packing slips
        </Button>
      </AdminPageHeader>

      <div className={styles.days}>
        <Tabs
          label="Ship day"
          items={queue.days.map((day) => ({ id: day, label: formatShipDay(day), count: queue.dayCounts[day] }))}
          value={queue.day}
          onChange={queue.chooseDay}
        />
      </div>

      <div className={admin.kpis}>
        {PACKING_STAGES.map((stage) => (
          <button
            key={stage}
            type="button"
            aria-pressed={queue.stage === stage}
            onClick={() => queue.setStage(queue.stage === stage ? null : stage)}
            className={clsx(admin.panel, styles.stage)}
          >
            <AdminBadge status={stage} />
            <span className={admin.num} style={{ fontSize: 30 }}>
              {queue.stageCounts[stage]}
            </span>
          </button>
        ))}
      </div>

      <AdminPanel flush>
        <div className={admin.toolbar}>
          <div className={admin.search}>
            <Input iconLeft={Search} ariaLabel="Search orders" placeholder="Search name, order or city" value={queue.search} onChange={queue.setSearch} />
          </div>
          <div className={styles.bulk}>
            {selectedCount > 0 && <span className={admin.muted}>{selectedCount} selected</span>}
            <Button size="sm" variant="secondary" iconLeft={PackageCheck} disabled={!selectedCount || queue.isMoving} onClick={() => queue.moveSelected("packed")}>
              Mark packed
            </Button>
            <Button size="sm" variant="secondary" iconLeft={Tag} disabled={!selectedCount || queue.isMoving} onClick={() => queue.moveSelected("labelled")}>
              Print Royal Mail labels
            </Button>
            <Button size="sm" iconLeft={Truck} disabled={!selectedCount || queue.isMoving} onClick={() => queue.moveSelected("shipped")}>
              Mark shipped
            </Button>
          </div>
        </div>
        <div className={admin.tableWrap}>
          <table className={admin.table}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <Checkbox
                    ariaLabel="Select all"
                    checked={queue.allSelected}
                    indeterminate={selectedCount > 0 && !queue.allSelected}
                    onChange={queue.toggleAll}
                  />
                </th>
                <th>Order</th>
                <th>Customer</th>
                <th>Box</th>
                <th>Rhythm</th>
                <th>Ships to</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {queue.rows.map((order) => {
                const isSelected = queue.selected.has(order.id);
                return (
                  <tr key={order.id} className={clsx(isSelected && admin.selected)}>
                    <td>
                      <Checkbox ariaLabel={`Select ${order.id}`} checked={isSelected} onChange={(isOn) => queue.toggle(order.id, isOn)} />
                    </td>
                    <td className={admin.mono}>{order.id}</td>
                    <td className={admin.strong}>{order.customerName || "—"}</td>
                    <td>
                      <BoxDot boxId={order.boxId} />
                    </td>
                    <td>{PURCHASE_COPY[order.cadence].label}</td>
                    <td>{order.city || "—"}</td>
                    <td>
                      <AdminBadge status={order.status} />
                    </td>
                  </tr>
                );
              })}
              {!queue.isLoading && !queue.rows.length && (
                <tr>
                  <td colSpan={7} className={admin.emptyRow}>
                    Nothing here. The queue is clear — go have a tea.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </>
  );
}
