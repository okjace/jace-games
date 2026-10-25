import "server-only";

/**
 * A small sliding-window limiter kept in memory. On Vercel each server
 * instance has its own memory, so this is a speed bump against a runaway
 * game or script rather than a hard guarantee; limits that matter more
 * (games created per hour) are counted in the database instead.
 */

const g = globalThis as unknown as { __jgLimits?: Map<string, number[]> };
const hits = (): Map<string, number[]> => (g.__jgLimits ??= new Map());

/** Records a hit for `key` and returns false if there were already `max` in the last `windowMs`. */
export function allow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const map = hits();
  const recent = (map.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    map.set(key, recent);
    return false;
  }
  recent.push(now);
  map.set(key, recent);
  // Keep the map from growing forever.
  if (map.size > 10_000) {
    for (const [k, times] of map) if (!times.some((t) => now - t < windowMs)) map.delete(k);
  }
  return true;
}
