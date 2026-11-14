/**
 * Snake Arena: everyone's snake in one big arena (inspired by the
 * .io snake games, all original). Steer toward your finger or mouse, eat
 * glowing food to grow, boost to go fast (it costs length), and make other
 * snakes crash their head into your body. Crash and you burst into food,
 * then come right back as a little snake. Right answers grow you and fill
 * your boost. Longest snake when time's up wins (your longest counts).
 *
 * The host's screen runs this simulation (a solo player's phone runs it for
 * them) and sends everyone a snapshot several times a second; phones send
 * their steering back. Bots join so the arena never feels empty.
 */

export const ARENA = 2400;
const SPACING = 6;
const BASE_SPEED = 150;
const BOOST_SPEED = 290;
const TURN_RATE = 4.2;
const START_LEN = 14;
const FOOD_TARGET = 260;
const RESPAWN_MS = 2200;
/** Snakes there are always at least this many of (bots fill the gaps). */
const MIN_SNAKES = 7;

export const SNAKE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#84cc16", "#06b6d4", "#f43f5e", "#a855f7"];
const BOT_NAMES = ["noodle", "wiggles", "sir slithers", "danger noodle", "spaghetti", "zoomie", "lil worm", "hissy fit", "mr snek", "slinky"];

export type Food = { x: number; y: number; v: number; c: string };
export type Snake = {
  id: string;
  name: string;
  color: string;
  bot: boolean;
  /** Head first. */
  pts: { x: number; y: number }[];
  /** How many points of body it has (length). */
  len: number;
  angle: number;
  target: number;
  boost: boolean;
  fuel: number;
  alive: boolean;
  deadUntil: number;
  best: number;
  kills: number;
};

/** What phones get several times a second (rounded and thinned out to keep it small). */
export type Snapshot = {
  t: number;
  /** id, name, colour, alive, length, best, then the body as [x, y, x, y, …] (every few points). */
  s: [string, string, string, 0 | 1, number, number, number[]][];
  /** Food as [x, y, value, colourIndex, …]. */
  f: number[];
  /** Recent events for the feed ("noodle ate ur mom"). */
  e: string[];
};

const FOOD_COLORS = ["#f87171", "#fbbf24", "#a3e635", "#34d399", "#38bdf8", "#a78bfa", "#f472b6"];

export const radiusOf = (len: number) => 7 + Math.min(13, len / 28);

export class Arena {
  snakes = new Map<string, Snake>();
  food: Food[] = [];
  events: string[] = [];
  private nextColor = 0;

  constructor() {
    for (let i = 0; i < FOOD_TARGET; i++) this.food.push(this.randomFood());
  }

