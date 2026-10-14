import { useId, type Ref } from "react";
import { Repeat, X } from "lucide-react";
import { Button, IconButton, ProductImage, Sheet, Switch, Tag } from "@/components/ui";
import { PartnerLogos, Stars, STORE_RATING } from "@/components/trust";
import { boxArt, CADENCE_COPY, type Box, type Cadence } from "@/features/catalog";
import { toneSurface } from "@/shared/types";
import { formatDay, formatPrice } from "@/shared/utils";
import { CadenceOption } from "./CadenceOption";
import styles from "./PurchaseSection.module.css";

export interface PurchaseChoices {
  cadence: Cadence;
  onCadenceChange: (cadence: Cadence) => void;
  deliveryDates: string[];
  firstDelivery: string;
  onFirstDeliveryChange: (date: string) => void;
  isGift: boolean;
  onGiftChange: (isGift: boolean) => void;
  onStart: () => void;
  /** True while Stripe Checkout is being prepared. */
  isStarting: boolean;
}

interface PurchasePanelProps extends PurchaseChoices {
  box: Box;
  headingId: string;
  /** Shown in the phone sheet: adds a thumbnail and a close button to the header. */
  onClose?: () => void;
}

/** The buy panel: sticky beside the story on wide screens. Phones open the same panel in a sheet. */
export function PurchaseSection({
  ref,
  ...props
}: Omit<PurchasePanelProps, "headingId" | "onClose"> & {
  ref: Ref<HTMLElement>;
}) {
  const headingId = useId();
  return (
    <aside ref={ref} id="buy" aria-labelledby={headingId} className={styles.aside}>
      <div className={styles.panel}>
        <PurchasePanel {...props} headingId={headingId} />
      </div>
    </aside>
  );
}

/** Phones: "Pick my plan" opens the panel in a bottom sheet. */
export function PurchasePlanSheet({ open, onClose, ...props }: Omit<PurchasePanelProps, "headingId"> & { open: boolean; onClose: () => void }) {
  const headingId = useId();
  return (
    <Sheet open={open} onClose={onClose} label={`Pick a plan for the ${props.box.name.toLowerCase()} box`}>
      <div className={styles.sheetPanel}>
        <PurchasePanel {...props} headingId={headingId} onClose={onClose} />
      </div>
    </Sheet>
  );
}

export function PurchasePanel({
  box,
  headingId,
  onClose,
  cadence,
  onCadenceChange,
  deliveryDates,
  firstDelivery,
  onFirstDeliveryChange,
  isGift,
  onGiftChange,
  onStart,
  isStarting,
}: PurchasePanelProps) {
  const copy = CADENCE_COPY[cadence];
  const cadenceLabelId = useId();
  const dateLabelId = useId();

  return (
    <>
      <div className={styles.panelHead}>
        {onClose && (
          <div className={styles.sheetThumb} style={{ background: toneSurface(box.tone) }}>
            <ProductImage src={boxArt(box)} tone={box.tone} ratio="1 / 1" radius={10} sizes="52px" />
          </div>
        )}
        <div className={styles.panelIdentity}>
          <h2 id={headingId} className={styles.panelTitle}>
            The {box.name.toLowerCase()} box
          </h2>
          <div className={styles.panelRating}>
            <Stars value={STORE_RATING.score} size={14} />
            <span>
              {STORE_RATING.score} · {STORE_RATING.boxesDelivered} {onClose ? "delivered" : "boxes delivered"}
            </span>
          </div>
        </div>
        {onClose && <IconButton icon={X} label="Close" variant="secondary" onClick={onClose} />}
      </div>
      <div className={styles.field}>
        <span id={cadenceLabelId} className={styles.fieldLabel}>
          How often?
        </span>
        <div role="radiogroup" aria-labelledby={cadenceLabelId} className={styles.cadences}>
          <CadenceOption
            selected={cadence === "week"}
            onSelect={() => onCadenceChange("week")}
            title="Weekly"
            price={box.prices.week}
            unit="week"
          />
          <CadenceOption
            selected={cadence === "month"}
            onSelect={() => onCadenceChange("month")}
            title="Monthly"
            price={box.prices.month}
            unit="month"
            badge="Most loved"
          />
        </div>
      </div>

      <div className={styles.field}>
        <span id={dateLabelId} className={styles.fieldLabel}>
          First box arrives
        </span>
        <div role="group" aria-labelledby={dateLabelId} className={styles.dates}>
          {deliveryDates.map((date) => (
            <Tag key={date} selected={firstDelivery === date} onClick={() => onFirstDeliveryChange(date)}>
              {formatDay(date)}
            </Tag>
          ))}
        </div>
      </div>

      <Switch checked={isGift} onChange={onGiftChange} label="It’s a gift" />

      <div className={styles.checkout}>
        <Button size="lg" variant="accent" fullWidth onClick={onStart} loading={isStarting}>
          Start my subscription · {formatPrice(box.prices[cadence])}/{copy.short}
        </Button>
        <div className={styles.cancelNote}>
          <Repeat size={15} aria-hidden />
          Skip, pause or cancel anytime in two taps
        </div>
        <div className={styles.trust}>
          <PartnerLogos center />
        </div>
      </div>
    </>
  );
}
