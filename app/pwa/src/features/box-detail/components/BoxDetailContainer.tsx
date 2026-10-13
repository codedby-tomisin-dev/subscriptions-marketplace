"use client";

import { Suspense, useRef, useState } from "react";
import type { Box } from "@/features/catalog";
import { useIsPhone } from "@/shared/hooks";
import { scrollToElement } from "@/shared/utils";
import { useStartSubscription } from "../hooks/useStartSubscription";
import { useStickyBuyBar } from "../hooks/useStickyBuyBar";
import { BoxGallery } from "./BoxGallery";
import { BoxIntro } from "./BoxIntro";
import { ContentsSection, GoodToKnowSection, OtherBoxesSection, RitualSection, TestimonialSection } from "./BoxStorySections";
import { PurchasePlanSheet, PurchaseSection, type PurchaseChoices } from "./PurchaseSection";
import { StickyBuyBar } from "./StickyBuyBar";
import { CheckoutReturnDialog } from "./CheckoutReturnDialog";
import styles from "./BoxDetail.module.css";

/** Offset that clears the sticky nav when jumping to the purchase panel. */
const PURCHASE_SCROLL_OFFSET = 88;

/** The box page. The server page has fetched the box and 404'd unknown or archived ones. */
export function BoxDetailContainer({ box, otherBoxes }: { box: Box; otherBoxes: Box[] }) {
  const purchaseRef = useRef<HTMLElement>(null);
  const showStickyBar = useStickyBuyBar(purchaseRef);
  const purchase = useStartSubscription(box);
  const isPhone = useIsPhone();
  const [isPlanSheetOpen, setIsPlanSheetOpen] = useState(false);

  const scrollToPurchase = () => scrollToElement(purchaseRef.current, PURCHASE_SCROLL_OFFSET);
  const choices: PurchaseChoices = {
    cadence: purchase.cadence,
    onCadenceChange: purchase.setCadence,
    deliveryDates: purchase.deliveryDates,
    firstDelivery: purchase.firstDelivery,
    onFirstDeliveryChange: purchase.setFirstDelivery,
    isGift: purchase.isGift,
    onGiftChange: purchase.setIsGift,
    onStart: purchase.start,
    isStarting: purchase.isStarting,
  };

  return (
    <main>
      <BoxIntro box={box} />
      <div className={`bb-container ${styles.layout}`}>
        <div className={styles.story}>
          <BoxGallery box={box} />
          <RitualSection box={box} />
          <ContentsSection box={box} />
          <GoodToKnowSection box={box} cadence={purchase.cadence} />
          <TestimonialSection box={box} />
        </div>
        <PurchaseSection ref={purchaseRef} box={box} {...choices} />
      </div>
      <OtherBoxesSection boxes={otherBoxes} />
      <StickyBuyBar
        box={box}
        isPhone={isPhone}
        visible={isPhone || showStickyBar}
        onAction={isPhone ? () => setIsPlanSheetOpen(true) : scrollToPurchase}
      />
      <PurchasePlanSheet box={box} {...choices} open={isPhone && isPlanSheetOpen} onClose={() => setIsPlanSheetOpen(false)} />
      {/* Reads the URL, so it renders client-side while the rest of the page is prerendered. */}
      <Suspense fallback={null}>
        <CheckoutReturnDialog box={box} />
      </Suspense>
    </main>
  );
}
