import { LiveHome } from "@/components/live/LiveHome";
import { getThemeChoice } from "@/lib/db/siteSettings";
import { activeSeason } from "@/lib/seasons";

export default async function Home() {
  return <LiveHome season={activeSeason(await getThemeChoice())} />;
}
