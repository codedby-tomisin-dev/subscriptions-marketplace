"use client";

import { formatShortDate } from "@/shared/utils";
import { getChurn, type ChurnReport } from "../api";
import { AdminPageHeader, AdminPanel, adminStyles as admin, Bar, BoxDot, ReportState } from "../shared";
import { useAdminReport } from "../useAdminReport";
import styles from "./Cancellations.module.css";

export function CancellationsContainer() {
  const { data, error } = useAdminReport(getChurn);
  return (
    <>
      <AdminPageHeader title="Cancellations" subtitle="Why people leave, and how often we talk them into a pause instead. Last 30 days." />
      {data ? <CancellationsView report={data} /> : <ReportState error={error} />}
    </>
  );
}

function CancellationsView({ report }: { report: ChurnReport }) {
  const maxReason = Math.max(1, ...report.reasons.map((reason) => reason.percent));
  const { saves } = report;
  const outcomes = [
    { label: "Paused instead", count: saves.pausedInstead, color: "var(--sage-500)" },
    { label: "Switched to monthly", count: saves.switchedToMonthly, color: "var(--apricot-500)" },
    { label: "Cancelled anyway", count: saves.cancelledAnyway, color: "var(--cream-200)" },
  ];
  const total = outcomes.reduce((sum, outcome) => sum + outcome.count, 0);

  return (
    <>
      <div className={admin.grid2}>
        <AdminPanel title="Reasons given">
          <div className={styles.reasons}>
            {report.reasons.map((row) => (
              <div key={row.reason} className={styles.reason}>
                <span className={admin.strong} style={{ fontWeight: 400 }}>
                  {row.reason}
                </span>
                <Bar percent={(row.percent / maxReason) * 100} color="var(--cocoa-700)" height={12} label={`${row.reason}: ${row.percent}%`} />
                <span className={styles.percent}>{row.percent}%</span>
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title="Save rate">
          <div className={admin.num} style={{ fontSize: 48 }}>
            {saves.percentSaved}%
          </div>
          <p className={styles.saveNote}>of people who started cancelling stayed in some form.</p>
          {total > 0 && (
            <div className={styles.stack} role="img" aria-label={outcomes.map((o) => `${o.label}: ${o.count}`).join("; ")}>
              {outcomes.map((outcome) =>
                outcome.count ? <div key={outcome.label} style={{ width: `${(outcome.count / total) * 100}%`, background: outcome.color }} /> : null,
              )}
            </div>
          )}
          <div className={styles.outcomes}>
            {outcomes.map((outcome) => (
              <div key={outcome.label} className={styles.outcome}>
                <span className={admin.swatch} style={{ background: outcome.color }} />
                <span className={styles.outcomeLabel}>{outcome.label}</span>
                <b className={admin.strong}>{outcome.count}</b>
              </div>
            ))}
          </div>
        </AdminPanel>
      </div>

      <AdminPanel title="Recent cancellations" flush>
        <div className={admin.tableWrap}>
          <table className={admin.table}>
            <thead>
              <tr>
                <th>Subscriber</th>
                <th>Box</th>
                <th>Reason</th>
                <th>Was with us</th>
                <th>Cancelled</th>
              </tr>
            </thead>
            <tbody>
              {report.recent.map((row) => (
                <tr key={`${row.customerId}-${row.at}`}>
                  <td className={admin.strong}>{row.name}</td>
                  <td>{row.boxId ? <BoxDot boxId={row.boxId} /> : "—"}</td>
                  <td>{row.reason}</td>
                  <td>{row.tenure ?? "—"}</td>
                  <td>{formatShortDate(row.at.slice(0, 10))}</td>
                </tr>
              ))}
              {!report.recent.length && (
                <tr>
                  <td colSpan={5} className={admin.emptyRow}>
                    No one has cancelled in the last 30 days.
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