  private randomFood(): Food {
    return { x: 40 + Math.random() * (ARENA - 80), y: 40 + Math.random() * (ARENA - 80), v: 1 + Math.floor(Math.random() * 2), c: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)] };
  }

  private spawnSnake(s: Snake) {
    const x = 200 + Math.random() * (ARENA - 400);
    const y = 200 + Math.random() * (ARENA - 400);
    s.angle = s.target = Math.random() * Math.PI * 2;
    s.pts = Array.from({ length: START_LEN }, (_, i) => ({ x: x - Math.cos(s.angle) * i * SPACING, y: y - Math.sin(s.angle) * i * SPACING }));
    s.len = START_LEN;
    s.alive = true;
    s.boost = false;
  }

  /** Adds a player (or brings back one who left). */
  join(id: string, name: string, bot = false): Snake {
    let s = this.snakes.get(id);
    if (!s) {
      s = { id, name, color: SNAKE_COLORS[this.nextColor++ % SNAKE_COLORS.length], bot, pts: [], len: START_LEN, angle: 0, target: 0, boost: false, fuel: 0, alive: false, deadUntil: 0, best: START_LEN, kills: 0 };
      this.snakes.set(id, s);
      this.spawnSnake(s);
    }
    s.name = name;
    return s;
  }

  leave(id: string) {
    this.snakes.delete(id);
  }

  /** Steering from a phone: the angle to head toward, and whether to boost. */
  steer(id: string, angle: number, boost: boolean) {
    const s = this.snakes.get(id);
    if (!s || !Number.isFinite(angle)) return;
    s.target = angle;
    s.boost = !!boost;
  }

  /** A right answer: grow, and fill the boost tank. */
  feed(id: string, amount: number) {
    const s = this.snakes.get(id);
    if (!s) return;
    s.len += amount;
    s.fuel = Math.min(12, s.fuel + 3);
    s.best = Math.max(s.best, Math.round(s.len));
  }

  /** Keeps bots topping the arena up to MIN_SNAKES (and drops them as people join). */
  private balanceBots() {
    const people = [...this.snakes.values()].filter((s) => !s.bot).length;
    const bots = [...this.snakes.values()].filter((s) => s.bot);
    const want = Math.max(0, MIN_SNAKES - people);
    for (let i = bots.length; i < want; i++) this.join(`bot-${i}-${Math.random().toString(36).slice(2, 6)}`, `🤖 ${BOT_NAMES[i % BOT_NAMES.length]}`, true);
    for (let i = want; i < bots.length; i++) this.snakes.delete(bots[i].id);
  }

  private botThink(s: Snake) {
    const h = s.pts[0];
    // Turn away from walls, otherwise head for the nearest food (with a little wander).
    const margin = 160;
    if (h.x < margin || h.y < margin || h.x > ARENA - margin || h.y > ARENA - margin) {
      s.target = Math.atan2(ARENA / 2 - h.y, ARENA / 2 - h.x);
      return;
    }
    if (Math.random() < 0.08) {
      let best: Food | null = null;
      let bd = 400 * 400;
      for (const f of this.food) {
        const d = (f.x - h.x) ** 2 + (f.y - h.y) ** 2;
        if (d < bd) {
          bd = d;
          best = f;
        }
      }
      s.target = best ? Math.atan2(best.y - h.y, best.x - h.x) : s.target + (Math.random() - 0.5);
    }
    s.boost = s.len > 40 && Math.random() < 0.01 ? true : s.boost && Math.random() < 0.97;
  }

  private kill(s: Snake, by: Snake | null, now: number) {
    s.alive = false;
    s.deadUntil = now + RESPAWN_MS;
    // Burst into food.
    for (let i = 0; i < s.pts.length; i += 3) {
      const p = s.pts[i];
      this.food.push({ x: p.x + (Math.random() - 0.5) * 10, y: p.y + (Math.random() - 0.5) * 10, v: 2 + Math.floor(s.len / 80), c: s.color });
    }
    s.pts = [];
    if (by) by.kills++;
    this.events.unshift(by ? `${by.name} got ${s.name} 💥` : `${s.name} bonked the wall 🧱`);
    this.events = this.events.slice(0, 5);
  }

  step(dt: number, now: number) {
    this.balanceBots();
    const live = [...this.snakes.values()];
    for (const s of live) {
      if (!s.alive) {
        if (now >= s.deadUntil) this.spawnSnake(s);
        continue;
      }
      if (s.bot) this.botThink(s);
      // Turn toward the target angle (the short way round).
      let d = s.target - s.angle;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const turn = TURN_RATE * dt * (s.boost ? 0.8 : 1);
      s.angle += Math.max(-turn, Math.min(turn, d));
      // Boosting burns fuel first, then length (dropping a trail of food).
      let boosting = false;
      if (s.boost) {
        if (s.fuel > 0) {
          s.fuel = Math.max(0, s.fuel - dt);
          boosting = true;
        } else if (s.len > START_LEN + 4) {
          s.len -= 6 * dt;
          boosting = true;
          if (Math.random() < dt * 6) {
            const tail = s.pts[s.pts.length - 1];
            if (tail) this.food.push({ x: tail.x, y: tail.y, v: 1, c: s.color });
          }
        }
      }
      const speed = boosting ? BOOST_SPEED : BASE_SPEED;
      const h = s.pts[0];
      const nx = h.x + Math.cos(s.angle) * speed * dt;
      const ny = h.y + Math.sin(s.angle) * speed * dt;
      // Lay down points every SPACING pixels.
      const last = s.pts[0];
      const moved = Math.hypot(nx - last.x, ny - last.y);
      if (moved >= SPACING) s.pts.unshift({ x: nx, y: ny });
      else s.pts[0] = { x: nx, y: ny };
      while (s.pts.length > Math.max(2, Math.round(s.len))) s.pts.pop();
      // Walls.
      if (nx < 0 || ny < 0 || nx > ARENA || ny > ARENA) this.kill(s, null, now);
    }
    // Head into someone else's body: you're done (and they get the credit).
    for (const s of live) {
      if (!s.alive) continue;
      const h = s.pts[0];
      const r = radiusOf(s.len);
      for (const o of live) {
        if (o === s || !o.alive) continue;
        const or = radiusOf(o.len);
        const reach = (r + or) * 0.8;
        // Quick check on the whole snake's box first.
        for (let i = 0; i < o.pts.length; i += 2) {
          const p = o.pts[i];
          if (Math.abs(p.x - h.x) < reach && Math.abs(p.y - h.y) < reach && (p.x - h.x) ** 2 + (p.y - h.y) ** 2 < reach * reach) {
            this.kill(s, o, now);
            break;
          }
        }
        if (!s.alive) break;
      }
    }
    // Eating.
    for (const s of live) {
      if (!s.alive) continue;
      const h = s.pts[0];
      const reach = radiusOf(s.len) + 10;
      for (let i = this.food.length - 1; i >= 0; i--) {
        const f = this.food[i];
        if (Math.abs(f.x - h.x) < reach && Math.abs(f.y - h.y) < reach) {
          s.len += f.v;
          this.food.splice(i, 1);
        }
      }
      s.best = Math.max(s.best, Math.round(s.len));
    }
    while (this.food.length < FOOD_TARGET) this.food.push(this.randomFood());
    if (this.food.length > FOOD_TARGET * 3) this.food.splice(0, this.food.length - FOOD_TARGET * 3);
  }

  snapshot(now: number): Snapshot {
    const s: Snapshot["s"] = [];
    for (const sn of this.snakes.values()) {
      const body: number[] = [];
      // Every other point, rounded, at most 160 numbers per snake.
      const stride = Math.max(2, Math.ceil(sn.pts.length / 80));
      for (let i = 0; i < sn.pts.length; i += stride) body.push(Math.round(sn.pts[i].x), Math.round(sn.pts[i].y));
      s.push([sn.id, sn.name, sn.color, sn.alive ? 1 : 0, Math.round(sn.len), sn.best, body]);
    }
    const f: number[] = [];
    for (const fd of this.food) f.push(Math.round(fd.x), Math.round(fd.y), fd.v, Math.max(0, FOOD_COLORS.indexOf(fd.c)));
    return { t: now, s, f, e: this.events };
  }
}

