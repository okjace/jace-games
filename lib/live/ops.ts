/**
 * Team tactics on a top-down map, for two Live modes (all original, no
 * weapons): Beacon Rush and Flag Frenzy. Two teams (Gold and Blue) run
 * around walls and freeze each other with freeze tag (a teammate standing
 * next to a frozen player thaws them).
 *
 * Beacon Rush: rounds. The attackers carry a glowing beacon to site A or B
 * and plant it (3 s); the defenders thaw it out (5 s) before it goes off
 * (35 s). Freeze the whole other team to win the round too. Sides swap after
 * round 4; first to 5 rounds wins.
 *
 * Flag Frenzy: grab the other team's flag and bring it to ur base while ur
 * own flag is home. Frozen players thaw by themselves after a few seconds.
 * Most captures wins.
 *
 * Right answers earn coins for the shop: speed boots, shields and dashes.
 * Like Snake Arena, the host's screen runs this (a solo player's phone runs
 * it for them, with bots); each phone moves its own player straight away
 * and tells the host where it went.
 */

export type OpsMode = "beacon" | "flag";
export const TILE = 40;
export const RADIUS = 13;
const SPEED = 175;
const BOOTS = 1.25;
const DASH_SPEED = 2.1;
const DASH_TIME = 1.2;
const TAG_RANGE = 38;
const TAG_COOLDOWN = 0.7;
const THAW_RANGE = 34;
const THAW_TIME = 2;
const PLANT_TIME = 3;
const DEFUSE_TIME = 5;
const BEACON_TIME = 35;
const BUY_TIME = 8;
const ROUND_TIME = 100;
const POST_TIME = 4;
export const WIN_ROUNDS = 5;
const FLAG_THAW = 5;
const MIN_PER_TEAM = 3;

export const TEAM_INFO = [
  { name: "Gold", icon: "🟡", color: "#f59e0b", dark: "#b45309" },
  { name: "Blue", icon: "🔵", color: "#3b82f6", dark: "#1d4ed8" },
] as const;

export const SHOP = {
  boots: { icon: "⚡", name: "Speed boots", desc: "25% faster (Beacon Rush: this round; Flag Frenzy: 60 s)", cost: 30 },
  shield: { icon: "🛡️", name: "Shield", desc: "the next tag on u doesn't freeze u", cost: 40 },
  dash: { icon: "💨", name: "Dash", desc: "a quick burst of speed (up to 3 saved)", cost: 15 },
} as const;
export type ShopItem = keyof typeof SHOP;

/**
 * The maps (32 × 18 tiles). # wall · . floor · G / U Gold / Blue spawn ·
 * A / B beacon sites · g / u flags.
 */
const BEACON_MAP = [
  "################################",
  "#GG......#.........#.....AAA...#",
  "#GG......#.........#.....AAA..U#",
  "#........#...##....#..........U#",
  "#....##......##..........##...U#",
  "#....##..................##....#",
  "#.........####....####.........#",
  "#..#......#..........#....#....#",
  "#..#...........##.........#....#",
  "#..#...........##.........#....#",
  "#..#......#..........#....#....#",
  "#.........####....####.........#",
  "#....##..................##....#",
  "#....##......##..........##...U#",
  "#GG......#...##....#..........U#",
  "#GG......#.........#.....BBB..U#",
  "#........#.........#.....BBB...#",
  "################################",
];
const FLAG_MAP = [
  "################################",
  "#GGG.....#............#.....UUU#",
  "#GgG.....#....####....#.....UuU#",
  "#GGG..........#..#..........UUU#",
  "#.....##......#..#......##.....#",
  "#.....##................##.....#",
  "#.........####....####.........#",
  "#..#.....#............#.....#..#",
  "#..#...........##...........#..#",
  "#..#...........##...........#..#",
  "#..#.....#............#.....#..#",
  "#.........####....####.........#",
  "#.....##................##.....#",
  "#.....##......#..#......##.....#",
  "#.............#..#.............#",
  "#........#....####....#........#",
  "#........#............#........#",
  "################################",
];

