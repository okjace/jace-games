"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import { DEFAULT_THEME, cleanTheme, type MusicMood, type ThemeData, type ThemeSummary, type TreeKind } from "@/lib/customThemes";
import type { ClickSound, Motion } from "@/lib/seasons";
import { ask } from "./ConfirmBox";
import { signInHref } from "./SiteHeader";
import { pickCustomTheme, previewCustomTheme } from "./ThemeContext";

const box = "rounded-3xl border border-line bg-panel p-5 shadow-[0_10px_30px_-18px_rgba(30,20,10,0.25)]";
const field = "h-10 w-full rounded-xl border border-line bg-background/60 px-3 text-sm outline-none focus:border-accent";
const label = "flex flex-col gap-1 text-sm font-semibold";

/** Emoji typed with spaces between them ("🍂 🍁 🌰") ⇄ a list. */
const toList = (s: string) => s.split(/\s+/).map((x) => x.trim()).filter(Boolean);

/**
 * The theme maker: build a theme (colours, falling things, hills, trees,
 * sounds, music, even CSS) with the whole site previewing it live, then
 * save it to ur account, use it, or publish it on the theme market.
 */
export function ThemeMaker({ id }: { id?: string }) {
  const { user } = useScores();
  const router = useRouter();
  const [data, setData] = useState<ThemeData>(DEFAULT_THEME);
  const [meta, setMeta] = useState<ThemeSummary | null>(null);
  const [loaded, setLoaded] = useState(!id);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/themes/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.theme) {
          setMeta(d.theme);
          setData(cleanTheme(d.theme.data));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [id]);

  // The whole site shows the theme while u make it.
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => previewCustomTheme(data), 120);
    return () => clearTimeout(t);
  }, [data, loaded]);
  useEffect(() => () => previewCustomTheme(null), []);

  const set = <K extends keyof ThemeData>(k: K, v: ThemeData[K]) => setData((d) => ({ ...d, [k]: v }));

  const save = async (opts: { use?: boolean; publish?: boolean } = {}) => {
    setBusy(true);
    setStatus("saving…");
    const body = { data, ...(opts.publish !== undefined ? { published: opts.publish } : {}) };
    const res = meta
      ? await fetch(`/api/themes/${meta.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null)
      : await fetch("/api/themes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const out = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok || !out?.theme) return setStatus(out?.error ?? "couldnt save :(");
    let theme: ThemeSummary = out.theme;
    // A new theme gets published with a second save (now that it exists).
    if (!meta && opts.publish) {
      const r2 = await fetch(`/api/themes/${theme.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ published: true }) }).catch(() => null);
      const o2 = await r2?.json().catch(() => null);
      if (o2?.theme) theme = o2.theme;
    }
    setMeta(theme);
    if (opts.use) pickCustomTheme(theme);
    setStatus(opts.publish ? "published on the theme market!! 🛍️" : opts.use ? "saved n using it now 🎉" : "saved ✅ (its in ur themes)");
    if (!id) router.replace(`/themes/${theme.id}/edit`);
  };

  const remove = async () => {
    if (!meta || !(await ask(`delete "${data.name}"? this cant be undone.`))) return;
    await fetch(`/api/themes/${meta.id}`, { method: "DELETE" }).catch(() => null);
    router.push("/themes");
  };

  if (!user) {
    return (
      <div className={`${box} mx-auto flex max-w-md flex-col items-center gap-3 py-10 text-center`}>
        <p className="text-5xl">🎨</p>
        <h1 className="font-display text-2xl font-extrabold">make ur own theme</h1>
        <p className="text-sm text-muted">sign in w/ Jace to make themes (they get saved to ur account).</p>
        <a href={signInHref("/themes/new")} className="rounded-full bg-accent px-5 py-2 font-semibold text-on-accent">
          sign in
        </a>
      </div>
    );
  }
  if (!loaded) return <div className="h-64 animate-pulse rounded-3xl bg-foreground/[.04]" />;

  const color = (k: keyof ThemeData["colors"], name: string) => (
    <label className={label}>
      {name}
      <input type="color" value={data.colors[k]} onChange={(e) => set("colors", { ...data.colors, [k]: e.target.value })} className="h-10 w-full cursor-pointer rounded-xl border border-line" />
    </label>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/themes" className="text-sm text-muted hover:text-foreground">
            ← themes
          </Link>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">🎨 theme maker</h1>
          <p className="text-muted">the hole site shows ur theme while u make it. go wild!!</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void save()} className="rounded-full border border-line bg-panel px-4 py-2 text-sm font-semibold hover:bg-accent/10 disabled:opacity-50">
            💾 save
          </button>
          <button type="button" disabled={busy} onClick={() => void save({ use: true })} className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-on-accent disabled:opacity-50">
            ✅ save n use it
          </button>
          <button type="button" disabled={busy} onClick={() => void save({ publish: !meta?.published })} className="rounded-full border border-line bg-panel px-4 py-2 text-sm font-semibold hover:bg-accent/10 disabled:opacity-50">
            {meta?.published ? "🙈 take off market" : "🛍️ publish to market"}
          </button>
        </div>
      </div>
      {status && <p className="text-sm font-semibold">{status}</p>}

      <section className={`${box} grid gap-3 sm:grid-cols-[1fr_120px]`}>
        <label className={label}>
          name
          <input value={data.name} maxLength={40} onChange={(e) => set("name", e.target.value)} className={field} />
        </label>
        <label className={label}>
          icon
          <input value={data.icon} maxLength={12} onChange={(e) => set("icon", e.target.value)} className={`${field} text-center text-xl`} />
        </label>
        <label className={`${label} sm:col-span-2`}>
          greeting on the home page
          <input value={data.greeting} maxLength={100} onChange={(e) => set("greeting", e.target.value)} className={field} />
        </label>
      </section>

      <section className={box}>
        <h2 className="mb-3 font-display text-xl font-extrabold">🎨 colors</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {color("accent", "main color")}
          {color("accent2", "2nd color")}
          {color("background", "background")}
          {color("panel", "cards")}
          {color("line", "lines")}
        </div>
      </section>

      <section className={box}>
        <h2 className="mb-3 font-display text-xl font-extrabold">❄️ falling stuff</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={`${label} sm:col-span-3`}>
            what falls (emoji, spaces between)
            <input value={data.particles.join(" ")} onChange={(e) => set("particles", toList(e.target.value))} className={`${field} text-lg`} />
          </label>
          <label className={label}>
            how it moves
            <select value={data.motion} onChange={(e) => set("motion", e.target.value as Motion)} className={field}>
              <option value="fall">falls n sways</option>
              <option value="snow">snow</option>
              <option value="rise">floats up</option>
              <option value="drift">drifts sideways</option>
              <option value="twinkle">twinkles</option>
            </select>
          </label>
          <label className={`${label} sm:col-span-2`}>
            how much ({data.density})
            <input type="range" min={0} max={60} value={data.density} onChange={(e) => set("density", Number(e.target.value))} className="accent-[var(--accent)]" />
          </label>
          <label className={`${label} sm:col-span-3`}>
            garland under the menu
            <input value={data.garland} maxLength={120} onChange={(e) => set("garland", e.target.value)} className={`${field} text-lg`} />
          </label>
        </div>
      </section>

      <section className={box}>
        <h2 className="mb-3 font-display text-xl font-extrabold">⛰️ the bottom of the page</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={label}>
            back hills
            <input type="color" value={data.hills[0]} onChange={(e) => set("hills", [e.target.value, data.hills[1], data.hills[2]])} className="h-10 w-full rounded-xl border border-line" />
          </label>
          <label className={label}>
            middle hills
            <input type="color" value={data.hills[1]} onChange={(e) => set("hills", [data.hills[0], e.target.value, data.hills[2]])} className="h-10 w-full rounded-xl border border-line" />
          </label>
          <label className={label}>
            front hills
            <input type="color" value={data.hills[2]} onChange={(e) => set("hills", [data.hills[0], data.hills[1], e.target.value])} className="h-10 w-full rounded-xl border border-line" />
          </label>
          <label className={`${label} sm:col-span-3`}>
            stuff on the hills (emoji)
            <input value={data.props.join(" ")} onChange={(e) => set("props", toList(e.target.value))} className={`${field} text-lg`} />
          </label>
          <label className={label}>
            corner trees
            <select value={data.tree.kind} onChange={(e) => set("tree", { ...data.tree, kind: e.target.value as TreeKind })} className={field}>
              <option value="round">leafy</option>
              <option value="pine">pine</option>
              <option value="bare">spooky bare</option>
              <option value="palm">palm</option>
              <option value="none">no trees</option>
            </select>
          </label>
          <div className={`${label} sm:col-span-2`}>
            leaves n trunk
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <input
                  key={i}
                  type="color"
                  aria-label={`Leaf color ${i + 1}`}
                  value={data.tree.leaves[i]}
                  onChange={(e) => set("tree", { ...data.tree, leaves: data.tree.leaves.map((c, j) => (j === i ? e.target.value : c)) })}
                  className="h-10 flex-1 rounded-xl border border-line"
                />
              ))}
              <input type="color" aria-label="Trunk color" value={data.tree.trunk} onChange={(e) => set("tree", { ...data.tree, trunk: e.target.value })} className="h-10 flex-1 rounded-xl border border-line" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={data.tree.lights} onChange={(e) => set("tree", { ...data.tree, lights: e.target.checked })} className="accent-[var(--accent)]" />
            💡 lights (pine trees)
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={data.tree.snow} onChange={(e) => set("tree", { ...data.tree, snow: e.target.checked })} className="accent-[var(--accent)]" />
            ❄️ snow (pine trees)
          </label>
          <label className={label}>
            flyby (emoji that flies past)
            <input value={data.flyby} maxLength={12} onChange={(e) => set("flyby", e.target.value)} className={`${field} text-lg`} />
          </label>
        </div>
      </section>

      <section className={box}>
        <h2 className="mb-3 font-display text-xl font-extrabold">🔊 sound n music</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            click sound
            <select value={data.click} onChange={(e) => set("click", e.target.value as ClickSound)} className={field}>
              {(["pop", "chime", "jingle", "crunch", "spooky", "splash", "zap", "boing"] as const).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            music mood
            <select value={data.mood} onChange={(e) => set("mood", e.target.value as MusicMood)} className={field}>
              <option value="happy">happy</option>
              <option value="cozy">cozy</option>
              <option value="spooky">spooky</option>
              <option value="jingly">jingly</option>
              <option value="chill">chill</option>
              <option value="hype">hype</option>
            </select>
          </label>
        </div>
      </section>

      <details className={box}>
        <summary className="cursor-pointer font-display text-xl font-extrabold">🧑‍💻 extra CSS (advanced)</summary>
        <p className="mt-2 text-xs text-muted">
          add ur own CSS to style anything. it only shows for ppl using ur theme. no links to outside stuff (url() n @import get removed). tip: start rules w/ <code>:root[data-season=&quot;custom&quot;]</code>.
        </p>
        <textarea
          value={data.css}
          onChange={(e) => set("css", e.target.value.slice(0, 6000))}
          spellCheck={false}
          rows={10}
          placeholder={'main h1 { text-shadow: 3px 3px 0 var(--accent2); }\n.font-display { letter-spacing: 0.05em; }'}
          className="mt-3 w-full rounded-xl border border-line bg-background/60 p-3 font-mono text-xs outline-none focus:border-accent"
        />
      </details>

      {meta && (
        <button type="button" onClick={() => void remove()} className="self-start rounded-full border border-danger/40 px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/10">
          🗑️ delete this theme
        </button>
      )}
    </div>
  );
}
