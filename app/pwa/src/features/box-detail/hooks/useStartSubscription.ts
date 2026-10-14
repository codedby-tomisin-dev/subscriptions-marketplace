import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui";
import { useAuth } from "@/features/auth";
import { boxOptions, type Box, type PurchaseOption } from "@/features/catalog";
import { createCheckoutSession } from "@/features/subscriptions";
import { describeError } from "@/shared/api";
import { upcomingDeliveryDates } from "@/shared/utils";
import { savePendingPurchase, takePendingPurchase } from "../storage";

/** Index of the default first-delivery slot (a little breathing room, like the design). */
const DEFAULT_DATE_INDEX = 2;

/**
 * Purchase-panel choices for one box (a subscription, or a single box), and the action that sends them to Stripe Checkout.
 * Signed-out customers sign in first; their choices are kept and restored on return.
 */
export function useStartSubscription(box: Box) {
  const { user, openSignIn } = useAuth();
  const { showToast } = useToast();
  const deliveryDates = useMemo(() => upcomingDeliveryDates(new Date()), []);
  const options = useMemo(() => boxOptions(box), [box]);
  // Monthly is the one most people pick, where it's offered.
  const [option, setOption] = useState<PurchaseOption>(options.includes("month") ? "month" : options[0]);
  const [firstDelivery, setFirstDelivery] = useState(deliveryDates[DEFAULT_DATE_INDEX]);
  const [isGift, setIsGift] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Restore choices made before the sign-in detour.
  useEffect(() => {
    const pending = takePendingPurchase(box.id);
    if (!pending) return;
    if (options.includes(pending.cadence)) setOption(pending.cadence);
    setIsGift(pending.isGift);
    if (deliveryDates.includes(pending.firstDelivery)) setFirstDelivery(pending.firstDelivery);
  }, [box.id, deliveryDates, options]);

  const start = async () => {
    const purchase = { boxId: box.id, cadence: option, firstDelivery, isGift };
    if (!user) {
      savePendingPurchase(purchase);
      openSignIn(`/boxes/${box.id}`);
      return;
    }
    setIsStarting(true);
    try {
      window.location.assign(await createCheckoutSession(purchase));
    } catch (error) {
      setIsStarting(false);
      showToast({ tone: "danger", title: "Couldn’t start checkout", message: describeError(error) });
    }
  };

  return { deliveryDates, options, option, setOption, firstDelivery, setFirstDelivery, isGift, setIsGift, start, isStarting };
}
