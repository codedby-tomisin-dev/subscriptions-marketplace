import { Check, Plus, Trash2 } from "lucide-react";
import { Button, Checkbox, IconButton, Input } from "@/components/ui";
import type { Cadence } from "@/features/catalog";
import { formatPrice } from "@/shared/utils";
import { AdminPanel } from "../shared";
import { planEconomics, type BoxDraft, type DraftItem } from "./boxDraft";
import styles from "./BoxEditor.module.css";

const PLANS: { cadence: Cadence; label: string }[] = [
  { cadence: "week", label: "Weekly" },
  { cadence: "month", label: "Monthly" },
];

interface PlansPanelProps {
  draft: BoxDraft;
  update: (patch: Partial<BoxDraft>) => void;
}

/** What goes in each plan, what it costs us, what it sells for and what's left: one table, summed as you type. */
export function PlansPanel({ draft, update }: PlansPanelProps) {
  const economics = planEconomics(draft);
  const setItems = (items: DraftItem[]) => update({ items });
  const changeItem = (index: number, patch: Partial<DraftItem>) => setItems(draft.items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <AdminPanel title="Plans, items and profit">
      <p className={styles.note}>
        What physically goes in each box, at the average price across the big supermarkets. Weekly boxes hold the ticked items; monthly boxes hold
        everything. A new price applies to new subscribers only.
      </p>
      <div className={styles.planTable} role="table" aria-label="Packing items, prices and profit per plan">
        <div className={styles.planHead} role="row">
          <span role="columnheader">Item</span>
          <span role="columnheader">Avg. cost</span>
          {PLANS.map((plan) => (
            <span key={plan.cadence} role="columnheader" className={plan.cadence === "month" ? `${styles.planCol} ${styles.planMonthly}` : styles.planCol}>
              {plan.label}
            </span>
          ))}
          <span aria-hidden />
        </div>

        {draft.items.map((item, index) => (
          <div key={index} className={styles.planRow} role="row">
            <Input ariaLabel={`Item ${index + 1} name`} value={item.name} onChange={(name) => changeItem(index, { name })} placeholder="Paperback" />
            <Input
              ariaLabel={`Item ${index + 1} average cost (£)`}
              inputMode="decimal"
              value={item.cost}
              onChange={(cost) => changeItem(index, { cost })}
              placeholder="£0.00"
            />
            <span className={styles.planCol}>
              <Checkbox ariaLabel={`Item ${index + 1} in weekly box`} checked={item.inWeeklyBox} onChange={(inWeeklyBox) => changeItem(index, { inWeeklyBox })} />
            </span>
            <span className={`${styles.planCol} ${styles.planMonthly}`} title="Monthly boxes hold every item">
              <Check size={16} aria-label="In monthly box" />
            </span>
            <IconButton icon={Trash2} label={`Remove item ${index + 1}`} variant="ghost" size="sm" onClick={() => setItems(draft.items.filter((_, i) => i !== index))} />
          </div>
        ))}
        <div className={styles.planAdd}>
          <Button size="sm" variant="ghost" iconLeft={Plus} onClick={() => setItems([...draft.items, { name: "", inWeeklyBox: true, cost: "" }])}>
            Add item
          </Button>
        </div>

        {/* Phones drop the monthly column from the item rows, so the sums get their own headings. */}
        <div className={`${styles.planSummary} ${styles.planSummaryHead}`} aria-hidden>
          <span />
          {PLANS.map((plan) => (
            <span key={plan.cadence} className={styles.planCol}>
              {plan.label}
            </span>
          ))}
        </div>
        <div className={`${styles.planSummary} ${styles.planTotal}`} role="row">
          <span role="rowheader" className={styles.planLabel}>
            Items cost
          </span>
          {PLANS.map(({ cadence }) => (
            <span key={cadence} className={styles.planCol}>
              <span className={styles.planFigure}>{formatPrice(economics[cadence].cost)}</span>
              {economics[cadence].uncosted > 0 && <span className={styles.planHint}>+{economics[cadence].uncosted} unpriced</span>}
            </span>
          ))}
        </div>
        <div className={styles.planSummary} role="row">
          <span role="rowheader" className={styles.planLabel}>
            Price
          </span>
          {PLANS.map(({ cadence, label }) => (
            <Input
              key={cadence}
              ariaLabel={`${label} price (£)`}
              inputMode="decimal"
              value={draft.prices[cadence]}
              onChange={(price) => update({ prices: { ...draft.prices, [cadence]: price } })}
              required
            />
          ))}
        </div>
        <div className={`${styles.planSummary} ${styles.planProfit}`} role="row">
          <span role="rowheader" className={styles.planLabel}>
            Profit per box
          </span>
          {PLANS.map(({ cadence }) => {
            const { profit, margin } = economics[cadence];
            return (
              <span key={cadence} className={styles.planCol} data-loss={profit !== null && profit < 0 ? true : undefined}>
                <span className={styles.planFigure}>{profit === null ? "–" : formatPrice(profit)}</span>
                {margin !== null && <span className={styles.planHint}>{Math.round(margin * 100)}% margin</span>}
              </span>
            );
          })}
        </div>
      </div>
      <p className={styles.planFootnote}>Before postage, packaging and card fees.</p>

      <div className={styles.grid2}>
        <Input
          label="What the weekly box includes"
          value={draft.planNotes.week}
          onChange={(week) => update({ planNotes: { ...draft.planNotes, week } })}
          placeholder="A short read · 2 treats"
          required
        />
        <Input
          label="What the monthly box includes"
          value={draft.planNotes.month}
          onChange={(month) => update({ planNotes: { ...draft.planNotes, month } })}
          placeholder="The full nook · 5 treats"
          required
        />
      </div>
    </AdminPanel>
  );
}
