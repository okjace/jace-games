"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import { signInHref } from "@/components/site/SiteHeader";
import { timeAgo } from "@/lib/format";
import { MAX_GAME_BYTES, gameBytes } from "@/lib/studio/limits";
import { BLOCKS_LIVE_TEXT, SDK_ITEMS, SDK_LIMITS_TEXT } from "@/lib/studio/sdkDocs";
import { gamePrompt, readGameAnswer } from "@/lib/aiHelper";
import { AiBadge, CopyPaste, MadeWithAi } from "@/components/AiHelper";
import { GameFrame, type LogEntry, type RoomLink } from "./GameFrame";
import { api, card, input, primary, secondary, small } from "./ui";
import { ask } from "@/components/site/ConfirmBox";

// Both editors only work in the browser, and Blockly is big: load them when needed.
const CodeEditor = dynamic(() => import("./CodeEditor").then((m) => m.CodeEditor), { ssr: false, loading: () => <EditorLoading /> });
const BlocksEditor = dynamic(() => import("./BlocksEditor").then((m) => m.BlocksEditor), { ssr: false, loading: () => <EditorLoading /> });

function EditorLoading() {
  return <div className="h-full animate-pulse rounded-xl border border-line bg-foreground/[.03]" />;
}

type Multiplayer = { mode: "race" | "live"; min: number; max: number } | null;
type Meta = { title: string; description: string; icon: string; multiplayer: Multiplayer; live_mode: boolean; ai: "helper" | "self" | null };
type GameResponse = {
  meta: Meta & { id: string; kind: "code" | "blocks"; published: boolean; removed: boolean; owner_id: string };
  game: { html: string } | null;
  draft: { html: string; blocks_json: object | null; published: boolean; removed: boolean } | null;
  isOwner: boolean;
};
type Version = { version: number; created_at: string; size: number };

const snapshot = (meta: Meta, html: string, blocks: object | null) => JSON.stringify([meta, html, blocks]);