export type OpsMap = { cols: number; rows: number; walls: boolean[]; spawns: [number, number][][]; sites: { name: "A" | "B"; tiles: [number, number][] }[]; flags: [number, number][] };

function parse(rows: string[]): OpsMap {
  const cols = rows[0].length;
  const walls: boolean[] = [];
  const spawns: [number, number][][] = [[], []];
  const site: Record<"A" | "B", [number, number][]> = { A: [], B: [] };
  const flags: [number, number][] = [[0, 0], [0, 0]];
  rows.forEach((row, y) => {
    for (let x = 0; x < cols; x++) {
      const c = row[x] ?? "#";
      walls.push(c === "#");
      if (c === "G" || c === "g") spawns[0].push([x, y]);
      if (c === "U" || c === "u") spawns[1].push([x, y]);
      if (c === "A" || c === "B") site[c].push([x, y]);
      if (c === "g") flags[0] = [x, y];
      if (c === "u") flags[1] = [x, y];
    }
  });
  return { cols, rows: rows.length, walls, spawns, sites: (["A", "B"] as const).filter((n) => site[n].length).map((n) => ({ name: n, tiles: site[n] })), flags };
}
export const MAPS: Record<OpsMode, OpsMap> = { beacon: parse(BEACON_MAP), flag: parse(FLAG_MAP) };
export const worldSize = (m: OpsMap) => ({ w: m.cols * TILE, h: m.rows * TILE });

const wallAt = (m: OpsMap, x: number, y: number) => {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  return tx < 0 || ty < 0 || tx >= m.cols || ty >= m.rows || m.walls[ty * m.cols + tx];
};
/** Can a player stand here (their circle clear of walls)? */
export function clear(m: OpsMap, x: number, y: number): boolean {
  const r = RADIUS - 1;
  return !wallAt(m, x - r, y - r) && !wallAt(m, x + r, y - r) && !wallAt(m, x - r, y + r) && !wallAt(m, x + r, y + r);
}
/** Moves by (dx, dy), sliding along walls. */
export function slide(m: OpsMap, p: { x: number; y: number }, dx: number, dy: number) {
  if (clear(m, p.x + dx, p.y)) p.x += dx;
  if (clear(m, p.x, p.y + dy)) p.y += dy;
}
const tileCenter = ([x, y]: [number, number]) => ({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 });
const tileOf = (x: number, y: number): [number, number] => [Math.floor(x / TILE), Math.floor(y / TILE)];
const onSite = (m: OpsMap, x: number, y: number) => {
  const [tx, ty] = tileOf(x, y);
  return m.sites.find((s) => s.tiles.some(([a, b]) => a === tx && b === ty)) ?? null;
};

/** The next tile toward a goal (breadth-first over floor tiles), or null. */
function nextStep(m: OpsMap, from: [number, number], to: [number, number]): [number, number] | null {
  const key = (x: number, y: number) => y * m.cols + x;
  if (from[0] === to[0] && from[1] === to[1]) return null;
  const prev = new Int32Array(m.cols * m.rows).fill(-1);
  const start = key(from[0], from[1]);
  prev[start] = start;
  const queue = [start];
  const goal = key(to[0], to[1]);
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === goal) break;
    const cx = cur % m.cols;
    const cy = Math.floor(cur / m.cols);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= m.cols || ny >= m.rows) continue;
      const k = key(nx, ny);
      if (prev[k] !== -1 || m.walls[k]) continue;
      prev[k] = cur;
      queue.push(k);
    }
  }
  if (prev[goal] === -1) return null;
  let k = goal;
  while (prev[k] !== start) k = prev[k];
  return [k % m.cols, Math.floor(k / m.cols)];
}

export type OpsPlayer = {
  id: string;
  name: string;
  team: 0 | 1;
  bot: boolean;
  x: number;
  y: number;
  frozen: boolean;
  frozenAt: number;
  thaw: number;
  shield: boolean;
  bootsUntil: number;
  bootsRound: boolean;
  dashes: number;
  dashUntil: number;
  tagReady: number;
  /** Goes up whenever the host moves them (respawn), so phones know to jump too. */
  epoch: number;
  remoteAt: number;
  seq: number;
  score: number;
  /** Shop coins (right answers). */
  coins: number;
  /** Bots: where they're heading and when to think again. */
  goal: [number, number] | null;
  thinkAt: number;
};

