"use client";

import { ArrowLeft, Gift, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { PURCHASE_COPY, useCatalog } from "@/features/catalog";
import { formatDay, formatPrice } from "@/shared/utils";
import { AdminPageHeader } from "../shared";
import { usePackingSlips, type PackingSlip } from "./usePackingSlips";
import styles from "./PackingSlips.module.css";

export function PackingSlipsContainer() {
  const { date, slips } = usePackingSlips();

  return (
    <>
      <div className={styles.screenOnly}>
        <AdminPageHeader title="Packing slips" subtitle={`${slips?.length ?? "…"} boxes shipping ${formatDay(date)}`}>
          <Button variant="ghost" size="sm" iconLeft={ArrowLeft} href="/admin/packing">
            Packing queue
          </Button>
          <Button size="sm" iconLeft={Printer} onClick={() => window.print()} disabled={!slips?.length}>
            Print
          </Button>
        </AdminPageHeader>
      </div>
      <div className={styles.slips}>
        {slips?.map((slip) => <Slip key={slip.order.id} slip={slip} />)}
      </div>
    </>
  );
}

function Slip({ slip: { order, customer } }: { slip: PackingSlip }) {
  const box = useCatalog().getBox(order.boxId);
  const address = customer?.shippingAddress;

  return (
    <article className={styles.slip}>
      <header className={styles.slipHead}>
        <div>
          <div className={styles.wordmark}>bonbon</div>
          <div className={styles.orderNumber}>{order.id}</div>
        </div>
        <div className={styles.shipTo}>
          <b>{order.customerName || customer?.name || "—"}</b>
          {address ? (
            <>
              <span>{address.line1}</span>
              {address.line2 && <span>{address.line2}</span>}
              <span>
                {address.city} {address.postalCode}
              </span>
            </>
          ) : (
            <span>{order.city}</span>
          )}
        </div>
      </header>
      <div className={styles.boxLine}>
        <b>
          {box?.name ?? order.boxId} · {PURCHASE_COPY[order.cadence].label.toLowerCase()}
        </b>
        {order.isGift ? (
          <span className={styles.gift}>
            <Gift size={14} aria-hidden /> Gift — no prices, add a handwritten card
          </span>
        ) : (
          <span>{formatPrice(order.pricePence)}</span>
        )}
      </div>
      <ul className={styles.items}>
        {(order.items ?? []).map((item) => (
          <li key={item}>
            <span className={styles.tick} aria-hidden />
            {item}
          </li>
        ))}
      </ul>
      <footer className={styles.slipFoot}>Arrives {formatDay(order.deliveryDate)} · Royal Mail Tracked 24</footer>
    </article>
  );
}
