import { GameGrid } from "@/components/GameGrid";
import { SyncStatus } from "@/components/SyncStatus";

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Play something quick.</h1>
        <p className="max-w-xl text-muted">
          Ten little games that work with a keyboard or a touchscreen. Sign in with your Jace account to keep your
          scores — including the ones from the old Jace site — and climb the leaderboards everyone on Jace shares.
        </p>
        <div>
          <SyncStatus />
        </div>
      </section>
      <GameGrid />
    </div>
  );
}
