"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { setupCanvas } from "@/components/games/shared";
import { DECOR_ICONS, MAP_LIMITS, THEMES, mapProblem, type MapRow, type MapTheme, type TowerMap } from "@/lib/live/maps";
import { drawMapBase } from "./party/towerMap";
import { card, input, primary, secondary } from "./ui";

/**
 * The Tower Siege map maker. Lay the road by tapping (or dragging) from an
 * edge square to where the castle goes; tap a road square to cut the road
 * back to it. Decorations block building, so they're part of the puzzle.
 */

const CELL = 40;
type Tool = "road" | "decor" | "erase";

const isEdge = (m: TowerMap, x: number, y: number) => x === 0 || y === 0 || x === m.cols - 1 || y === m.rows - 1;

/** Applies one tap of a tool to the map. Returns the same map if nothing changed. */
function paint(m: TowerMap, tool: Tool, x: number, y: number, icon: string, dragging: boolean): TowerMap {
  const at = m.path.findIndex(([px, py]) => px === x && py === y);
  const decorAt = m.decor.findIndex((d) => d.x === x && d.y === y);
  if (tool === "erase") {
    if (at >= 0) return { ...m, path: m.path.slice(0, at) };
    if (decorAt >= 0) return { ...m, decor: m.decor.filter((_, i) => i !== decorAt) };
    return m;
  }
  if (tool === "decor") {
    if (at >= 0) return m;
    if (decorAt >= 0) {
      if (dragging || m.decor[decorAt].icon === icon) return dragging ? m : { ...m, decor: m.decor.filter((_, i) => i !== decorAt) };
      return { ...m, decor: m.decor.map((d, i) => (i === decorAt ? { ...d, icon } : d)) };
    }
    if (m.decor.length >= MAP_LIMITS.maxDecor) return m;
    return { ...m, decor: [...m.decor, { x, y, icon }] };
  }
  // Road.
  if (at >= 0) {
    // Tapping earlier road cuts back to there (the end stays put, so you can keep dragging from it).
    if (dragging || at === m.path.length - 1) return m;
    return { ...m, path: m.path.slice(0, at + 1) };
  }
  const clearDecor = m.decor.filter((d) => !(d.x === x && d.y === y));
  if (m.path.length === 0) return isEdge(m, x, y) ? { ...m, path: [[x, y]], decor: clearDecor } : m;
  const [lx, ly] = m.path[m.path.length - 1];
  if (Math.abs(lx - x) + Math.abs(ly - y) !== 1) return m;
  return { ...m, path: [...m.path, [x, y]], decor: clearDecor };
}

function resize(m: TowerMap, cols: number, rows: number): TowerMap {
  const inside = ([x, y]: [number, number]) => x < cols && y < rows;
  const cut = m.path.findIndex((p) => !inside(p));
  return {
    ...m,
    cols,
    rows,
    path: cut >= 0 ? m.path.slice(0, cut) : m.path,
    decor: m.decor.filter((d) => d.x < cols && d.y < rows),
  };
}