export type Beacon = { x: number; y: number; carrier: string | null; planted: boolean; site: "A" | "B" | null; endsAt: number; plant: number; defuse: number };
export type Flag = { x: number; y: number; carrier: string | null; home: boolean };

/** What phones get several times a second. */
export type OpsSnapshot = {
  t: number;
  mode: OpsMode;
  phase: "buy" | "play" | "post" | "over";
  phaseEnds: number;
  round: number;
  attack: 0 | 1;
  wins: [number, number];
  /** id, name, team, x, y, frozen, shield, carrying (0 nothing, 1 beacon, 2 flag), thaw progress 0–1, epoch, boots on, dashing. */
  p: [string, string, 0 | 1, number, number, 0 | 1, 0 | 1, 0 | 1 | 2, number, number, 0 | 1, 0 | 1][];
  beacon: Beacon | null;
  flags: Flag[];
  events: string[];
  winner: 0 | 1 | null;
  /** People's (not bots') coins and saved dashes. */
  c: Record<string, [number, number]>;
};

const BOT_NAMES = ["blip", "zappy", "noodle", "pip", "rocket", "bean", "sprout", "turbo", "pixel", "gizmo"];

export class Ops {
  mode: OpsMode;
  map: OpsMap;
  players = new Map<string, OpsPlayer>();
  phase: OpsSnapshot["phase"] = "buy";
  phaseEnds = 0;
  round = 1;
  wins: [number, number] = [0, 0];
  beacon: Beacon | null = null;
  flags: Flag[] = [];
  events: string[] = [];
  winner: 0 | 1 | null = null;
  botsOn = true;
  private started = false;

  constructor(mode: OpsMode) {
    this.mode = mode;
    this.map = MAPS[mode];
    this.flags = mode === "flag" ? this.map.flags.map((f) => ({ ...tileCenter(f), carrier: null, home: true })) : [];
  }

  /** Who attacks in Beacon Rush: Gold for the first 4 rounds, then Blue. */
  get attack(): 0 | 1 {
    return this.round <= 4 ? 0 : 1;
  }

  private say(text: string) {
    this.events.unshift(text);
    this.events = this.events.slice(0, 6);
  }

  /** Adds someone (to the team with fewer people, unless a team is given). */
  join(id: string, name: string, wanted?: 0 | 1, bot = false) {
    let p = this.players.get(id);
    const people = (t: 0 | 1) => [...this.players.values()].filter((o) => o.team === t && !o.bot && o.id !== id).length;
    const team: 0 | 1 = wanted ?? p?.team ?? (people(0) <= people(1) ? 0 : 1);
    if (!p) {
      p = { id, name, team, bot, x: 0, y: 0, frozen: false, frozenAt: 0, thaw: 0, shield: false, bootsUntil: 0, bootsRound: false, dashes: 0, dashUntil: 0, tagReady: 0, epoch: 0, remoteAt: 0, seq: 0, score: 0, coins: 0, goal: null, thinkAt: 0 };
      this.players.set(id, p);
      this.spawn(p);
    }
    p.name = name;
    if (p.team !== team) {
      p.team = team;
      this.spawn(p);
    }
    return p;
  }
  leave(id: string) {
    const p = this.players.get(id);
    if (p) this.dropCarried(p);
    this.players.delete(id);
  }

  /** The spawn side for a team: Beacon Rush spawns attackers on the left (G) and defenders on the right (U). */
  private spawnTiles(team: 0 | 1) {
    const side = this.mode === "beacon" ? (team === this.attack ? 0 : 1) : team;
    return this.map.spawns[side];
  }
  private spawn(p: OpsPlayer) {
    const tiles = this.spawnTiles(p.team);
    const t = tiles[Math.floor(Math.random() * tiles.length)];
    const c = tileCenter(t);
    p.x = c.x + (Math.random() - 0.5) * 10;
    p.y = c.y + (Math.random() - 0.5) * 10;
    p.frozen = false;
    p.thaw = 0;
    p.epoch++;
    p.remoteAt = 0;
    p.seq = 0;
    p.goal = null;
  }