export const foodColor = (i: number, fallback = "#fbbf24") => FOOD_COLORS[i] ?? fallback;

/** Draws a snapshot. `camera`: the world point at the centre and the zoom; null fits the whole arena. */
export function drawArena(ctx: CanvasRenderingContext2D, w: number, h: number, snap: Snapshot | null, camera: { x: number; y: number; zoom: number } | null, me: string | null, now: number) {
  const zoom = camera ? camera.zoom : Math.min(w, h) / ARENA;
  const cx = camera ? camera.x : ARENA / 2;
  const cy = camera ? camera.y : ARENA / 2;
  ctx.save();
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-cx, -cy);
  // The floor: a soft hex-ish grid of dots inside the arena.
  ctx.fillStyle = "#131c33";
  ctx.fillRect(0, 0, ARENA, ARENA);
  ctx.fillStyle = "rgba(148,163,184,0.12)";
  const step = 60;
  const x0 = Math.max(0, Math.floor((cx - w / 2 / zoom) / step) * step);
  const y0 = Math.max(0, Math.floor((cy - h / 2 / zoom) / step) * step);
  const x1 = Math.min(ARENA, cx + w / 2 / zoom);
  const y1 = Math.min(ARENA, cy + h / 2 / zoom);
  for (let x = x0; x <= x1; x += step) for (let y = y0; y <= y1; y += step) ctx.fillRect(x + ((y / step) % 2) * 30 - 2, y - 2, 4, 4);
  ctx.strokeStyle = "#f43f5e";
  ctx.lineWidth = 12;
  ctx.strokeRect(0, 0, ARENA, ARENA);
  if (!snap) {
    ctx.restore();
    return;
  }
  // Food: little glowing dots that pulse.
  for (let i = 0; i < snap.f.length; i += 4) {
    const x = snap.f[i];
    const y = snap.f[i + 1];
    if (x < cx - w / 2 / zoom - 20 || x > cx + w / 2 / zoom + 20 || y < cy - h / 2 / zoom - 20 || y > cy + h / 2 / zoom + 20) continue;
    const r = 3 + snap.f[i + 2] * 1.4 + Math.sin(now / 200 + i) * 0.8;
    ctx.fillStyle = foodColor(snap.f[i + 3]);
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Snakes: you on top.
  const order = [...snap.s].sort((a, b) => (a[0] === me ? 1 : 0) - (b[0] === me ? 1 : 0));
  for (const [id, name, color, alive, len, , body] of order) {
    if (!alive || body.length < 4) continue;
    const r = radiusOf(len);
    // Body: alternating stripes, tail to head.
    for (let i = body.length - 2; i >= 0; i -= 2) {
      ctx.fillStyle = (i / 2) % 4 < 2 ? color : shadeHex(color, -0.18);
      ctx.beginPath();
      ctx.arc(body[i], body[i + 1], r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Head with eyes looking forward.
    const hx = body[0];
    const hy = body[1];
    const a = Math.atan2(hy - body[3], hx - body[2]);
    for (const side of [-1, 1]) {
      const ex = hx + Math.cos(a) * r * 0.35 + Math.cos(a + (side * Math.PI) / 2) * r * 0.5;
      const ey = hy + Math.sin(a) * r * 0.35 + Math.sin(a + (side * Math.PI) / 2) * r * 0.5;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(ex + Math.cos(a) * r * 0.15, ey + Math.sin(a) * r * 0.15, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Name tag.
    ctx.font = `bold ${Math.max(12, 13 / zoom)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = id === me ? "#fde047" : "rgba(255,255,255,0.85)";
    ctx.fillText(id === me ? `${name} (u)` : name, hx, hy - r - 8 / zoom);
  }
  ctx.restore();
}

function shadeHex(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + amt))));
  return `#${((1 << 24) | (f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1)}`;
}
