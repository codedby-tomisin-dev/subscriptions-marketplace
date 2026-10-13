import { useId, type Ref } from "react";
import { Repeat } from "lucide-react";
import { Button, Switch, Tag } from "@/components/ui";
import { PartnerLogos, Stars, STORE_RATING } from "@/components/trust";
import { CADENCE_COPY, type Box, type Cadence } from "@/features/catalog";
import { formatDay, formatPrice } from "@/shared/utils";
import { CadenceOption } from "./CadenceOption";
import styles from "./PurchaseSection.module.css";

interface PurchaseSectionProps {
  box: Box;
  ref: Ref<HTMLElement>;
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

/** The buy panel: sticky beside the story on wide screens, straight under the photos on phones. */
export function PurchaseSection({
  box,
  ref,
  cadence,
  onCadenceChange,
  deliveryDates,
  firstDelivery,
  onFirstDeliveryChange,
  isGift,
  onGiftChange,
  onStart,
  isStarting,
}: PurchaseSectionProps) {
  const copy = CADENCE_COPY[cadence];
  const headingId = useId();
  const cadenceLabelId = useId();
  const dateLabelId = useId();

  return (
    <aside ref={ref} id="buy" aria-labelledby={headingId} className={styles.aside}>
      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <h2 id={headingId} className={styles.panelTitle}>
            The {box.name.toLowerCase()} box
          </h2>
          <div className={styles.panelRating}>
            <Stars value={STORE_RATING.score} size={14} />
            <span>
              {STORE_RATING.score} · {STORE_RATING.boxesDelivered} boxes delivered
            </span>
          </div>
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
      </div>
    </aside>
  );
}
