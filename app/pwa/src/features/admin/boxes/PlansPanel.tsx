import type { CSSProperties } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Button, Checkbox, IconButton, Input } from "@/components/ui";
import { PURCHASE_COPY, PURCHASE_OPTIONS, type PurchaseOption } from "@/features/catalog";
import { formatPrice } from "@/shared/utils";
import { AdminPanel } from "../shared";
import { draftOptions, planEconomics, toPounds, type BoxDraft, type DraftItem } from "./boxDraft";
import { DELIVERY_PENCE, PACKAGING_PENCE, SERVICE_MARKUP_PERCENT } from "./pricing";
import styles from "./BoxEditor.module.css";

const PLACEHOLDERS: Record<PurchaseOption, string> = { week: "A short read · 2 treats", month: "The full nook · 5 treats", once: "The full nook, just once" };

interface PlansPanelProps {
  draft: BoxDraft;
  update: (patch: Partial<BoxDraft>) => void;
}

/** How the box is sold, what goes in it, what it costs us, what it sells for and what's left: one table, summed as you type. */
export function PlansPanel({ draft, update }: PlansPanelProps) {
  const economics = planEconomics(draft);
  const options = draftOptions(draft);
  const setItems = (items: DraftItem[]) => update({ items });
  const changeItem = (index: number, patch: Partial<DraftItem>) => setItems(draft.items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  // Option columns follow the options on sale. Phones keep only the weekly tick column in item rows.
  const columns = {
    "--plan-cols": `minmax(120px, 1fr) 104px ${options.map(() => "104px").join(" ")} 32px`,
    "--plan-cols-phone": `minmax(0, 1fr) 80px ${draft.onSale.week ? "52px " : ""}32px`,
    "--plan-n": options.length,
  } as CSSProperties;

  return (
    <AdminPanel title="Plans, items and profit">
      <p className={styles.note}>
        How the box is sold, and what physically goes in it at the average price across the big supermarkets. Weekly boxes hold the ticked items;
        monthly and one-off boxes hold everything. A new price applies to new customers only.
      </p>
      <div className={styles.onSale} role="group" aria-label="Sold as">
        <span className={styles.onSaleLabel}>Sold as</span>
        {PURCHASE_OPTIONS.map((option) => (
          <Checkbox
            key={option}
            label={PURCHASE_COPY[option].label}
            checked={draft.onSale[option]}
            onChange={(checked) => update({ onSale: { ...draft.onSale, [option]: checked } })}
          />
        ))}
      </div>
      {options.length === 0 && <p className={styles.planWarning}>Tick at least one way to sell it, or customers can’t buy it.</p>}

      <div className={styles.planTable} role="table" aria-label="Packing items, prices and profit per option" style={columns}>
        <div className={styles.planHead} role="row">
          <span role="columnheader">Item</span>
          <span role="columnheader">Avg. cost</span>
          {options.map((option) => (
            <span key={option} role="columnheader" className={option === "week" ? styles.planCol : `${styles.planCol} ${styles.planEverything}`}>
              {PURCHASE_COPY[option].label}
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
            {options.map((option) =>
              option === "week" ? (
                <span key={option} className={styles.planCol}>
                  <Checkbox ariaLabel={`Item ${index + 1} in weekly box`} checked={item.inWeeklyBox} onChange={(inWeeklyBox) => changeItem(index, { inWeeklyBox })} />
                </span>
              ) : (
                <span key={option} className={`${styles.planCol} ${styles.planEverything}`} title={`${PURCHASE_COPY[option].label} boxes hold every item`}>
                  <Check size={16} aria-label={`In ${PURCHASE_COPY[option].label.toLowerCase()} box`} />
                </span>
              ),
            )}
            <IconButton icon={Trash2} label={`Remove item ${index + 1}`} variant="ghost" size="sm" onClick={() => setItems(draft.items.filter((_, i) => i !== index))} />
          </div>
        ))}
        <div className={styles.planAdd}>
          <Button size="sm" variant="ghost" iconLeft={Plus} onClick={() => setItems([...draft.items, { name: "", inWeeklyBox: true, cost: "" }])}>
            Add item
          </Button>
        </div>

        {options.length > 0 && (
          <>
            {/* Phones drop the option columns from the item rows, so the sums get their own headings. */}
            <div className={`${styles.planSummary} ${styles.planSummaryHead}`} aria-hidden>
              <span />
              {options.map((option) => (
                <span key={option} className={styles.planCol}>
                  {PURCHASE_COPY[option].label}
                </span>
              ))}
            </div>
            <div className={`${styles.planSummary} ${styles.planTotal}`} role="row">
              <span role="rowheader" className={styles.planLabel}>
                Items cost
              </span>
              {options.map((option) => (
                <span key={option} className={styles.planCol}>
                  <span className={styles.planFigure}>{formatPrice(economics[option].cost)}</span>
                  {economics[option].uncosted > 0 && <span className={styles.planHint}>+{economics[option].uncosted} unpriced</span>}
                </span>
              ))}
            </div>
            <div className={styles.planSummary} role="row">
              <span role="rowheader" className={styles.planLabel}>
                Delivery & packaging
              </span>
              {options.map((option) => (
                <span key={option} className={styles.planCol}>
                  <span className={styles.planFigure}>{formatPrice(economics[option].shipping)}</span>
                </span>
              ))}
            </div>
            <div className={styles.planSummary} role="row">
              <span role="rowheader" className={styles.planLabel}>
                Suggested price
              </span>
              {options.map((option) => {
                const { suggested, price } = economics[option];
                return (
                  <span key={option} className={styles.planCol}>
                    <span className={styles.planFigure}>{formatPrice(suggested)}</span>
                    {price !== suggested && (
                      <button
                        type="button"
                        className={styles.planUse}
                        onClick={() => update({ prices: { ...draft.prices, [option]: toPounds(suggested) } })}
                        aria-label={`Use ${formatPrice(suggested)} as the ${PURCHASE_COPY[option].label.toLowerCase()} price`}
                      >
                        Use it
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
            <div className={styles.planSummary} role="row">
              <span role="rowheader" className={styles.planLabel}>
                Price
              </span>
              {options.map((option) => (
                <Input
                  key={option}
                  ariaLabel={`${PURCHASE_COPY[option].label} price (£)`}
                  inputMode="decimal"
                  value={draft.prices[option]}
                  onChange={(price) => update({ prices: { ...draft.prices, [option]: price } })}
                  required
                />
              ))}
            </div>
            <div className={`${styles.planSummary} ${styles.planProfit}`} role="row">
              <span role="rowheader" className={styles.planLabel}>
                Profit per box
              </span>
              {options.map((option) => {
                const { profit, margin } = economics[option];
                return (
                  <span key={option} className={styles.planCol} data-loss={profit !== null && profit < 0 ? true : undefined}>
                    <span className={styles.planFigure}>{profit === null ? "–" : formatPrice(profit)}</span>
                    {margin !== null && <span className={styles.planHint}>{Math.round(margin * 100)}% margin</span>}
                  </span>
                );
              })}
            </div>
          </>
        )}
      </div>
      {options.length > 0 && (
        <p className={styles.planFootnote}>
          Suggested price: the goods, plus {SERVICE_MARKUP_PERCENT}% for the experience, plus {formatPrice(DELIVERY_PENCE)} delivery and{" "}
          {formatPrice(PACKAGING_PENCE)} packaging, rounded up to the next 50p. Profit is before card fees.
        </p>
      )}

      <div className={styles.planNotes}>
        {options.map((option) => (
          <Input
            key={option}
            label={`What the ${PURCHASE_COPY[option].label.toLowerCase()} box includes`}
            value={draft.planNotes[option]}
            onChange={(note) => update({ planNotes: { ...draft.planNotes, [option]: note } })}
            placeholder={PLACEHOLDERS[option]}
            required
          />
        ))}
      </div>
    </AdminPanel>
  );
}
