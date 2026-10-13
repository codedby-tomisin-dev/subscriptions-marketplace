"use client";

import { CreditCard, Download, PackageX, Package } from "lucide-react";
import { Button } from "@/components/ui";
import { useAuth } from "@/features/auth";
import { useCatalog } from "@/features/catalog";
import { downloadCsv, formatCompactPrice, formatDay, formatShortDate } from "@/shared/utils";
import { getOverview, type AttentionItem, type Overview } from "../api";
import { AdminPageHeader, AdminPanel, adminStyles as admin, Bar, BoxDot, formatShipDay, ReportState } from "../shared";
import { useAdminReport } from "../useAdminReport";
import { cadenceInsight, overviewKpis } from "./overviewMetrics";
import styles from "./Overview.module.css";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function exportOverview(overview: Overview, boxName: (boxId: string) => string | undefined) {
  downloadCsv(
    `bonbon-overview-${overview.today}.csv`,
    ["Metric", "Value"],
    [
      ...overviewKpis(overview).map((kpi) => [kpi.label, kpi.value]),
      ...overview.mrrByBox.map((row) => [`MRR · ${boxName(row.boxId) ?? row.boxId}`, (row.mrrPence / 100).toFixed(2)]),
      ...overview.shipping.byDay.map((day) => [`Shipping ${day.date}`, `${day.shipped}/${day.total}`]),
    ],
  );
}

export function OverviewContainer() {
  const { data, error } = useAdminReport(getOverview);
  const { getBox } = useCatalog();
  const { user } = useAuth();
  const name = user?.displayName?.split(" ")[0];
  const now = new Date();

  return (
    <>
      <AdminPageHeader
        title={`${greeting(now.getHours())}${name ? `, ${name}` : ""}.`}
        subtitle={`${new Intl.DateTimeFormat("en-GB", { weekday: "long", month: "short", day: "numeric" }).format(now)} · here’s how the boxes are doing.`}
      >
        <Button variant="secondary" size="sm" iconLeft={Download} onClick={() => data && exportOverview(data, (boxId) => getBox(boxId)?.name)} disabled={!data}>
          Export
        </Button>
        <Button size="sm" iconLeft={Package} href="/admin/packing">
          Open packing queue
        </Button>
      </AdminPageHeader>
      {data ? <OverviewView overview={data} /> : <ReportState error={error} />}
    </>
  );
}

