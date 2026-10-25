"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import { signInHref } from "@/components/site/SiteHeader";
import { timeAgo } from "@/lib/format";
import { blockTemplate } from "@/lib/studio/blockTemplates";
import { TEMPLATES, templateHtml, type Template } from "@/lib/studio/templates";
import { api, card, primary, secondary } from "./ui";

type Summary = {
  id: string;
  title: string;
  icon: string;
  kind: "code" | "blocks";
  published: boolean;
  removed: boolean;
  multiplayer: unknown;
  plays: number;
  updated_at: string;
};

/** The blocks version of the 2-player template is a simpler game than the code one. */
function label(t: Template, kind: "code" | "blocks"): { name: string; icon: string; description: string } {
  if (kind === "blocks" && t.id === "duel") return { name: "Tap Race", icon: "👆", description: "2 players: first to 30 taps wins. Uses messages to play online." };
  return t;
}

/** /studio: your games, and "New game" (code or blocks, from a template). */
export function StudioHome() {
  const { user } = useScores();
  const router = useRouter();
  const [games, setGames] = useState<Summary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [kind, setKind] = useState<"code" | "blocks">("code");
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ games: Summary[] }>("/api/studio/games")
      .then((d) => setGames(d.games))
      .catch((e: Error) => setError(e.message));
  }, [user]);

  if (!user) {
    return (
      <div className={`${card} mx-auto max-w-md text-center`}>
        <p className="text-5xl">🛠️</p>
        <h1 className="mt-2 text-xl font-bold">Game Studio</h1>
        <p className="mt-1 text-sm text-muted">Make your own games with code or blocks, then share them with everyone. Sign in with Jace to start.</p>
        <a href={signInHref("/studio")} className={`${primary} mt-4`}>
          Sign in with Jace
        </a>
      </div>
    );
  }

  async function create(t: Template) {
    setCreating(t.id);
    setError(null);
    try {
      let html = templateHtml(t.id);
      let blocks: object | null = null;
      if (kind === "blocks") {
        blocks = blockTemplate(t.id);
        const { compileBlocks } = await import("@/lib/studio/blocks");
        html = await compileBlocks(blocks!);
      }
      const shown = label(t, kind);
      const { game } = await api<{ game: { id: string } }>("/api/studio/games", {
        method: "POST",
        body: { title: t.id === "blank" ? "My game" : shown.name, icon: shown.icon, description: shown.description, kind, html, blocks_json: blocks, multiplayer: t.multiplayer },
      });
      router.push(`/studio/${game.id}`);
    } catch (e) {
      setError((e as Error).message);
      setCreating(null);
    }
  }

  const templates = TEMPLATES.filter((t) => kind === "code" || blockTemplate(t.id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Game Studio</h1>
          <p className="mt-1 text-muted">Make a game with code or blocks, publish it, and play it with friends.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/community" className={secondary}>
            Community games
          </Link>
          <button type="button" className={primary} onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
            + New game
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {picking && (
        <section className={`${card} flex flex-col gap-4`} aria-label="New game">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold">Start from</h2>
            <div className="flex rounded-full border border-line p-1 text-sm" role="radiogroup" aria-label="Editor">
              {(["code", "blocks"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={`rounded-full px-4 py-1.5 ${kind === k ? "bg-accent font-medium text-on-accent" : "text-muted hover:text-foreground"}`}
                >
                  {k === "code" ? "</> Code" : "🧩 Blocks"}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted">{kind === "code" ? "HTML, CSS and JavaScript." : "Snap blocks together, Scratch style."}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={!!creating}
                onClick={() => create(t)}
                className="flex items-start gap-3 rounded-2xl border border-line bg-background p-4 text-left transition-colors hover:border-accent disabled:opacity-60"
              >
                <span className="text-3xl" aria-hidden="true">
                  {label(t, kind).icon}
                </span>
                <span>
                  <span className="block font-semibold">
                    {label(t, kind).name}
                    {t.multiplayer && <span title="Multiplayer"> 👥</span>}
                  </span>
                  <span className="block text-sm text-muted">{label(t, kind).description}</span>
                  {creating === t.id && <span className="mt-1 block text-xs text-accent">Making it…</span>}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Your games">
        <h2 className="mb-3 text-lg font-semibold">Your games</h2>
        {!games ? (
          <div className="h-32 animate-pulse rounded-2xl bg-foreground/[.04]" aria-busy="true" />
        ) : games.length === 0 ? (
          <div className={`${card} text-center text-sm text-muted`}>No games yet. Press “New game” to make your first one.</div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((g) => (
              <li key={g.id}>
                <Link href={`/studio/${g.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-panel p-4 transition-colors hover:border-accent">
                  <span className="text-3xl" aria-hidden="true">
                    {g.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {g.title}
                      {!!g.multiplayer && <span title="Multiplayer"> 👥</span>}
                    </span>
                    <span className="block text-xs text-muted">
                      {g.kind === "blocks" ? "Blocks" : "Code"} · {g.removed ? <span className="text-danger">Taken down</span> : g.published ? `Published · ${g.plays} plays` : "Draft"} · {timeAgo(g.updated_at)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
