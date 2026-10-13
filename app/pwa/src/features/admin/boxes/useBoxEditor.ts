import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";
import { useCatalog } from "@/features/catalog";
import { describeError } from "@/shared/api";
import { saveBox, setBoxStatus, uploadBoxPhoto } from "./api";
import { draftFromBox, emptyDraft, payloadFromDraft, type BoxDraft } from "./boxDraft";

/** Form state and actions for creating (`boxId` null) or editing a box. */
export function useBoxEditor(boxId: string | null) {
  const router = useRouter();
  const { showToast } = useToast();
  const { boxes, getBox, isLoading } = useCatalog();
  const existing = boxId ? getBox(boxId) : undefined;
  // The form starts from the catalog once it has loaded, then is the user's to edit.
  const [draft, setDraft] = useState<BoxDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const loadedDraft = draft ?? (isLoading ? null : existing ? draftFromBox(existing) : boxId ? null : emptyDraft(boxes.length));

  const update = useCallback(
    (patch: Partial<BoxDraft>) => setDraft((current) => ({ ...(current ?? loadedDraft!), ...patch })),
    [loadedDraft],
  );

  const save = useCallback(async () => {
    if (!loadedDraft) return;
    const built = payloadFromDraft(loadedDraft);
    if ("error" in built) {
      showToast({ tone: "danger", title: "Check the prices", message: built.error });
      return;
    }
    setIsSaving(true);
    try {
      const result = await saveBox(built.payload);
      const stripe = !result.stripeConfigured
        ? "Stripe isn’t set up here, so prices weren’t synced."
        : result.stripeUpdated.length
          ? "New prices apply to new subscribers; existing ones keep theirs."
          : undefined;
      showToast({ tone: "success", title: boxId ? "Box saved" : `${result.box.name} created`, message: stripe });
      setDraft(null);
      if (!boxId) router.replace(`/admin/boxes/${result.box.id}`);
    } catch (error) {
      showToast({ tone: "danger", title: "Couldn’t save the box", message: describeError(error) });
    } finally {
      setIsSaving(false);
    }
  }, [loadedDraft, boxId, router, showToast]);

  const toggleArchived = useCallback(async () => {
    if (!existing) return;
    const status = existing.status === "active" ? "archived" : "active";
    try {
      await setBoxStatus(existing.id, status);
      setDraft(null);
      showToast({
        tone: "success",
        title: status === "archived" ? `${existing.name} archived` : `${existing.name} is back on sale`,
        message: status === "archived" ? "It’s off the storefront. Existing subscriptions carry on." : undefined,
      });
    } catch (error) {
      showToast({ tone: "danger", title: "That didn’t go through", message: describeError(error) });
    }
  }, [existing, showToast]);

  const uploadPhoto = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        update({ image: await uploadBoxPhoto(file) });
      } catch (error) {
        showToast({ tone: "danger", title: "Couldn’t upload that photo", message: error instanceof Error ? error.message : describeError(error) });
      } finally {
        setIsUploading(false);
      }
    },
    [update, showToast],
  );

  return {
    draft: loadedDraft,
    existing,
    notFound: !isLoading && !!boxId && !existing,
    isDirty: draft !== null,
    update,
    save,
    isSaving,
    toggleArchived,
    uploadPhoto,
    isUploading,
  };
}
