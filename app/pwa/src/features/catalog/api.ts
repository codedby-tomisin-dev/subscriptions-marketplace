import { collection, doc, getDoc, getDocs, onSnapshot } from "firebase/firestore";
import { firestore } from "@/shared/api";
import type { Box } from "./types";

const toBox = (id: string, data: object) => ({ id, image: null, testimonial: null, ...data }) as Box;

export const sortBoxes = (boxes: Box[]) => [...boxes].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

/** Every box, archived included, live. For client components (account, admin). */
export function watchBoxes(onChange: (boxes: Box[]) => void, onError: (error: Error) => void) {
  return onSnapshot(
    collection(firestore(), "boxes"),
    (snapshot) => onChange(sortBoxes(snapshot.docs.map((item) => toBox(item.id, item.data())))),
    onError,
  );
}

/**
 * The boxes on sale, for server-rendered storefront pages. An unreachable
 * catalog renders an empty shelf rather than failing the build; pages
 * revalidate, so it fills in once Firestore answers.
 */
export async function fetchActiveBoxes(): Promise<Box[]> {
  try {
    const snapshot = await getDocs(collection(firestore(), "boxes"));
    return sortBoxes(snapshot.docs.map((item) => toBox(item.id, item.data())).filter((box) => box.status === "active"));
  } catch (error) {
    console.error("Couldn’t load the catalog:", error);
    return [];
  }
}

export async function fetchBox(id: string): Promise<Box | null> {
  try {
    const snapshot = await getDoc(doc(firestore(), "boxes", id));
    return snapshot.exists() ? toBox(snapshot.id, snapshot.data()) : null;
  } catch (error) {
    console.error(`Couldn’t load box ${id}:`, error);
    return null;
  }
}