  /** Keeps at least MIN_PER_TEAM on each team with bots (when bots are on). */
  private balanceBots() {
    for (const team of [0, 1] as const) {
      const all = [...this.players.values()].filter((p) => p.team === team);
      const people = all.filter((p) => !p.bot).length;
      const bots = all.filter((p) => p.bot);
      const want = this.botsOn ? Math.max(0, MIN_PER_TEAM - people) : 0;
      for (let i = bots.length; i < want; i++) this.join(`bot-${team}-${i}-${Math.random().toString(36).slice(2, 6)}`, `🤖 ${BOT_NAMES[(i + team * 5) % BOT_NAMES.length]}`, team, true);
      for (let i = want; i < bots.length; i++) this.leave(bots[i].id);
    }
  }

  // ---------- Actions ----------

  /** A phone moved its own player (straight away on the phone); the host checks speed and walls. */
  move(id: string, epoch: number, x: number, y: number, seq: number, now: number) {
    const p = this.players.get(id);
    if (!p || p.bot || p.frozen || p.epoch !== epoch || this.phase !== "play") return;
    if (seq <= p.seq) return;
    p.seq = seq;
    const since = p.remoteAt ? Math.min(1, (now - p.remoteAt) / 1000) : 0.25;
    p.remoteAt = now;
    const budget = SPEED * BOOTS * DASH_SPEED * (since + 0.15) * 1.3;
    let dx = x - p.x;
    let dy = y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > budget) {
      dx = (dx / d) * budget;
      dy = (dy / d) * budget;
    }
    // In small steps, so nobody slips through a wall.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
    for (let i = 0; i < steps; i++) slide(this.map, p, dx / steps, dy / steps);
  }

  tag(id: string, now: number) {
    const p = this.players.get(id);
    if (!p || p.frozen || now < p.tagReady || this.phase !== "play") return;
    p.tagReady = now + TAG_COOLDOWN * 1000;
    let best: OpsPlayer | null = null;
    let bd = TAG_RANGE;
    for (const o of this.players.values()) {
      if (o.team === p.team || o.frozen) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    if (!best) return;
    if (best.shield) {
      best.shield = false;
      this.say(`🛡️ ${best.name}'s shield blocked ${p.name}`);
      return;
    }
    best.frozen = true;
    best.frozenAt = now;
    best.thaw = 0;
    this.dropCarried(best);
    p.score += 10;
    this.say(`❄️ ${p.name} froze ${best.name}`);
  }

  dash(id: string, now: number) {
    const p = this.players.get(id);
    if (!p || p.frozen || p.dashes <= 0 || now < p.dashUntil) return;
    p.dashes--;
    p.dashUntil = now + DASH_TIME * 1000;
  }

  /** Coins from a right answer. */
  earn(id: string, amount: number) {
    const p = this.players.get(id);
    if (p) p.coins += Math.max(0, Math.min(40, Math.round(amount)));
  }

  /** Spends coins on a shop item (false if they can't). */
  buy(id: string, item: ShopItem, now: number): boolean {
    const p = this.players.get(id);
    const it = SHOP[item];
    if (!p || !it || p.coins < it.cost || this.phase === "over") return false;
    if (item === "shield" && p.shield) return false;
    if (item === "dash" && p.dashes >= 3) return false;
    p.coins -= it.cost;
    this.give(p, item, now);
    this.say(`${it.icon} ${p.name} got ${it.name.toLowerCase()}`);
    return true;
  }

  private give(p: OpsPlayer, item: ShopItem, now: number) {
    if (item === "boots") {
      if (this.mode === "beacon") p.bootsRound = true;
      else p.bootsUntil = now + 60_000;
    } else if (item === "shield") p.shield = true;
    else p.dashes = Math.min(3, p.dashes + 1);
  }

  speedOf(p: OpsPlayer, now: number) {
    return SPEED * (p.bootsRound || now < p.bootsUntil ? BOOTS : 1) * (now < p.dashUntil ? DASH_SPEED : 1);
  }

  private dropCarried(p: OpsPlayer) {
    if (this.beacon?.carrier === p.id) this.beacon = { ...this.beacon, carrier: null, x: p.x, y: p.y };
    for (const f of this.flags) if (f.carrier === p.id) Object.assign(f, { carrier: null, x: p.x, y: p.y });
  }

  // ---------- Rounds ----------

  private newRound(now: number) {
    this.phase = "buy";
    this.phaseEnds = now + BUY_TIME * 1000;
    for (const p of this.players.values()) {
      p.bootsRound = false;
      p.dashUntil = 0;
      this.spawn(p);
    }
    const attackers = [...this.players.values()].filter((p) => p.team === this.attack);
    const carrier = attackers.find((p) => !p.bot) ?? attackers[0];
    this.beacon = carrier ? { x: carrier.x, y: carrier.y, carrier: carrier.id, planted: false, site: null, endsAt: 0, plant: 0, defuse: 0 } : null;
    this.say(`🔦 round ${this.round}: ${TEAM_INFO[this.attack].name} attacks!`);
  }

  private endRound(winner: 0 | 1, why: string, now: number) {
    this.wins[winner]++;
    for (const p of this.players.values()) if (p.team === winner) p.score += 30;
    this.say(`${TEAM_INFO[winner].icon} ${TEAM_INFO[winner].name} wins the round: ${why}`);
    if (this.wins[winner] >= WIN_ROUNDS) {
      this.phase = "over";
      this.winner = winner;
      this.say(`🏆 ${TEAM_INFO[winner].name} wins the match!!`);
      return;
    }
    this.phase = "post";
    this.phaseEnds = now + POST_TIME * 1000;
  }

  // ---------- The loop ----------

  step(dt: number, now: number) {
    this.balanceBots();
    if (!this.started) {
      this.started = true;
      if (this.mode === "beacon") this.newRound(now);
      else {
        this.phase = "play";
        this.phaseEnds = 0;
      }
    }
    if (this.phase === "over") return;
    if (this.mode === "beacon") {
      if (this.phase === "buy" && now >= this.phaseEnds) {
        this.phase = "play";
        this.phaseEnds = now + ROUND_TIME * 1000;
      } else if (this.phase === "post" && now >= this.phaseEnds) {
        this.round++;
        this.newRound(now);
      }
    }
    const all = [...this.players.values()];
    // Movement: bots think, and the host moves anyone whose phone went quiet (they stand still).
    for (const p of all) {
      if (p.frozen) continue;
      if (p.bot && this.phase === "play") this.botStep(p, dt, now);
    }
    if (this.phase !== "play") return;
    // Thawing: a teammate standing close for a moment (Flag Frenzy also thaws on its own).
    for (const p of all) {
      if (!p.frozen) continue;
      const helper = all.some((o) => o.team === p.team && !o.frozen && o.id !== p.id && Math.hypot(o.x - p.x, o.y - p.y) < THAW_RANGE);
      p.thaw = helper ? p.thaw + dt / THAW_TIME : Math.max(0, p.thaw - dt);
      const auto = this.mode === "flag" && now - p.frozenAt > FLAG_THAW * 1000;
      if (p.thaw >= 1 || auto) {
        p.frozen = false;
        p.thaw = 0;
        if (helper) {
          const h = all.find((o) => o.team === p.team && !o.frozen && o.id !== p.id && Math.hypot(o.x - p.x, o.y - p.y) < THAW_RANGE);
          if (h) {
            h.score += 15;
            this.say(`🔥 ${h.name} thawed ${p.name}`);
          }
        }
        if (auto) this.spawn(p);
      }
    }
    if (this.mode === "beacon") this.beaconStep(all, dt, now);
    else this.flagStep(all, now);
  }

  private beaconStep(all: OpsPlayer[], dt: number, now: number) {
    const b = this.beacon;
    const att = this.attack;
    const def = (1 - att) as 0 | 1;
    if (b && !b.planted) {
      const carrier = b.carrier ? this.players.get(b.carrier) : null;
      if (carrier) {
        b.x = carrier.x;
        b.y = carrier.y;
        const site = onSite(this.map, carrier.x, carrier.y);
        b.plant = site ? b.plant + dt / PLANT_TIME : 0;
        if (site && b.plant >= 1) {
          b.planted = true;
          b.carrier = null;
          b.site = site.name;
          b.endsAt = now + BEACON_TIME * 1000;
          carrier.score += 40;
          this.say(`🔦 ${carrier.name} planted the beacon at ${site.name}!`);
        }
      } else {
        // Dropped: any attacker walking over it picks it up.
        const picker = all.find((p) => p.team === att && !p.frozen && Math.hypot(p.x - b.x, p.y - b.y) < 22);
        if (picker) b.carrier = picker.id;
      }
    }
    if (b?.planted) {
      const defusers = all.filter((p) => p.team === def && !p.frozen && Math.hypot(p.x - b.x, p.y - b.y) < 26);
      b.defuse = defusers.length ? b.defuse + dt / DEFUSE_TIME : 0;
      if (b.defuse >= 1) {
        defusers[0].score += 50;
        this.say(`💧 ${defusers[0].name} put out the beacon!`);
        return this.endRound(def, "beacon put out", now);
      }
      if (now >= b.endsAt) return this.endRound(att, "the beacon went off ✨", now);
    } else if (now >= this.phaseEnds) return this.endRound(def, "time ran out", now);
    const alive = (t: 0 | 1) => all.some((p) => p.team === t && !p.frozen);
    if (all.some((p) => p.team === att) && !alive(att) && !b?.planted) return this.endRound(def, "evry attacker frozen", now);
    if (all.some((p) => p.team === def) && !alive(def)) return this.endRound(att, "evry defender frozen", now);
  }

  private flagStep(all: OpsPlayer[], now: number) {
    this.flags.forEach((f, team) => {
      const carrier = f.carrier ? this.players.get(f.carrier) : null;
      if (carrier) {
        f.x = carrier.x;
        f.y = carrier.y;
        // Home with it, while ur own flag is home: a capture!
        const home = tileCenter(this.map.flags[carrier.team]);
        if (this.flags[carrier.team].home && Math.hypot(carrier.x - home.x, carrier.y - home.y) < 30) {
          this.wins[carrier.team]++;
          carrier.score += 100;
          this.say(`🚩 ${carrier.name} captured the ${TEAM_INFO[team].name} flag!`);
          Object.assign(f, { ...tileCenter(this.map.flags[team]), carrier: null, home: true });
        }
        return;
      }
      for (const p of all) {
        if (p.frozen || Math.hypot(p.x - f.x, p.y - f.y) > 22) continue;
        if (p.team !== team) {
          f.carrier = p.id;
          f.home = false;
          this.say(`🏃 ${p.name} grabbed the ${TEAM_INFO[team].name} flag`);
          break;
        }
        if (!f.home) {
          // Ur own flag on the ground: touch it to send it home.
          Object.assign(f, { ...tileCenter(this.map.flags[team]), home: true });
          p.score += 20;
          this.say(`↩️ ${p.name} brought the ${TEAM_INFO[team].name} flag home`);
          break;
        }
      }
    });
    void now;
  }

  // ---------- Bots ----------

  private botStep(p: OpsPlayer, dt: number, now: number) {
    const all = [...this.players.values()];
    const enemies = all.filter((o) => o.team !== p.team && !o.frozen);
    const near = enemies.reduce<{ o: OpsPlayer | null; d: number }>((acc, o) => {
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      return d < acc.d ? { o, d } : acc;
    }, { o: null, d: Infinity });
    if (near.o && near.d < TAG_RANGE - 4 && this.phase === "play") this.tag(p.id, now);
    p.coins += dt * 2;
    if (p.coins >= 15 && Math.random() < 0.01) this.buy(p.id, p.coins >= 40 && !p.shield ? "shield" : "dash", now);
    if (p.dashes > 0 && near.o && near.d < 140 && Math.random() < 0.02) this.dash(p.id, now);
    if (now >= p.thinkAt) {
      p.thinkAt = now + 400 + Math.random() * 300;
      p.goal = this.botGoal(p, all, near);
    }
    if (!p.goal || this.phase === "post") return;
    const here = tileOf(p.x, p.y);
    const next = nextStep(this.map, here, p.goal) ?? p.goal;
    const target = tileCenter(next);
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) return;
    const step = Math.min(d, this.speedOf(p, now) * 0.85 * dt);
    slide(this.map, p, (dx / d) * step, (dy / d) * step);
  }

  private botGoal(p: OpsPlayer, all: OpsPlayer[], near: { o: OpsPlayer | null; d: number }): [number, number] | null {
    // Thaw a frozen teammate close by.
    const buddy = all.find((o) => o.team === p.team && o.frozen && Math.hypot(o.x - p.x, o.y - p.y) < 220);
    if (buddy && (!near.o || near.d > 120)) return tileOf(buddy.x, buddy.y);
    // Chase an enemy who's close.
    if (near.o && near.d < 160) return tileOf(near.o.x, near.o.y);
    if (this.mode === "beacon") {
      const b = this.beacon;
      if (!b) return null;
      const attacking = p.team === this.attack;
      if (attacking) {
        if (b.carrier === p.id) {
          // Head for the site this bot picked (A or B).
          const site = this.map.sites[p.id.charCodeAt(p.id.length - 1) % this.map.sites.length];
          return site.tiles[Math.floor(site.tiles.length / 2)];
        }
        if (!b.carrier && !b.planted) return tileOf(b.x, b.y);
        return tileOf(b.x, b.y);
      }
      if (b.planted) return tileOf(b.x, b.y);
      // Defend a site (half go to each).
      const site = this.map.sites[p.id.charCodeAt(p.id.length - 2) % this.map.sites.length];
      const t = site.tiles[(p.id.charCodeAt(p.id.length - 1) % site.tiles.length)];
      return t;
    }
    const enemyFlag = this.flags[1 - p.team];
    const myFlag = this.flags[p.team];
    if (enemyFlag.carrier === p.id) return this.map.flags[p.team];
    // Someone has our flag: chase them.
    if (myFlag.carrier) {
      const c = this.players.get(myFlag.carrier);
      if (c) return tileOf(c.x, c.y);
    }
    if (!myFlag.home) return tileOf(myFlag.x, myFlag.y);
    return tileOf(enemyFlag.x, enemyFlag.y);
  }

  snapshot(now: number): OpsSnapshot {
    const p: OpsSnapshot["p"] = [];
    const c: OpsSnapshot["c"] = {};
    for (const x of this.players.values()) {
      if (!x.bot) c[x.id] = [x.coins, x.dashes];
      const carrying = this.beacon?.carrier === x.id ? 1 : this.flags.some((f) => f.carrier === x.id) ? 2 : 0;
      p.push([x.id, x.name, x.team, Math.round(x.x), Math.round(x.y), x.frozen ? 1 : 0, x.shield ? 1 : 0, carrying, Math.round(x.thaw * 100) / 100, x.epoch, x.bootsRound || now < x.bootsUntil ? 1 : 0, now < x.dashUntil ? 1 : 0]);
    }
    return {
      t: now,
      mode: this.mode,
      phase: this.phase,
      phaseEnds: this.phaseEnds,
      round: this.round,
      attack: this.attack,
      wins: [...this.wins] as [number, number],
      p,
      beacon: this.beacon ? { ...this.beacon, x: Math.round(this.beacon.x), y: Math.round(this.beacon.y) } : null,
      flags: this.flags.map((f) => ({ ...f, x: Math.round(f.x), y: Math.round(f.y) })),
      events: this.events,
      winner: this.winner,
      c,
    };
  }

  /** People's scores (not bots), for the leaderboard. */
  scores(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const p of this.players.values()) if (!p.bot) out[p.id] = p.score;
    return out;
  }
}