function OverviewView({ overview }: { overview: Overview }) {
  const { getBox } = useCatalog();
  const maxDay = Math.max(1, ...overview.shipping.byDay.map((day) => day.total));
  const maxMrr = Math.max(1, ...overview.mrrByBox.map((row) => row.mrrPence));
  const split = overview.cadenceByBox.all;
  const splitTotal = split.week + split.month;
  const weeklyPercent = splitTotal ? Math.round((split.week / splitTotal) * 100) : 0;
  const insight = cadenceInsight(overview.cadenceByBox, (boxId) => getBox(boxId)?.name);

  return (
    <>
      <div className={admin.kpis}>
        {overviewKpis(overview).map((kpi) => (
          <div key={kpi.label} className={`${admin.panel} ${styles.kpi}`}>
            <span className={admin.muted}>{kpi.label}</span>
            <span className={admin.num}>{kpi.value}</span>
            <span className={styles.kpiNote}>
              {kpi.change && (
                <span className={styles.change} data-good={kpi.isGood == null ? undefined : String(kpi.isGood)}>
                  {kpi.change}
                </span>
              )}
              {kpi.note}
            </span>
          </div>
        ))}
      </div>

      <div className={admin.grid2}>
        <AdminPanel title="Needs your attention" action={<span className={styles.count}>{overview.attention.length} items</span>}>
          {overview.attention.length ? (
            <div className={styles.attention}>
              {overview.attention.map((item) => (
                <AttentionRow key={item.kind === "low_stock" ? item.itemId : item.kind} item={item} />
              ))}
            </div>
          ) : (
            <p className={admin.muted}>All clear. Nothing needs you right now.</p>
          )}
        </AdminPanel>

        <AdminPanel title="Shipping this week">
          <div className={styles.week} role="img" aria-label={overview.shipping.byDay.map((d) => `${formatShipDay(d.date)}: ${d.shipped} of ${d.total} shipped`).join("; ")}>
            {overview.shipping.byDay.map((day) => (
              <div key={day.date} className={styles.dayColumn} title={`${formatDay(day.date)} · ${day.shipped} of ${day.total} shipped`}>
                <span className={styles.dayTotal}>{day.total}</span>
                <div className={styles.dayBar} style={{ height: `${Math.max(4, (day.total / maxDay) * 120)}px` }}>
                  <div className={styles.dayShipped} style={{ height: day.total ? `${(day.shipped / day.total) * 100}%` : 0 }} />
                </div>
                <span className={styles.dayLabel}>{formatShipDay(day.date)}</span>
              </div>
            ))}
          </div>
          <div className={admin.legend}>
            <span className={admin.legendItem}>
              <span className={admin.swatch} style={{ background: "var(--blush-500)" }} />
              Shipped
            </span>
            <span className={admin.legendItem}>
              <span className={admin.swatch} style={{ background: "var(--cream-200)" }} />
              Still to go
            </span>
          </div>
        </AdminPanel>
      </div>

      <div className={admin.grid2} style={{ gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)" }}>
        <AdminPanel
          title="Recurring revenue by box"
          action={
            <Button size="sm" variant="ghost" href="/admin/stock">
              All boxes
            </Button>
          }
        >
          <div className={styles.mrrRows}>
            {overview.mrrByBox.map((row) => (
              <div key={row.boxId} className={styles.mrrRow} title={`${getBox(row.boxId)?.name ?? row.boxId}: ${formatCompactPrice(row.mrrPence)} a month`}>
                <BoxDot boxId={row.boxId} />
                <Bar percent={(row.mrrPence / maxMrr) * 100} color="var(--cocoa-700)" height={12} />
                <span className={styles.mrrValue}>{formatCompactPrice(row.mrrPence)}</span>
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title="Weekly vs monthly">
          <div className={styles.split} role="img" aria-label={`${weeklyPercent}% weekly, ${100 - weeklyPercent}% monthly`}>
            <div style={{ width: `${weeklyPercent}%`, background: "var(--blush-500)" }} />
            <div style={{ flex: 1, background: "var(--cocoa-900)" }} />
          </div>
          <div className={styles.splitStats}>
            {[
              { label: "Weekly", percent: weeklyPercent, color: "var(--blush-500)", count: split.week },
              { label: "Monthly", percent: splitTotal ? 100 - weeklyPercent : 0, color: "var(--cocoa-900)", count: split.month },
            ].map((side) => (
              <div key={side.label} className={styles.splitStat}>
                <span className={admin.legendItem}>
                  <span className={admin.swatch} style={{ background: side.color }} />
                  {side.label}
                </span>
                <span className={admin.num} style={{ fontSize: 28 }}>
                  {side.percent}%
                </span>
                <span className={admin.subtle}>{side.count.toLocaleString("en-GB")} subscribers</span>
              </div>
            ))}
          </div>
          {insight && <p className={styles.insight}>{insight}</p>}
        </AdminPanel>
      </div>
    </>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const { getBox } = useCatalog();
  if (item.kind === "low_stock") {
    const box = getBox(item.boxId);
    return (
      <div className={styles.attentionRow}>
        <span className={styles.attentionIcon} data-tone="danger">
          <PackageX size={20} aria-hidden />
        </span>
        <div className={styles.attentionText}>
          <div className={admin.strong}>{item.name} running low</div>
          <div className={admin.muted}>
            {item.stock} in stock, {item.needed} needed for the next round of {box?.name ?? item.boxId} boxes.
          </div>
        </div>
        <Button size="sm" variant="secondary" href="/admin/stock">
          Reorder
        </Button>
      </div>
    );
  }
  return (
    <div className={styles.attentionRow}>
      <span className={styles.attentionIcon} data-tone="warning">
        <CreditCard size={20} aria-hidden />
      </span>
      <div className={styles.attentionText}>
        <div className={admin.strong}>
          {item.count} payment{item.count === 1 ? "" : "s"} failed in the last day
        </div>
        <div className={admin.muted}>
          Stripe will retry automatically{item.nextRetryAt ? ` from ${formatShortDate(item.nextRetryAt.slice(0, 10))}` : ""}.
          {item.finalRetryCount > 0 && ` ${item.finalRetryCount} ${item.finalRetryCount === 1 ? "is" : "are"} on the final retry.`}
        </div>
      </div>
      <Button size="sm" variant="secondary" href="/admin/subscribers">
        Review
      </Button>
    </div>
  );
}
