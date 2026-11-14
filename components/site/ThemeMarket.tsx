"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import type { ThemeSummary } from "@/lib/customThemes";
import { ask } from "./ConfirmBox";
import { signInHref } from "./SiteHeader";
import { pickCustomTheme, setMyTheme, useMyThemeChoice } from "./ThemeContext";

const box = "rounded-3xl border border-line bg-panel p-5 shadow-[0_10px_30px_-18px_rgba(30,20,10,0.25)]";
const pill = "rounded-full px-3 py-1.5 text-xs font-bold transition-transform hover:scale-105 disabled:opacity-50";

type Report = { id: string; reason: string; at: string; theme: ThemeSummary | null };

/** A little picture of a theme: its colours, falling things and icon. */
function Swatch({ t }: { t: ThemeSummary }) {
  const c = t.data.colors;
  return (
    <div className="relative h-24 overflow-hidden rounded-2xl" style={{ background: `linear-gradient(135deg, ${c.background}, ${c.panel})` }}>
      <div className="absolute inset-x-0 bottom-0 h-8" style={{ background: `linear-gradient(90deg, ${t.data.hills[0]}, ${t.data.hills[1]}, ${t.data.hills[2]})` }} />
      <span className="absolute left-3 top-2 text-3xl">{t.icon}</span>
      <span className="absolute right-3 top-2 text-lg tracking-widest">{t.data.particles.slice(0, 3).join("")}</span>
      <span className="absolute bottom-10 left-3 h-4 w-16 rounded-full" style={{ background: `linear-gradient(90deg, ${c.accent}, ${c.accent2})` }} />
    </div>
  );
}