export function Editor({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useScores();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [kind, setKind] = useState<"code" | "blocks">("code");
  const [meta, setMeta] = useState<Meta>({ title: "", description: "", icon: "🎮", multiplayer: null, live_mode: false, ai: null });
  const [html, setHtml] = useState("");
  const [blocks, setBlocks] = useState<object | null>(null);
  const [blocksKey, setBlocksKey] = useState(0);
  const [saved, setSaved] = useState("");
  const [published, setPublished] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [publishedHtml, setPublishedHtml] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [panel, setPanel] = useState<"settings" | "versions" | "ai" | null>(null);
  const [aiIdea, setAiIdea] = useState("");
  const [aiChange, setAiChange] = useState(false);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [blocksCode, setBlocksCode] = useState("");

  // Preview
  const [previewHtml, setPreviewHtml] = useState("");
  const [autoRun, setAutoRun] = useState(true);
  const [runKey, setRunKey] = useState(0);
  // Live only now: no two-copy room test (kept off).
  const twoPlayer = false;
  const [logs, setLogs] = useState<(LogEntry & { n: number; who?: string })[]>([]);
  const logN = useRef(0);

  useEffect(() => {
    if (!user) return;
    api<GameResponse>(`/api/studio/games/${id}`)
      .then((d) => {
        if (!d.isOwner || !d.draft) {
          setLoadError("You can only edit your own games.");
          return;
        }
        const m: Meta = { title: d.meta.title, description: d.meta.description, icon: d.meta.icon, multiplayer: d.meta.multiplayer, live_mode: !!d.meta.live_mode, ai: d.meta.ai ?? null };
        setKind(d.meta.kind);
        setMeta(m);
        setHtml(d.draft.html);
        setBlocks(d.draft.blocks_json);
        setPreviewHtml(d.draft.html);
        setPublished(d.draft.published);
        setRemoved(d.draft.removed);
        setPublishedHtml(d.game?.html ?? null);
        setSaved(snapshot(m, d.draft.html, d.draft.blocks_json));
        setLoaded(true);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [id, user]);

  const current = snapshot(meta, html, blocks);
  const dirty = loaded && current !== saved;
  const bytes = useMemo(() => gameBytes(html, kind === "blocks" ? blocks : null), [html, blocks, kind]);

  // Code games re-run a moment after you stop typing.
  useEffect(() => {
    if (!autoRun || kind !== "code") return;
    const t = setTimeout(() => setPreviewHtml(html), 700);
    return () => clearTimeout(t);
  }, [html, autoRun, kind]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = useCallback(async (): Promise<boolean> => {
    if (bytes > MAX_GAME_BYTES) {
      setNotice({ kind: "error", text: `This game is ${Math.ceil(bytes / 1024)} KB; the most is ${MAX_GAME_BYTES / 1024} KB.` });
      return false;
    }
    setBusy("save");
    try {
      await api(`/api/studio/games/${id}`, { method: "PATCH", body: { ...meta, html, blocks_json: kind === "blocks" ? blocks : null } });
      setSaved(snapshot(meta, html, blocks));
      setVersions(null);
      setNotice(null);
      return true;
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
      return false;
    } finally {
      setBusy(null);
    }
  }, [id, meta, html, blocks, kind, bytes]);

  // Ctrl/Cmd+S anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  async function publish(next: boolean) {
    if (next && dirty && !(await save())) return;
    setBusy("publish");
    try {
      await api(`/api/studio/games/${id}/publish`, { method: "POST", body: { published: next } });
      setPublished(next);
      if (next) setPublishedHtml(html);
      setNotice({ kind: "info", text: next ? "Published! Anyone can play it on Community now." : "Unpublished. Its hidden from Community." });
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function convertToCode() {
    if (!(await ask("Turn this game into code? U can edit evrything as HTML and JavaScript afterwards, but u cant go back to blocks."))) return;
    setBusy("convert");
    try {
      const code = html;
      await api(`/api/studio/games/${id}`, { method: "PATCH", body: { ...meta, kind: "code", html: code } });
      setKind("code");
      setBlocks(null);
      setSaved(snapshot(meta, code, null));
      setNotice({ kind: "info", text: "Converted. This game is code now." });
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!(await ask(`Delete "${meta.title}" for good? Its scores and versions go too.`))) return;
    try {
      await api(`/api/studio/games/${id}`, { method: "DELETE" });
      router.push("/studio");
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
    }
  }

  async function openVersions() {
    setPanel(panel === "versions" ? null : "versions");
    if (versions) return;
    try {
      setVersions((await api<{ versions: Version[] }>(`/api/studio/games/${id}/versions`)).versions);
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
    }
  }

  async function restore(version: number) {
    if (dirty && !(await ask("Replace ur unsaved changes w/ this version?"))) return;
    try {
      const v = await api<{ html: string; blocks_json: object | null }>(`/api/studio/games/${id}/versions/${version}`);
      if (kind === "blocks" && v.blocks_json) {
        setBlocks(v.blocks_json);
        setBlocksKey((k) => k + 1);
      }
      setHtml(v.html);
      setPreviewHtml(v.html);
      setNotice({ kind: "info", text: `Restored version ${version}. Save to keep it.` });
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
    }
  }

  const addLog = useCallback((entry: LogEntry, who?: string) => {
    logN.current++;
    const n = logN.current;
    setLogs((cur) => [...cur.slice(-99), { ...entry, n, who }]);
  }, []);

  const onBlocks = useCallback((json: object, compiled: string, code: string, first: boolean) => {
    setBlocks(json);
    setHtml(compiled);
    setBlocksCode(code);
    setPreviewHtml(compiled);
    // The editor reformats blocks as it loads them; that isn't a change.
    if (first) setSaved((s) => (s ? JSON.stringify([JSON.parse(s)[0], compiled, json]) : s));
  }, []);

  const links = useMemo(() => (twoPlayer ? localRoom(meta.multiplayer?.mode ?? "live") : null), [twoPlayer, meta.multiplayer?.mode]);

  if (!user) {
    return (
      <div className={`${card} mx-auto max-w-md text-center`}>
        <p className="text-4xl">🛠️</p>
        <h1 className="mt-2 text-xl font-bold">Sign in to use the Game Studio</h1>
        <a href={signInHref(`/studio/${id}`)} className={`${primary} mt-4`}>
          Sign in w/ Jace
        </a>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className={`${card} mx-auto max-w-md text-center`}>
        <p className="text-sm text-danger">{loadError}</p>
        <Link href="/studio" className={`${secondary} mt-4`}>
          Back to the studio
        </Link>
      </div>
    );
  }
  if (!loaded) return <div className="h-[70vh] animate-pulse rounded-2xl bg-foreground/[.04]" aria-busy="true" />;

  const changedSincePublish = published && publishedHtml !== html;
  const name = user.username;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/studio" className="text-sm text-muted hover:text-foreground" aria-label="Back to the studio">
            ←
          </Link>
          <span className="text-3xl" aria-hidden="true">
            {meta.icon}
          </span>
          <div className="min-w-0">
            <h1 className="flex min-w-0 items-center gap-2 truncate text-xl font-bold tracking-tight">
              <span className="truncate">{meta.title || "Untitled"}</span>
              <AiBadge ai={meta.ai} />
            </h1>
            <p className="text-xs text-muted">
              {kind === "blocks" ? "Blocks" : "Code"} · {(bytes / 1024).toFixed(1)} / {MAX_GAME_BYTES / 1024} KB ·{" "}
              {removed ? (
                <span className="text-danger">Taken down by the site owner</span>
              ) : published ? (
                changedSincePublish ? (
                  "Published (w/ newer changes)"
                ) : (
                  "Published"
                )
              ) : (
                "Not published"
              )}
              {dirty && " · Unsaved changes"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={small} onClick={() => setPanel(panel === "ai" ? null : "ai")} aria-expanded={panel === "ai"}>
            ✨ AI helper
          </button>
          <button type="button" className={small} onClick={() => setPanel(panel === "settings" ? null : "settings")} aria-expanded={panel === "settings"}>
            ⚙️ Settings
          </button>
          <button type="button" className={small} onClick={openVersions} aria-expanded={panel === "versions"}>
            🕘 Versions
          </button>
          {kind === "blocks" && (
            <button type="button" className={small} onClick={convertToCode} disabled={!!busy}>
              {"</>"} Convert to code
            </button>
          )}
          <button type="button" className={secondary} onClick={() => void save()} disabled={!dirty || !!busy}>
            {busy === "save" ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
          {published && (
            <Link href={`/community/${id}`} className={secondary}>
              View
            </Link>
          )}
          {published && !changedSincePublish && !dirty ? (
            <button type="button" className={secondary} onClick={() => publish(false)} disabled={!!busy}>
              Unpublish
            </button>
          ) : (
            <button type="button" className={primary} onClick={() => publish(true)} disabled={!!busy || removed}>
              {busy === "publish" ? "Publishing…" : published ? "Publish changes" : "Publish"}
            </button>
          )}
        </div>
      </div>

      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={`rounded-2xl border px-4 py-3 text-sm ${notice.kind === "error" ? "border-danger/40 bg-danger/10 text-danger" : "border-accent/40 bg-accent/10"}`}
        >
          {notice.text}
        </p>
      )}

      {panel === "ai" && (
        <div className={`${card} flex flex-col gap-3 p-4`}>
          <h2 className="font-display text-lg font-extrabold">✨ AI helper</h2>
          {kind === "blocks" ? (
            <p className="text-sm text-muted">the AI helper writes code, so it works in code games. use &ldquo;Convert to code&rdquo; first (or make a new code game).</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 text-sm" role="radiogroup" aria-label="Make a new game or change this one">
                {[false, true].map((c) => (
                  <button key={String(c)} type="button" role="radio" aria-checked={aiChange === c} onClick={() => setAiChange(c)} className={`rounded-full px-3 py-1.5 font-semibold ${aiChange === c ? "bg-accent text-on-accent" : "border border-line hover:bg-accent/10"}`}>
                    {c ? "🛠️ change my game" : "🆕 make a new game"}
                  </button>
                ))}
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold">{aiChange ? "what should change?" : "describe ur game idea"}</span>
                <textarea value={aiIdea} onChange={(e) => setAiIdea(e.target.value.slice(0, 1500))} rows={3} placeholder={aiChange ? "make the rocks faster n add a shield u can buy for 20 coins" : "a fishing game where u spend coins on bait n rods, rarer fish = more points"} className="w-full rounded-xl border border-line bg-background/60 p-2 outline-none focus:border-accent" />
              </label>
              <CopyPaste
                prompt={gamePrompt(aiIdea || "(describe ur idea above)", aiChange ? html : undefined)}
                disabled={!aiIdea.trim()}
                pasteLabel="🎮 use this code"
                onPaste={(text) => {
                  const code = readGameAnswer(text);
                  if (!code) return "couldnt find game code in that. paste the AI's whole answer (with the ```html part).";
                  setHtml(code);
                  setMeta((m) => ({ ...m, ai: "helper" }));
                  return null;
                }}
              />
            </>
          )}
        </div>
      )}
      {panel === "settings" && (
        <Settings meta={meta} setMeta={setMeta} onDelete={remove} published={published} onUnpublish={() => publish(false)} />
      )}
      {panel === "versions" && (
        <div className={`${card} p-4`}>
          <h2 className="mb-2 text-sm font-semibold">Saved versions</h2>
          <p className="mb-3 text-xs text-muted">Every save that changes the code keeps a version (the last 30). Restoring puts it in the editor; save to keep it.</p>
          {!versions ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : (
            <ul className="max-h-60 divide-y divide-line overflow-auto">
              {versions.map((v) => (
                <li key={v.version} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-12 font-mono text-muted">v{v.version}</span>
                  <span className="flex-1">{timeAgo(v.created_at)}</span>
                  <span className="text-xs text-muted">{(v.size / 1024).toFixed(1)} KB</span>
                  <button type="button" className={small} onClick={() => restore(v.version)}>
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        <section className="h-[70vh] min-h-[420px]" aria-label={kind === "blocks" ? "Blocks" : "Code"}>
          {kind === "code" ? (
            <CodeEditor value={html} onChange={setHtml} onSave={() => void save()} />
          ) : (
            <BlocksEditor key={blocksKey} initial={blocks} onChange={onBlocks} />
          )}
        </section>
        <section className="flex min-w-0 flex-col gap-3" aria-label="Preview">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-sm font-semibold">Preview</h2>
            {kind === "code" && (
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" checked={autoRun} onChange={(e) => setAutoRun(e.target.checked)} /> Auto-run
              </label>
            )}
            <button
              type="button"
              className={small}
              onClick={() => {
                setPreviewHtml(html);
                setRunKey((k) => k + 1);
                setLogs([]);
              }}
            >
              ▶ Run
            </button>
          </div>
          {links ? (
            <div className="grid grid-cols-2 gap-2">
              {links.map((link, i) => (
                <div key={i}>
                  <GameFrame
                    html={previewHtml}
                    playerName={i === 0 ? name : "Player 2"}
                    room={link}
                    runKey={runKey}
                    title={`${meta.title} preview, player ${i + 1}`}
                    onLog={(e) => addLog(e, `P${i + 1}`)}
                    onScore={(s) => addLog({ level: "info", text: `jace.submitScore(${s})` }, `P${i + 1}`)}
                    onGameOver={(w) => addLog({ level: "info", text: `jace.gameOver(${w ? `{ winners: [${w.join(", ")}] }` : ""})` }, `P${i + 1}`)}
                  />
                  <p className="mt-1 text-center text-xs text-muted">Player {i + 1}{i === 0 ? " (host)" : ""}</p>
                </div>
              ))}
            </div>
          ) : (
            <GameFrame
              html={previewHtml}
              playerName={name}
              runKey={runKey}
              title={`${meta.title} preview`}
              onLog={addLog}
              onScore={(s) => addLog({ level: "info", text: `jace.submitScore(${s}) — scores are saved when people play it from Community.` })}
              onGameOver={(w) => addLog({ level: "info", text: `jace.gameOver(${w ? `{ winners: [${w.join(", ")}] }` : ""})` })}
            />
          )}
          <p className="text-xs text-muted">Click da game to give it the keyboard.</p>
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-line bg-panel">
            <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
              <span className="text-xs font-semibold">Console</span>
              <button type="button" className="text-xs text-muted hover:text-foreground" onClick={() => setLogs([])}>
                Clear
              </button>
            </div>
            <ul className="max-h-48 min-h-20 overflow-auto p-2 font-mono text-xs">
              {logs.length === 0 && <li className="text-muted">console.log and errors from da game show up here.</li>}
              {logs.map((l) => (
                <li key={l.n} className={l.level === "error" ? "text-danger" : l.level === "warn" ? "text-warn" : l.level === "info" ? "text-accent" : ""}>
                  {l.who && <span className="text-muted">[{l.who}] </span>}
                  {l.text}
                </li>
              ))}
            </ul>
          </div>
          {kind === "blocks" && blocksCode && (
            <details className="rounded-xl border border-line bg-panel p-3 text-xs">
              <summary className="cursor-pointer font-semibold">The JavaScript ur blocks make</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-muted">{blocksCode}</pre>
            </details>
          )}
        </section>
      </div>
      <SdkHelp />
    </div>
  );
}

function Settings({
  meta,
  setMeta,
  onDelete,
  published,
  onUnpublish,
}: {
  meta: Meta;
  setMeta: (m: Meta) => void;
  onDelete: () => void;
  published: boolean;
  onUnpublish: () => void;
}) {
  return (
    <div className={`${card} grid gap-4 p-4 sm:grid-cols-2`}>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Name</span>
        <input className={input} value={meta.title} maxLength={60} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Icon (one emoji)</span>
        <input className={input} value={meta.icon} maxLength={16} onChange={(e) => setMeta({ ...meta, icon: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="font-medium">Description</span>
        <textarea
          className={`${input} h-20 py-2`}
          value={meta.description}
          maxLength={500}
          onChange={(e) => setMeta({ ...meta, description: e.target.value })}
        />
      </label>
      <div className="sm:col-span-2">
        <MadeWithAi value={meta.ai} onChange={(ai) => setMeta({ ...meta, ai })} />
      </div>
      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <span aria-hidden="true" className="mt-0.5">📺</span>
        <span>
          <span className="font-medium">Every Jace Live game is a Live mode</span>
          <span className="block text-muted">
            Players earn coins by answering questions. <code>jace.live.coins</code> is the total they&apos;ve earned (your game keeps track
            of what it spends), <code>jace.live.onCoins(fn)</code> tells u when it goes up, and <code>jace.live.earn()</code> sends them to
            answer questions. Report progress with <code>jace.submitScore(n)</code>; a score counts up to 20× the coins earned. Others can only
            host it once it&apos;s published.
          </span>
        </span>
      </label>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        {published && (
          <button type="button" className={small} onClick={onUnpublish}>
            Unpublish
          </button>
        )}
        <button type="button" className={`${small} text-danger`} onClick={onDelete}>
          Delete game
        </button>
      </div>
    </div>
  );
}

function SdkHelp() {
  return (
    <details className={`${card} p-4 text-sm`}>
      <summary className="cursor-pointer font-semibold">The Jace game SDK (window.jace) for Live</summary>
      <p className="mt-2 text-xs text-muted">evry Studio game is a Jace Live mode: playas earn coins by answering questions, and ur game is what they spend them on.</p>
      <div className="mt-3 grid gap-1.5 text-xs leading-relaxed text-muted">
        {SDK_ITEMS.map(([k, v]) => (
          <p key={k}>
            <span className="font-mono text-foreground">{k}</span> — {v}
          </p>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">{BLOCKS_LIVE_TEXT}</p>
      <p className="mt-2 text-xs text-muted">{SDK_LIMITS_TEXT}</p>
    </details>
  );
}

/** Two players connected to each other in the preview, to try jace.room without a room. */
function localRoom(mode: "race" | "live"): [RoomLink, RoomLink] {
  const subs = [new Set<(from: number, event: string, data: unknown) => void>(), new Set<(from: number, event: string, data: unknown) => void>()];
  const players = (me: number) => [
    { seat: 0, name: "Player 1", you: me === 0, host: true },
    { seat: 1, name: "Player 2", you: me === 1, host: false },
  ];
  const link = (i: 0 | 1): RoomLink => ({
    mode,
    isHost: i === 0,
    mySeat: i,
    players: players(i),
    send: (event, data) => setTimeout(() => subs[1 - i].forEach((fn) => fn(i, event, data)), 0),
    subscribe: (fn) => {
      subs[i].add(fn);
      return () => void subs[i].delete(fn);
    },
  });
  return [link(0), link(1)];
}
