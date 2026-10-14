"use client";

import { Check, Pencil, Plus, Sparkles, TriangleAlert } from "lucide-react";
import { Badge, Button, ProductImage } from "@/components/ui";
import { useCatalog } from "@/features/catalog";
import { toneSurface } from "@/shared/types";
import { formatPrice } from "@/shared/utils";
import type { StockItem, StockReport } from "../api";
import { AdminPageHeader, AdminPanel, adminStyles as admin, Bar, ReportState } from "../shared";
import { useStock } from "./useStock";
import styles from "./Stock.module.css";

// Bars show stock against three rounds' worth, so "plenty" still has headroom on the scale.
const BAR_ROUNDS = 3;

export function StockContainer() {
  const { data, error, reorder, reorderingId } = useStock();
  return (
    <>
      <AdminPageHeader title="Boxes & stock" subtitle="What’s going into the next round of boxes, and whether we have enough of it.">
        <Button size="sm" variant="secondary" iconLeft={Sparkles} href="/admin/boxes/new?generate=1">
          Generate with AI
        </Button>
        <Button size="sm" iconLeft={Plus} href="/admin/boxes/new">
          New box
        </Button>
      </AdminPageHeader>
      {data ? <StockView report={data} onReorder={reorder} reorderingId={reorderingId} /> : <ReportState error={error} />}
      <ArchivedBoxes />
    </>
  );
}

interface StockViewProps {
  report: StockReport;
  onReorder: (itemId: string) => void;
  reorderingId: string | null;
}

function StockView({ report, onReorder, reorderingId }: StockViewProps) {
  const { getBox } = useCatalog();
  return (
    <div className={styles.boxes}>
      {report.boxes.map(({ boxId, weekly, monthly, items }) => {
        const box = getBox(boxId);
        if (!box) return null;
        const low = items.filter((item) => item.stock < item.needed).length;
        return (
          <AdminPanel key={boxId} className={styles.panel}>
            <div className={styles.box}>
              <div className={styles.summary}>
                <div className={styles.image} style={{ background: toneSurface(box.tone) }}>
                  <ProductImage src={box.image} tone={box.tone} ratio="4 / 3" radius="var(--radius-md)" label={box.name} background="var(--cream-0)" sizes="240px" />
                </div>
                <div className={styles.titleLine}>
                  <h2 className={admin.h2}>{box.name}</h2>
                  <Button size="sm" variant="ghost" iconLeft={Pencil} href={`/admin/boxes/${box.id}`} ariaLabel={`Edit ${box.name}`}>
                    Edit
                  </Button>
                  {low > 0 ? (
                    <Badge tone="blush" icon={TriangleAlert} size="sm">
                      {low} low
                    </Badge>
                  ) : (
                    <Badge tone="sage" icon={Check} size="sm">
                      Stocked
                    </Badge>
                  )}
                </div>
                <div className={styles.counts}>
                  <div>
                    <div className={admin.num} style={{ fontSize: 20 }}>
                      {weekly}
                    </div>
                    weekly · {formatPrice(box.prices.week)}
                  </div>
                  <div>
                    <div className={admin.num} style={{ fontSize: 20 }}>
                      {monthly}
                    </div>
                    monthly · {formatPrice(box.prices.month)}
                  </div>
                </div>
              </div>
              <div className={styles.items}>
                <div className={`${styles.itemRow} ${styles.itemHead}`}>
                  <span>Item</span>
                  <span>Stock vs needed for next round</span>
                  <span />
                </div>
                {items.map((item) => (
                  <ItemRow key={item.itemId} item={item} onReorder={onReorder} isReordering={reorderingId === item.itemId} />
                ))}
              </div>
            </div>
          </AdminPanel>
        );
      })}
    </div>
  );
}

function ArchivedBoxes() {
  const archived = useCatalog().boxes.filter((box) => box.status === "archived");
  if (!archived.length) return null;
  return (
    <AdminPanel title="Archived" className={styles.archived}>
      <p className={admin.muted}>Off the storefront. Anyone still subscribed keeps getting their box.</p>
      <ul className={styles.archivedList}>
        {archived.map((box) => (
          <li key={box.id}>
            <span className={admin.strong}>{box.name}</span>
            <Button size="sm" variant="ghost" iconLeft={Pencil} href={`/admin/boxes/${box.id}`}>
              Edit
            </Button>
          </li>
        ))}
      </ul>
    </AdminPanel>
  );
}

const roundsLeft = (rounds: number) => `${rounds} round${rounds === 1 ? "" : "s"} left`;

function ItemRow({ item, onReorder, isReordering }: { item: StockItem; onReorder: (itemId: string) => void; isReordering: boolean }) {
  const isShort = item.stock < item.needed;
  const scale = Math.max(1, item.needed * BAR_ROUNDS);
  return (
    <div className={styles.itemRow}>
      <span className={styles.itemName}>{item.name}</span>
      <div className={styles.level}>
        <div className={styles.levelBar}>
          <Bar
            percent={(Math.min(item.stock, scale) / scale) * 100}
            color={isShort ? "var(--blush-600)" : "var(--sage-500)"}
            label={`${item.stock} in stock, ${item.needed} needed`}
          />
        </div>
        <span className={styles.levelText} data-short={isShort || undefined}>
          {item.stock} / {item.needed}
        </span>
      </div>
      <span className={styles.itemAction}>
        {isShort ? (
          <Button size="sm" variant="soft" onClick={() => onReorder(item.itemId)} loading={isReordering}>
            Reorder
          </Button>
        ) : (
          <span className={admin.subtle}>{item.needed ? roundsLeft(Math.floor(item.stock / item.needed)) : "Not needed yet"}</span>
        )}
      </span>
    </div>
  );
}