/** /themes: the theme market, plus ur own themes (and reports, for admins). */
export function ThemeMarket() {
  const { user } = useScores();
  const mine = useMyThemeChoice();
  const [sort, setSort] = useState<"popular" | "new">("popular");
  const [q, setQ] = useState("");
  const [market, setMarket] = useState<ThemeSummary[] | null>(null);
  const [made, setMade] = useState<ThemeSummary[]>([]);
  const [installed, setInstalled] = useState<ThemeSummary[]>([]);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const loadMarket = useCallback(() => {
    fetch(`/api/themes?sort=${sort}&q=${encodeURIComponent(q)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { themes: [] }))
      .then((d) => setMarket(d.themes ?? []))
      .catch(() => setMarket([]));
  }, [sort, q]);
  const loadMine = useCallback(() => {
    if (!user) return;
    fetch("/api/themes/mine", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { made: [], installed: [] }))
      .then((d) => {
        setMade(d.made ?? []);
        setInstalled(d.installed ?? []);
      })
      .catch(() => {});
    fetch("/api/themes/reports", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setReports(d.reports ?? []))
      .catch(() => {});
  }, [user]);
  useEffect(() => {
    const t = setTimeout(loadMarket, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [loadMarket, q]);
  useEffect(() => {
    loadMine();
  }, [loadMine]);

  const install = async (t: ThemeSummary) => {
    if (!user) return (window.location.href = signInHref("/themes"));
    const res = await fetch(`/api/themes/${t.id}/install`, { method: "POST" }).catch(() => null);
    if (!res?.ok) return setMsg("couldnt install it :(");
    pickCustomTheme(t);
    setMsg(`using "${t.name}" now 🎉`);
    loadMine();
  };
  const report = async (t: ThemeSummary) => {
    const res = await fetch(`/api/themes/${t.id}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setReporting(null);
    setReason("");
    setMsg(res?.ok ? (body?.already ? "u already reported that one" : "thx, reported 🚩 the site owner will check it") : (body?.error ?? "couldnt report it"));
  };
  const publish = async (t: ThemeSummary, on: boolean) => {
    await fetch(`/api/themes/${t.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ published: on }) }).catch(() => null);
    loadMine();
    loadMarket();
  };
  const del = async (t: ThemeSummary) => {
    if (!(await ask(`delete "${t.name}"? this cant be undone.`))) return;
    await fetch(`/api/themes/${t.id}`, { method: "DELETE" }).catch(() => null);
    if (mine === `custom:${t.id}`) setMyTheme("site");
    loadMine();
    loadMarket();
  };
  const uninstall = async (t: ThemeSummary) => {
    await fetch(`/api/themes/${t.id}?uninstall=1`, { method: "DELETE" }).catch(() => null);
    if (mine === `custom:${t.id}`) setMyTheme("site");
    loadMine();
  };
  const takeDown = async (t: ThemeSummary, removed: boolean) => {
    await fetch(`/api/themes/${t.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ removed }) }).catch(() => null);
    loadMine();
    loadMarket();
  };

  const using = (t: ThemeSummary) => mine === `custom:${t.id}`;
  const applyBtn = (t: ThemeSummary) => (
    <button type="button" onClick={() => pickCustomTheme(t)} disabled={using(t)} className={`${pill} bg-accent text-on-accent`}>
      {using(t) ? "✅ using" : "use"}
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">🛍️ theme market</h1>
          <p className="text-muted">themes made by ppl on Jace Live. install one, or make ur own!!</p>
        </div>
        <Link href="/themes/new" className="rounded-full bg-accent px-5 py-2.5 font-bold text-on-accent shadow-md transition-transform hover:-rotate-1 hover:scale-105">
          + make a theme
        </Link>
      </div>
      {msg && <p className="text-sm font-semibold">{msg}</p>}

      {user && (made.length > 0 || installed.length > 0) && (
        <section className={box}>
          <h2 className="mb-3 font-display text-2xl font-extrabold">🎨 ur themes</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {made.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 rounded-2xl border border-line p-3">
                <Swatch t={t} />
                <p className="font-semibold">
                  {t.name} <span className="text-xs font-normal text-muted">{t.removed ? "· taken down" : t.published ? `· on the market · ${t.installs} installs` : "· just u"}</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {applyBtn(t)}
                  <Link href={`/themes/${t.id}/edit`} className={`${pill} border border-line`}>
                    ✏️ edit
                  </Link>
                  {!t.removed && (
                    <button type="button" onClick={() => void publish(t, !t.published)} className={`${pill} border border-line`}>
                      {t.published ? "🙈 unpublish" : "🛍️ publish"}
                    </button>
                  )}
                  <button type="button" onClick={() => void del(t)} className={`${pill} border border-danger/40 text-danger`}>
                    🗑️
                  </button>
                </div>
              </li>
            ))}
            {installed.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 rounded-2xl border border-line p-3">
                <Swatch t={t} />
                <p className="font-semibold">
                  {t.name} <span className="text-xs font-normal text-muted">· by {t.owner_name}</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {applyBtn(t)}
                  <button type="button" onClick={() => void uninstall(t)} className={`${pill} border border-line`}>
                    remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value.slice(0, 40))} placeholder="find a theme…" aria-label="Find a theme" className="h-10 min-w-0 flex-1 rounded-full border border-line bg-panel px-4 text-sm outline-none focus:border-accent" />
          {(["popular", "new"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSort(s)} aria-pressed={sort === s} className={`rounded-full px-4 py-2 text-sm font-semibold ${sort === s ? "bg-accent text-on-accent" : "border border-line bg-panel"}`}>
              {s === "popular" ? "🔥 popular" : "✨ new"}
            </button>
          ))}
        </div>
        {market === null ? (
          <div className="h-40 animate-pulse rounded-3xl bg-foreground/[.04]" />
        ) : market.length === 0 ? (
          <p className={`${box} text-center text-muted`}>no themes here yet 👀 be the frist to publish one!</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {market.map((t) => (
              <li key={t.id} className={`${box} flex flex-col gap-2 !p-3`}>
                <Swatch t={t} />
                <p className="font-semibold">{t.name}</p>
                <p className="text-xs text-muted">
                  by {t.owner_name} · {t.installs} install{t.installs === 1 ? "" : "s"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {installed.some((x) => x.id === t.id) || made.some((x) => x.id === t.id) ? (
                    applyBtn(t)
                  ) : (
                    <button type="button" onClick={() => void install(t)} className={`${pill} bg-accent text-on-accent`}>
                      ⬇️ install
                    </button>
                  )}
                  {user && t.owner_id !== user.id && (
                    <button type="button" onClick={() => setReporting(reporting === t.id ? null : t.id)} className={`${pill} border border-line`}>
                      🚩 report
                    </button>
                  )}
                  {reports !== null && (
                    <button type="button" onClick={() => void takeDown(t, true)} className={`${pill} border border-danger/40 text-danger`}>
                      take down
                    </button>
                  )}
                </div>
                {reporting === t.id && (
                  <form
                    className="flex gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void report(t);
                    }}
                  >
                    <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 300))} placeholder="whats wrong w/ it?" aria-label="Why are you reporting this theme?" className="h-9 min-w-0 flex-1 rounded-full border border-line bg-background/60 px-3 text-xs outline-none focus:border-accent" />
                    <button type="submit" disabled={!reason.trim()} className={`${pill} bg-danger text-white`}>
                      send
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {reports !== null && (
        <section className={box}>
          <h2 className="mb-3 font-display text-2xl font-extrabold">🚩 theme reports (admin)</h2>
          {reports.length === 0 ? (
            <p className="text-sm text-muted">no reports. evryone&apos;s being nice 😇</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {reports.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-foreground/[.04] px-3 py-2 text-sm">
                  <span className="text-xl">{r.theme?.icon ?? "❔"}</span>
                  <span className="min-w-0 flex-1">
                    <b>{r.theme?.name ?? "(deleted theme)"}</b> {r.theme && <span className="text-muted">by {r.theme.owner_name}</span>}
                    <span className="block text-xs text-muted">&ldquo;{r.reason}&rdquo;</span>
                  </span>
                  {r.theme && (
                    <button type="button" onClick={() => void takeDown(r.theme!, !r.theme!.removed)} className={`${pill} ${r.theme.removed ? "border border-line" : "bg-danger text-white"}`}>
                      {r.theme.removed ? "put back" : "take down"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
