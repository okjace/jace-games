"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import { signInHref } from "@/components/site/SiteHeader";
import type { GameReport, ReportSummary } from "@/lib/live/report";
import { ReportView } from "./ReportView";
import { card, primary, secondary } from "./ui";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** /live/reports: every game you hosted with questions, from the last 90 days. */
export function ReportList() {
  const { user } = useScores();
  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [filter, setFilter] = useState<"all" | "hosted" | "solo">("all");

  useEffect(() => {
    if (!user) return;
    fetch("/api/live/reports", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { reports: [] }))
      .then((d) => setReports(d.reports ?? []))
      .catch(() => setReports([]));
  }, [user]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <Link href="/live" className="text-sm text-muted hover:text-foreground">
          ← Live
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted">What everyone answered in the games you hosted, and your own solo games. Kept for 90 days.</p>
      </div>
      {!user ? (
        <div className={`${card} text-center`}>
          <p className="font-semibold">Sign in with Jace to see your reports.</p>
          <a href={signInHref("/live/reports")} className={`${primary} mt-4`}>
            Sign in with Jace
          </a>
        </div>
      ) : reports === null ? (
        <p className="animate-pulse text-muted">Loading…</p>
      ) : reports.length === 0 ? (
        <p className={`${card} text-sm text-muted`}>
          No reports yet. Host a game or play solo with a question set, and its report shows up here when it ends.
        </p>
      ) : (
        <>
        <div className="flex gap-1 self-start rounded-full border border-line bg-panel p-1 text-sm font-semibold" role="tablist">
          {(
            [
              ["all", `All (${reports.length})`],
              ["hosted", `Hosted (${reports.filter((r) => !r.solo).length})`],
              ["solo", `Solo (${reports.filter((r) => r.solo).length})`],
            ] as const
          ).map(([f, label]) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`rounded-full px-4 py-1.5 ${filter === f ? "bg-accent text-on-accent" : "text-muted"}`}>
              {label}
            </button>
          ))}
        </div>
        <ul className="flex flex-col gap-2">
          {reports.filter((r) => filter === "all" || (filter === "solo") === r.solo).map((r) => (
            <li key={r.id}>
              <Link href={`/live/reports/${r.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-panel p-4 hover:border-accent/50">
                <span className="text-2xl">{r.solo ? "🎮" : "📋"}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{r.setTitle ?? "Untitled set"}</span>
                    {r.solo && <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent">Solo</span>}
                  </span>
                  <span className="block text-sm text-muted">
                    {r.modeName} · {when(r.endedAt)} ·{" "}
                    {r.solo
                      ? `${r.right ?? 0}/${r.answered ?? 0} right${r.answered ? ` (${Math.round(((r.right ?? 0) / r.answered) * 100)}%)` : ""}`
                      : `${r.players} player${r.players === 1 ? "" : "s"} · ${r.questions} questions`}
                  </span>
                </span>
                <span className="text-muted">→</span>
              </Link>
            </li>
          ))}
        </ul>
        </>
      )}
    </div>
  );
}

/** /live/reports/[id]: one saved report. */
export function SavedReport({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<{ report: GameReport; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/live/reports/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Couldn't load this report.");
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const remove = async () => {
    if (!confirm("Delete this report? This can't be undone.")) return;
    const res = await fetch(`/api/live/reports/${id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) router.push("/live/reports");
  };

  if (error) {
    return (
      <div className={`${card} mx-auto max-w-md text-center`}>
        <p className="font-semibold">{error}</p>
        <Link href="/live/reports" className={`${secondary} mt-4`}>
          Back to reports
        </Link>
      </div>
    );
  }
  if (!data) return <p className="animate-pulse text-center text-muted">Loading report…</p>;
  const r = data.report;
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/live/reports" className="text-sm text-muted hover:text-foreground">
            ← Reports
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{r.setTitle ?? "Untitled set"}</h1>
          <p className="text-sm text-muted">
            {r.solo ? "Solo · " : ""}
            {r.modeName} · game {r.code}
            {r.endedAt && ` · ended ${when(r.endedAt)}`} · kept until {new Date(data.expiresAt).toLocaleDateString()}
          </p>
        </div>
        <button type="button" onClick={remove} className="text-sm text-danger hover:underline">
          Delete report
        </button>
      </div>
      <ReportView report={r} />
    </div>
  );
}
