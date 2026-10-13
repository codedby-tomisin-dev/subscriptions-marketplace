import { fetchActiveBoxes } from "@/features/catalog";
import { HomeContainer } from "@/features/home";

// Catalog edits in the admin show up within a minute.
export const revalidate = 60;

export default async function HomePage() {
  return <HomeContainer boxes={await fetchActiveBoxes()} />;
}
