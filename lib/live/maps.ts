/**
 * Tower Siege maps. Shared by the server (which checks every map before
 * saving it) and the browser (the map maker and the game).
 *
 * A map is a grid with a road: a list of cells from an edge of the grid to
 * the castle, each one next to the one before (no diagonals, no repeats).
 * Towers go on any cell that isn't road. Decorations are just for looks.
 */

export type MapTheme = "meadow" | "desert" | "snow" | "lava";
export type Decor = { x: number; y: number; icon: string };
export type TowerMap = { cols: number; rows: number; theme: MapTheme; path: [number, number][]; decor: Decor[] };

export const DECOR_ICONS = ["🌲", "🌳", "🪨", "🌸", "🌵", "💧", "⛄", "🔥", "🍄", "🌻"];

export const THEMES: Record<MapTheme, { name: string; grass: [string, string]; road: string; edge: string }> = {
  meadow: { name: "Meadow", grass: ["#4a8c3f", "#438237"], road: "#d2b48c", edge: "#a8875d" },
  desert: { name: "Desert", grass: ["#e9c46a", "#e2b955"], road: "#b08158", edge: "#8c6239" },
  snow: { name: "Snowfield", grass: ["#eef6fb", "#dfeef7"], road: "#9fb4c3", edge: "#7b93a6" },
  lava: { name: "Lava Lands", grass: ["#3b2a2a", "#332323"], road: "#ff7b3a", edge: "#c2410c" },
};

export const MAP_LIMITS = { minCols: 8, maxCols: 16, minRows: 6, maxRows: 10, minPath: 8, maxDecor: 60 };

/** The built-in map. */
export const DEFAULT_MAP: TowerMap = {
  cols: 12,
  rows: 8,
  theme: "meadow",
  path: [
    [0, 1], [1, 1], [2, 1], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [4, 5], [5, 5], [6, 5], [6, 4], [6, 3], [6, 2], [7, 2],
    [8, 2], [9, 2], [9, 3], [9, 4], [9, 5], [9, 6], [10, 6], [11, 6],
  ],
  decor: [
    { x: 1, y: 4, icon: "🌲" },
    { x: 0, y: 6, icon: "🌳" },
    { x: 5, y: 1, icon: "🪨" },
    { x: 11, y: 1, icon: "🌲" },
    { x: 7, y: 7, icon: "🌸" },
  ],
};

const isEdge = (m: { cols: number; rows: number }, x: number, y: number) => x === 0 || y === 0 || x === m.cols - 1 || y === m.rows - 1;

/** Why a map can't be used, or null if it's fine. */
export function mapProblem(m: TowerMap): string | null {
  if (m.cols < MAP_LIMITS.minCols || m.cols > MAP_LIMITS.maxCols || m.rows < MAP_LIMITS.minRows || m.rows > MAP_LIMITS.maxRows) return "The map size isn't allowed.";
  if (m.path.length < MAP_LIMITS.minPath) return `The road needs at least ${MAP_LIMITS.minPath} squares.`;
  const [sx, sy] = m.path[0];
  if (!isEdge(m, sx, sy)) return "The road has to start at the edge of the map.";
  const seen = new Set<string>();
  for (let i = 0; i < m.path.length; i++) {
    const [x, y] = m.path[i];
    if (x < 0 || y < 0 || x >= m.cols || y >= m.rows) return "The road goes off the map.";
    const k = `${x},${y}`;
    if (seen.has(k)) return "The road crosses itself.";
    seen.add(k);
    if (i > 0) {
      const [px, py] = m.path[i - 1];
      if (Math.abs(px - x) + Math.abs(py - y) !== 1) return "Every road square has to touch the one before it.";
    }
  }
  return null;
}

/** Cleans a map from the editor (or a request). Returns the map or why it's not valid. */
export function cleanMap(raw: unknown): { ok: true; map: TowerMap } | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const int = (v: unknown, lo: number, hi: number, d: number) => (Number.isInteger(v) ? Math.min(hi, Math.max(lo, v as number)) : d);
  const cols = int(r.cols, MAP_LIMITS.minCols, MAP_LIMITS.maxCols, 12);
  const rows = int(r.rows, MAP_LIMITS.minRows, MAP_LIMITS.maxRows, 8);
  const theme = (Object.keys(THEMES) as MapTheme[]).find((t) => t === r.theme) ?? "meadow";
  const path = (Array.isArray(r.path) ? r.path : [])
    .slice(0, cols * rows)
    .filter((p): p is [number, number] => Array.isArray(p) && p.length === 2 && Number.isInteger(p[0]) && Number.isInteger(p[1]))
    .map(([x, y]) => [x, y] as [number, number]);
  const onPath = new Set(path.map(([x, y]) => `${x},${y}`));
  const decor = (Array.isArray(r.decor) ? r.decor : [])
    .map((d) => d as Record<string, unknown>)
    .filter((d) => Number.isInteger(d.x) && Number.isInteger(d.y) && typeof d.icon === "string" && DECOR_ICONS.includes(d.icon))
    .map((d) => ({ x: d.x as number, y: d.y as number, icon: d.icon as string }))
    .filter((d) => d.x >= 0 && d.y >= 0 && d.x < cols && d.y < rows && !onPath.has(`${d.x},${d.y}`))
    .slice(0, MAP_LIMITS.maxDecor);
  const map = { cols, rows, theme, path, decor };
  const problem = mapProblem(map);
  return problem ? { ok: false, error: problem } : { ok: true, map };
}

export type MapRow = {
  id: string;
  owner_id: string;
  owner_name: string;
  title: string;
  mode: "tower";
  data: TowerMap;
  visibility: "public" | "private";
  plays: number;
  removed: boolean;
  created_at: string;
  updated_at: string;
};
