import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import type { Box, BoxStatus } from "@/features/catalog";
import { callFunction, cloudStorage } from "@/shared/api";

/** A box as the editor sends it: no id when creating; item ids only for existing items. */
export type BoxPayload = Omit<Box, "id" | "items"> & { id?: string; items: { id?: string; name: string; inWeeklyBox: boolean }[] };

export interface SaveBoxResult {
  box: Box;
  /** Cadences that got a new Stripe price. */
  stripeUpdated: string[];
  stripeConfigured: boolean;
}

export const saveBox = (box: BoxPayload) => callFunction<{ box: BoxPayload }, SaveBoxResult>("admin_save_box", { box });

export const setBoxStatus = (boxId: string, status: BoxStatus) =>
  callFunction<{ boxId: string; status: BoxStatus }, { ok: boolean }>("admin_set_box_status", { boxId, status });

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Uploads a box photo to Storage (admins only, per storage.rules) and returns its public URL. */
export async function uploadBoxPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > MAX_PHOTO_BYTES) throw new Error("Photos need to be under 5 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const photo = ref(cloudStorage(), `boxes/${crypto.randomUUID()}.${extension}`);
  await uploadBytes(photo, file, { contentType: file.type });
  return getDownloadURL(photo);
}