// ---------- Drawing ----------

/** Draws the map and everyone. `camera`: centre + zoom (null fits the whole map); `me` gets a ring. */
export function drawOps(ctx: CanvasRenderingContext2D, w: number, h: number, snap: OpsSnapshot | null, camera: { x: number; y: number; zoom: number } | null, me: string | null, now: number) {
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, w, h);
  if (!snap) return;
  const m = MAPS[snap.mode];
  const { w: ww, h: wh } = worldSize(m);
  const zoom = camera ? camera.zoom : Math.min(w / ww, h / wh);
  const cx = camera ? camera.x : ww / 2;
  const cy = camera ? camera.y : wh / 2;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-cx, -cy);
  // Floor, spawns and sites.
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, ww, wh);
  for (const [team, tiles] of m.spawns.entries()) {
    const side = snap.mode === "beacon" ? (team === 0 ? snap.attack : 1 - snap.attack) : team;
    ctx.fillStyle = side === 0 ? "rgba(245,158,11,0.16)" : "rgba(59,130,246,0.16)";
    for (const [x, y] of tiles) ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
  }
  for (const s of m.sites) {
    ctx.fillStyle = "rgba(236,72,153,0.18)";
    for (const [x, y] of s.tiles) ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    const [x, y] = s.tiles[Math.floor(s.tiles.length / 2)];
    ctx.fillStyle = "rgba(244,114,182,0.75)";
    ctx.font = "bold 34px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.name, x * TILE + TILE / 2, y * TILE + TILE / 2);
  }
  // A faint grid.
  ctx.strokeStyle = "rgba(148,163,184,0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= m.cols; x++) {
    ctx.beginPath();
    ctx.moveTo(x * TILE, 0);
    ctx.lineTo(x * TILE, wh);
    ctx.stroke();
  }
  for (let y = 0; y <= m.rows; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * TILE);
    ctx.lineTo(ww, y * TILE);
    ctx.stroke();
  }
  // Walls.
  for (let y = 0; y < m.rows; y++) {
    for (let x = 0; x < m.cols; x++) {
      if (!m.walls[y * m.cols + x]) continue;
      ctx.fillStyle = "#475569";
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      ctx.fillStyle = "#64748b";
      ctx.fillRect(x * TILE, y * TILE, TILE, 6);
    }
  }
  // Flags and the beacon.
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  snap.flags.forEach((f, team) => {
    if (f.carrier) return;
    ctx.font = "30px system-ui";
    ctx.fillText(team === 0 ? "🚩" : "🏁", f.x, f.y - 4);
    ctx.strokeStyle = TEAM_INFO[team].color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 18 + Math.sin(now / 250) * 2, 0, Math.PI * 2);
    ctx.stroke();
  });
  const b = snap.beacon;
  if (b && !b.carrier) {
    const pulse = b.planted ? 26 + Math.sin(now / (b.endsAt - snap.t < 10_000 ? 90 : 220)) * 6 : 18;
    const g = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, pulse * 2);
    g.addColorStop(0, "rgba(253,224,71,0.95)");
    g.addColorStop(1, "rgba(253,224,71,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, pulse * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "26px system-ui";
    ctx.fillText("🔦", b.x, b.y);
    if (b.planted && b.defuse > 0) ring(ctx, b.x, b.y, 30, b.defuse, "#38bdf8");
  }
  // Players.
  for (const [id, name, team, x, y, frozen, shield, carrying, thaw, , boots, dashing] of snap.p) {
    const t = TEAM_INFO[team];
    if (dashing) {
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.arc(x, y, RADIUS + 9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = frozen ? "#bae6fd" : t.color;
    ctx.strokeStyle = frozen ? "#e0f2fe" : t.dark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (shield) {
      ctx.strokeStyle = "rgba(167,243,208,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, RADIUS + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (id === me) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(x, y, RADIUS + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.font = "14px system-ui";
    if (frozen) ctx.fillText("❄️", x, y);
    else if (boots) ctx.fillText("⚡", x, y + 1);
    if (carrying === 1) ctx.fillText("🔦", x + 14, y - 14);
    if (carrying === 2) ctx.fillText(team === 0 ? "🏁" : "🚩", x + 14, y - 14);
    if (frozen && thaw > 0) ring(ctx, x, y, RADIUS + 7, thaw, "#fb923c");
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `${id === me ? "bold " : ""}12px system-ui`;
    ctx.fillText(id === me ? `${name} (u)` : name, x, y - RADIUS - 10);
  }
  ctx.restore();
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, k: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, k));
  ctx.stroke();
}