export function MapEditor({ id }: { id: string }) {
  const router = useRouter();
  const [row, setRow] = useState<MapRow | null>(null);
  const [map, setMap] = useState<TowerMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("road");
  const [icon, setIcon] = useState(DECOR_ICONS[0]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ on: boolean; last: string }>({ on: false, last: "" });

  useEffect(() => {
    fetch(`/api/live/maps/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Couldn't load this map.");
        if (!d.mine) throw new Error("You can only edit your own maps.");
        setRow(d.map);
        setMap(d.map.data);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !map) return;
    setupCanvas(c, map.cols * CELL, map.rows * CELL);
    const ctx = c.getContext("2d")!;
    drawMapBase(ctx, map, CELL, { grid: true });
    // Show where the road can go next.
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    const hint = (x: number, y: number) => ctx.fillRect(x * CELL + CELL * 0.35, y * CELL + CELL * 0.35, CELL * 0.3, CELL * 0.3);
    if (tool === "road") {
      if (map.path.length === 0) {
        for (let x = 0; x < map.cols; x++) for (let y = 0; y < map.rows; y++) if (isEdge(map, x, y)) hint(x, y);
      } else {
        const [lx, ly] = map.path[map.path.length - 1];
        const used = new Set(map.path.map(([x, y]) => `${x},${y}`));
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = lx + dx;
          const y = ly + dy;
          if (x >= 0 && y >= 0 && x < map.cols && y < map.rows && !used.has(`${x},${y}`)) hint(x, y);
        }
      }
    }
  }, [map, tool]);

  const save = useCallback(
    async (m: TowerMap, extra: { title?: string; visibility?: "public" | "private" } = {}) => {
      setStatus("saving");
      const res = await fetch(`/api/live/maps/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: m, ...extra }),
      }).catch(() => null);
      const body = await res?.json().catch(() => null);
      if (res?.ok) {
        setStatus("saved");
        setSaveError(null);
        setRow(body.map);
      } else {
        setStatus("error");
        setSaveError(body?.error ?? "Couldn't save. Check your connection.");
      }
    },
    [id],
  );

  const change = (next: TowerMap) => {
    if (next === map) return;
    setMap(next);
    setStatus("unsaved");
  };

  const cellAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!map) return null;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * map.cols);
    const y = Math.floor(((e.clientY - r.top) / r.height) * map.rows);
    return x >= 0 && y >= 0 && x < map.cols && y < map.rows ? { x, y } : null;
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = cellAt(e);
    if (!c || !map) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { on: true, last: `${c.x},${c.y}` };
    change(paint(map, tool, c.x, c.y, icon, false));
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current.on || !map) return;
    const c = cellAt(e);
    if (!c || `${c.x},${c.y}` === drag.current.last) return;
    // A fast drag can skip squares, so walk through every square in between.
    let [x, y] = drag.current.last.split(",").map(Number);
    let next = map;
    while (x !== c.x || y !== c.y) {
      if (Math.abs(c.x - x) >= Math.abs(c.y - y)) x += Math.sign(c.x - x);
      else y += Math.sign(c.y - y);
      next = paint(next, tool, x, y, icon, true);
    }
    drag.current.last = `${c.x},${c.y}`;
    change(next);
  };
  const up = () => {
    drag.current.on = false;
  };

  if (error) {
    return (
      <div className={`${card} mx-auto max-w-md text-center`}>
        <p className="font-semibold">{error}</p>
        <Link href="/live/maps" className={`${secondary} mt-4`}>
          Back to maps
        </Link>
      </div>
    );
  }
  if (!map || !row) return <p className="text-center text-muted">Loading map…</p>;

  const problem = mapProblem(map);
  const remove = async () => {
    if (!confirm(`Delete "${row.title}"? This can't be undone.`)) return;
    const res = await fetch(`/api/live/maps/${id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) router.push("/live/maps");
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/live/maps" className="text-sm text-muted hover:text-foreground">
          ← Maps
        </Link>
        <input
          aria-label="Map name"
          defaultValue={row.title}
          maxLength={60}
          onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== row.title && save(map, { title: e.target.value.trim() })}
          className={`${input} max-w-xs font-semibold`}
        />
        <span className="text-xs text-muted" role="status">
          {status === "saving" ? "Saving…" : status === "unsaved" ? "Not saved yet" : status === "error" ? "Not saved" : "Saved"}
        </span>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => save(map)} disabled={status === "saving" || !!problem} className={primary}>
            Save
          </button>
        </div>
      </div>
      {saveError && <p className="text-sm text-danger">{saveError}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex flex-col gap-2">
          <canvas
            ref={canvasRef}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            style={{ aspectRatio: `${map.cols} / ${map.rows}` }}
            className="touch-game w-full cursor-crosshair rounded-xl border border-line"
            aria-label="Map grid. Tap squares to draw the road or place decorations."
          />
          <p className={`text-sm ${problem ? "text-warn" : "text-muted"}`}>
            {problem ??
              `Road: ${map.path.length} squares from 🚪 to 🏰. Towers can go on any square that isn't road or decoration.`}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <section className={card}>
            <h2 className="mb-2 text-sm font-semibold">Tool</h2>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["road", "🛤️", "Road"],
                  ["decor", "🌲", "Decor"],
                  ["erase", "🧽", "Erase"],
                ] as const
              ).map(([t, emoji, label]) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tool === t}
                  onClick={() => setTool(t)}
                  className={`flex flex-col items-center rounded-xl border py-2 text-xs ${tool === t ? "border-accent bg-accent/10" : "border-line"}`}
                >
                  <span className="text-xl">{emoji}</span>
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              {tool === "road"
                ? map.path.length === 0
                  ? "Start the road on any edge square (the dots)."
                  : "Tap or drag to the next square. Tap a road square to cut the road back to it."
                : tool === "decor"
                  ? "Tap a square to place it, tap again to remove it."
                  : "Tap road to cut it there, or tap a decoration to remove it."}
            </p>
            {tool === "decor" && (
              <div className="mt-2 flex flex-wrap gap-1">
                {DECOR_ICONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-label={`Decoration ${d}`}
                    aria-pressed={icon === d}
                    onClick={() => setIcon(d)}
                    className={`h-9 w-9 rounded-lg border text-lg ${icon === d ? "border-accent bg-accent/10" : "border-line"}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className={card}>
            <h2 className="mb-2 text-sm font-semibold">Look</h2>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(THEMES) as MapTheme[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={map.theme === t}
                  onClick={() => change({ ...map, theme: t })}
                  className={`flex items-center gap-2 rounded-xl border p-2 text-xs ${map.theme === t ? "border-accent bg-accent/10" : "border-line"}`}
                >
                  <span className="h-5 w-5 rounded" style={{ background: `linear-gradient(135deg, ${THEMES[t].grass[0]} 50%, ${THEMES[t].road} 50%)` }} />
                  {THEMES[t].name}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <label className="flex flex-col gap-1">
                Width
                <select value={map.cols} onChange={(e) => change(resize(map, Number(e.target.value), map.rows))} className="h-9 rounded-lg border border-line bg-background px-2">
                  {Array.from({ length: MAP_LIMITS.maxCols - MAP_LIMITS.minCols + 1 }, (_, i) => MAP_LIMITS.minCols + i).map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                Height
                <select value={map.rows} onChange={(e) => change(resize(map, map.cols, Number(e.target.value)))} className="h-9 rounded-lg border border-line bg-background px-2">
                  {Array.from({ length: MAP_LIMITS.maxRows - MAP_LIMITS.minRows + 1 }, (_, i) => MAP_LIMITS.minRows + i).map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
            <button type="button" onClick={() => change({ ...map, path: [], decor: [] })} className="mt-3 text-xs text-muted underline hover:text-foreground">
              Clear everything
            </button>
          </section>

          <section className={card}>
            <h2 className="mb-2 text-sm font-semibold">Sharing</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={row.visibility === "public"}
                disabled={!!problem}
                onChange={(e) => save(map, { visibility: e.target.checked ? "public" : "private" })}
              />
              Let other hosts use this map
            </label>
            <button type="button" onClick={remove} className="mt-3 text-xs text-danger hover:underline">
              Delete map
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
