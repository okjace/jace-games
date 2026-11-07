"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GameReport } from "@/lib/live/report";
import { ReportView } from "./ReportView";
import { card } from "./ui";

/** The live report on the host screen. Refreshes while the game is on. */
export function HostReport({ code, live }: { code: string; live: boolean }) {
  const [report, setReport] = useState<GameReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch(`/api/live/games/${code}/report`, { cache: "no-store" })
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error ?? "Couldn't load the answers.");
          if (!stop) setReport(d);
        })
        .catch((e) => !stop && setError(e.message));
    void load();
    const t = live ? setInterval(() => document.visibilityState === "visible" && void load(), 5000) : null;
    return () => {
      stop = true;
      if (t) clearInterval(t);
    };
  }, [code, live]);

  return (
    <section className={`${card} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">📋 Answers</h2>
        <Link href="/live/reports" className="text-sm text-accent hover:underline">
          All your reports →
        </Link>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : report ? <ReportView report={report} /> : <p className="animate-pulse text-sm text-muted">Loading answers…</p>}
      {!live && <p className="text-xs text-muted">This report is saved under Reports for 90 days.</p>}
    </section>
  );
}
