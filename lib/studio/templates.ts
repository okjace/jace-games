import type { Multiplayer } from "@/lib/db/studio";

/**
 * Starting points for "New game" in the code editor. Each is a whole small
 * game: keyboard and touch controls, a score sent with jace.submitScore()
 * and jace.gameOver() at the end. The blocks versions live in
 * lib/studio/blockTemplates.ts.
 */

export type TemplateId = "arcade" | "puzzle" | "clicker" | "duel" | "blank";

export type Template = {
  id: TemplateId;
  name: string;
  icon: string;
  description: string;
  multiplayer: Multiplayer | null;
};

export const TEMPLATES: Template[] = [
  { id: "arcade", name: "Dodge", icon: "☄️", description: "Arcade: move left and right to dodge falling rocks.", multiplayer: null },
  { id: "puzzle", name: "Lights Out", icon: "💡", description: "Puzzle: turn every light off. Each tap flips a light and its neighbours.", multiplayer: null },
  { id: "clicker", name: "Cookie Rush", icon: "🍪", description: "Clicker: tap the cookie, buy helpers, bake as much as you can in 60 seconds.", multiplayer: null },
  { id: "duel", name: "Paddle Duel", icon: "🏓", description: "2 players: first to 5 points wins. Uses jace.room to play online.", multiplayer: { mode: "live", min: 2, max: 2 } },
  { id: "blank", name: "Blank", icon: "🎮", description: "An empty canvas and a game loop.", multiplayer: null },
];

const BASE_STYLE = `<style>
  html, body { margin: 0; height: 100%; background: #111317; color: #e6e8eb; overflow: hidden;
    font-family: system-ui, sans-serif; touch-action: none; user-select: none; -webkit-user-select: none; }
  canvas { display: block; width: 100vw; height: 100vh; object-fit: contain; }
</style>`;

const ARCADE = `${BASE_STYLE}
<canvas id="game" width="480" height="360"></canvas>
<script>
// Dodge: rocks fall faster and faster. Survive as long as you can.
// Keys: ← → (or A / D) to move, Space to play again.
// Touch or mouse: hold anywhere and the ship follows your finger.
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

let ship, rocks, score, speed, spawnTimer, over, pointerX = null;
const keys = {};

function reset() {
  ship = { x: W / 2, y: H - 34, r: 14 };
  rocks = [];
  score = 0;
  speed = 120;
  spawnTimer = 0;
  over = false;
}

// Turns a screen position into a position on the 480x360 canvas.
function toGame(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const scale = Math.min(r.width / W, r.height / H);
  return { x: (clientX - r.left - (r.width - W * scale) / 2) / scale, y: (clientY - r.top - (r.height - H * scale) / 2) / scale };
}

addEventListener("keydown", (e) => {
  keys[e.key] = true;
  if (over && (e.key === " " || e.key === "Enter")) reset();
  if (e.key.startsWith("Arrow") || e.key === " ") e.preventDefault();
});
addEventListener("keyup", (e) => (keys[e.key] = false));
canvas.addEventListener("pointerdown", (e) => {
  if (over) return reset();
  pointerX = toGame(e.clientX, e.clientY).x;
});
canvas.addEventListener("pointermove", (e) => { if (pointerX !== null) pointerX = toGame(e.clientX, e.clientY).x; });
addEventListener("pointerup", () => (pointerX = null));

function update(dt) {
  if (over) return;
  let dir = 0;
  if (keys.ArrowLeft || keys.a || keys.A) dir -= 1;
  if (keys.ArrowRight || keys.d || keys.D) dir += 1;
  if (pointerX !== null && Math.abs(pointerX - ship.x) > 4) dir = Math.sign(pointerX - ship.x);
  ship.x = Math.max(ship.r, Math.min(W - ship.r, ship.x + dir * 260 * dt));

  speed += 6 * dt;
  score += dt * 10;
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnTimer = Math.max(0.18, 0.8 - speed / 600);
    const r = 8 + Math.random() * 14;
    rocks.push({ x: r + Math.random() * (W - 2 * r), y: -r, r, vy: speed * (0.8 + Math.random() * 0.5) });
  }
  for (const rock of rocks) {
    rock.y += rock.vy * dt;
    if (Math.hypot(rock.x - ship.x, rock.y - ship.y) < rock.r + ship.r - 4) {
      over = true;
      jace.submitScore(Math.floor(score));
      jace.gameOver();
    }
  }
  rocks = rocks.filter((rock) => rock.y < H + rock.r);
}

function draw() {
  ctx.fillStyle = "#111317";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#8b919c";
  for (const rock of rocks) {
    ctx.beginPath();
    ctx.arc(rock.x, rock.y, rock.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = "28px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🚀", ship.x, ship.y);
  ctx.fillStyle = "#e6e8eb";
  ctx.font = "bold 18px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("Score " + Math.floor(score), 12, 18);
  if (over) {
    ctx.fillStyle = "rgba(0,0,0,.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#3ddc84";
    ctx.textAlign = "center";
    ctx.font = "bold 32px system-ui";
    ctx.fillText("Game over", W / 2, H / 2 - 20);
    ctx.fillStyle = "#e6e8eb";
    ctx.font = "16px system-ui";
    ctx.fillText("Score " + Math.floor(score) + " · tap or press Space to play again", W / 2, H / 2 + 18);
  }
}

let last = performance.now();
function frame(now) {
  update(Math.min(0.05, (now - last) / 1000));
  last = now;
  draw();
  requestAnimationFrame(frame);
}
reset();
requestAnimationFrame(frame);
</script>
`;

const PUZZLE = `${BASE_STYLE}
<canvas id="game" width="480" height="360"></canvas>
<script>
// Lights Out: tapping a light flips it and the lights next to it.
// Turn them all off to clear the level. Five levels; fewer moves score more.
// Keys: arrows to move, Space or Enter to flip. Touch or mouse: tap a light.
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;
const N = 5, CELL = 56, LEVELS = 5;
const X0 = (W - N * CELL) / 2, Y0 = 50;

let grid, level, moves, par, score, cursor, state;

function flip(x, y) {
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const i = x + dx, j = y + dy;
    if (i >= 0 && i < N && j >= 0 && j < N) grid[j][i] = !grid[j][i];
  }
}

function startLevel() {
  grid = Array.from({ length: N }, () => Array(N).fill(false));
  // Scramble by pressing random lights, so every level can be solved.
  par = 2 + level * 2;
  for (let k = 0; k < par; k++) flip(Math.floor(jace.random() * N), Math.floor(jace.random() * N));
  if (grid.every((row) => row.every((on) => !on))) flip(2, 2);
  moves = 0;
  state = "playing";
}

function newGame() {
  level = 1;
  score = 0;
  cursor = { x: 2, y: 2 };
  startLevel();
}

function press(x, y) {
  if (state === "won") return newGame();
  if (state === "cleared") {
    level++;
    return startLevel();
  }
  flip(x, y);
  moves++;
  if (grid.every((row) => row.every((on) => !on))) {
    score += Math.max(10, 100 - 5 * Math.max(0, moves - par));
    if (level >= LEVELS) {
      state = "won";
      jace.submitScore(score);
      jace.gameOver();
    } else state = "cleared";
  }
}

function toGame(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const scale = Math.min(r.width / W, r.height / H);
  return { x: (clientX - r.left - (r.width - W * scale) / 2) / scale, y: (clientY - r.top - (r.height - H * scale) / 2) / scale };
}

canvas.addEventListener("pointerdown", (e) => {
  const p = toGame(e.clientX, e.clientY);
  const x = Math.floor((p.x - X0) / CELL), y = Math.floor((p.y - Y0) / CELL);
  if (state !== "playing") return press(0, 0);
  if (x >= 0 && x < N && y >= 0 && y < N) {
    cursor = { x, y };
    press(x, y);
  }
});

addEventListener("keydown", (e) => {
  const moveBy = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (moveBy) {
    cursor.x = (cursor.x + moveBy[0] + N) % N;
    cursor.y = (cursor.y + moveBy[1] + N) % N;
    e.preventDefault();
  } else if (e.key === " " || e.key === "Enter") {
    press(cursor.x, cursor.y);
    e.preventDefault();
  }
});

function draw() {
  ctx.fillStyle = "#111317";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#e6e8eb";
  ctx.font = "bold 18px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Level " + level + "/" + LEVELS, 12, 22);
  ctx.textAlign = "right";
  ctx.fillText("Moves " + moves + " · Score " + score, W - 12, 22);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      ctx.fillStyle = grid[y][x] ? "#fbbf24" : "#1c1f26";
      ctx.beginPath();
      ctx.roundRect(X0 + x * CELL + 4, Y0 + y * CELL + 4, CELL - 8, CELL - 8, 10);
      ctx.fill();
      if (cursor.x === x && cursor.y === y) {
        ctx.strokeStyle = "#3ddc84";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  }
  if (state !== "playing") {
    ctx.fillStyle = "rgba(0,0,0,.65)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#3ddc84";
    ctx.font = "bold 30px system-ui";
    ctx.fillText(state === "won" ? "All levels cleared!" : "Level cleared!", W / 2, H / 2 - 16);
    ctx.fillStyle = "#e6e8eb";
    ctx.font = "16px system-ui";
    ctx.fillText(state === "won" ? "Score " + score + " · tap to play again" : "Tap or press Space for the next level", W / 2, H / 2 + 20);
  }
  requestAnimationFrame(draw);
}

newGame();
draw();
</script>
`;

const CLICKER = `<style>
  html, body { margin: 0; height: 100%; background: #111317; color: #e6e8eb; overflow: hidden;
    font-family: system-ui, sans-serif; user-select: none; -webkit-user-select: none; touch-action: manipulation; }
  main { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2vh; }
  #stats { display: flex; gap: 24px; font-size: 5vh; font-weight: 700; }
  #time { color: #fbbf24; }
  #cookie { font-size: 26vh; line-height: 1; background: none; border: 0; cursor: pointer; transition: transform 60ms; }
  #cookie:active, #cookie.pop { transform: scale(0.9); }
  #shop { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; padding: 0 8px; }
  #shop button { font: inherit; font-size: 2.6vh; color: inherit; background: #1c1f26; border: 1px solid #2a2f38;
    border-radius: 999px; padding: 1.2vh 2vh; cursor: pointer; }
  #shop button:disabled { opacity: .45; cursor: default; }
  #overlay { position: fixed; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center;
    background: rgba(0,0,0,.75); font-size: 4vh; gap: 2vh; text-align: center; }
  #overlay b { color: #3ddc84; font-size: 7vh; }
</style>
<main>
  <div id="stats"><span id="coins">0 🍪</span><span id="time">60s</span></div>
  <button id="cookie" aria-label="Bake a cookie">🍪</button>
  <div id="shop"></div>
  <small style="opacity:.6">Tap the cookie or press Space · buy with 1 2 3</small>
</main>
<div id="overlay"><b id="final"></b><span>Tap or press Space to play again</span></div>
<script>
// Cookie Rush: bake as many cookies as you can in 60 seconds.
// Your score is every cookie you baked, even the ones you spent.
const ITEMS = [
  { name: "Bigger hands", key: "1", base: 15, grow: 1.6, perClick: 1, perSec: 0 },
  { name: "Helper", key: "2", base: 25, grow: 1.5, perClick: 0, perSec: 1 },
  { name: "Oven", key: "3", base: 150, grow: 1.6, perClick: 0, perSec: 8 },
];
const $ = (id) => document.getElementById(id);
let coins, baked, owned, timeLeft, running;

function cost(i) { return Math.ceil(ITEMS[i].base * Math.pow(ITEMS[i].grow, owned[i])); }
function perClick() { return 1 + ITEMS.reduce((s, it, i) => s + it.perClick * owned[i], 0); }
function perSec() { return ITEMS.reduce((s, it, i) => s + it.perSec * owned[i], 0); }

function earn(n) { coins += n; baked += n; }

function render() {
  $("coins").textContent = Math.floor(coins) + " 🍪";
  $("time").textContent = Math.ceil(timeLeft) + "s";
  ITEMS.forEach((it, i) => {
    const b = $("buy" + i);
    b.textContent = it.key + " · " + it.name + " (" + owned[i] + ") — " + cost(i) + " 🍪";
    b.disabled = coins < cost(i) || !running;
  });
}

function buy(i) {
  if (!running || coins < cost(i)) return;
  coins -= cost(i);
  owned[i]++;
  render();
}

function click() {
  if (!running) return start();
  earn(perClick());
  const c = $("cookie");
  c.classList.add("pop");
  setTimeout(() => c.classList.remove("pop"), 60);
  render();
}

function start() {
  coins = 0; baked = 0; owned = ITEMS.map(() => 0); timeLeft = 60; running = true;
  $("overlay").style.display = "none";
  render();
}

function end() {
  running = false;
  $("final").textContent = Math.floor(baked) + " cookies baked!";
  $("overlay").style.display = "flex";
  jace.submitScore(Math.floor(baked));
  jace.gameOver();
  render();
}

ITEMS.forEach((it, i) => {
  const b = document.createElement("button");
  b.id = "buy" + i;
  b.onclick = () => buy(i);
  $("shop").appendChild(b);
});
$("cookie").addEventListener("pointerdown", (e) => { e.preventDefault(); click(); });
$("overlay").addEventListener("pointerdown", () => start());
addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!e.repeat) click(); }
  const i = ITEMS.findIndex((it) => it.key === e.key);
  if (i >= 0) buy(i);
});

let last = performance.now();
setInterval(() => {
  const now = performance.now();
  const dt = (now - last) / 1000;
  last = now;
  if (!running) return;
  earn(perSec() * dt);
  timeLeft -= dt;
  if (timeLeft <= 0) { timeLeft = 0; end(); }
  render();
}, 100);

start();
</script>
`;

const DUEL = `${BASE_STYLE}
<canvas id="game" width="480" height="360"></canvas>
<script>
// Paddle Duel: first to 5 points wins.
// Keys: ↑ ↓ (or W / S). Touch or mouse: drag up and down.
//
// Online (a room in "live" mode): the host runs the ball and sends the
// state about 15 times a second; the other player sends their paddle.
// Played alone (or in the editor), you play against the computer.
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;
const PH = 70, PW = 10, WIN = 5;

const room = jace.room;
const online = !!room && room.mode === "live" && room.players.length >= 2;
const host = !online || room.isHost;
const mySide = online ? (room.mySeat === 0 ? 0 : 1) : 0;
const names = online
  ? [room.players.find((p) => p.seat === 0)?.name ?? "Left", room.players.find((p) => p.seat === 1)?.name ?? "Right"]
  : [jace.player.name, "Computer"];

let paddles = [H / 2, H / 2];
let ball, scores = [0, 0], over = false, winner = -1, pointerY = null;
const keys = {};

function serve(dir) {
  ball = { x: W / 2, y: H / 2, vx: 220 * dir, vy: (Math.random() * 2 - 1) * 140 };
}
serve(Math.random() < 0.5 ? -1 : 1);

function toGame(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const scale = Math.min(r.width / W, r.height / H);
  return { x: (clientX - r.left - (r.width - W * scale) / 2) / scale, y: (clientY - r.top - (r.height - H * scale) / 2) / scale };
}
addEventListener("keydown", (e) => { keys[e.key] = true; if (e.key.startsWith("Arrow")) e.preventDefault(); if (over && !online && e.key === " ") restart(); });
addEventListener("keyup", (e) => (keys[e.key] = false));
canvas.addEventListener("pointerdown", (e) => { pointerY = toGame(e.clientX, e.clientY).y; if (over && !online) restart(); });
canvas.addEventListener("pointermove", (e) => { if (pointerY !== null || e.pointerType === "mouse") pointerY = toGame(e.clientX, e.clientY).y; });
addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") pointerY = null; });

function restart() { scores = [0, 0]; over = false; winner = -1; serve(1); }

if (online) {
  // The host hears the guest's paddle; the guest hears everything else.
  room.on("paddle", (y) => { if (host && typeof y === "number") paddles[1] = y; });
  room.on("state", (s) => {
    if (host || !s) return;
    ball = s.ball;
    paddles[0] = s.paddles[0];
    scores = s.scores;
    if (s.winner >= 0 && !over) { over = true; winner = s.winner; }
  });
}

function movePaddle(dt) {
  let y = paddles[mySide];
  if (keys.ArrowUp || keys.w || keys.W) y -= 300 * dt;
  if (keys.ArrowDown || keys.s || keys.S) y += 300 * dt;
  if (pointerY !== null) y += Math.max(-400 * dt, Math.min(400 * dt, pointerY - y));
  paddles[mySide] = Math.max(PH / 2, Math.min(H - PH / 2, y));
}

function step(dt) {
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  if (ball.y < 6 || ball.y > H - 6) { ball.vy *= -1; ball.y = Math.max(6, Math.min(H - 6, ball.y)); }
  for (const side of [0, 1]) {
    const px = side === 0 ? 20 : W - 20;
    const hit = side === 0 ? ball.x - 6 < px + PW / 2 && ball.vx < 0 : ball.x + 6 > px - PW / 2 && ball.vx > 0;
    if (hit && Math.abs(ball.y - paddles[side]) < PH / 2 + 6 && Math.abs(ball.x - px) < 20) {
      ball.vx = -ball.vx * 1.06;
      ball.vy += (ball.y - paddles[side]) * 4;
    }
  }
  if (ball.x < -10 || ball.x > W + 10) {
    const scorer = ball.x < 0 ? 1 : 0;
    scores[scorer]++;
    if (scores[scorer] >= WIN) {
      over = true;
      winner = scorer;
      if (online) jace.gameOver({ winners: [scorer] });
      else { jace.submitScore(scores[0] * 100 - scores[1] * 50); jace.gameOver(); }
    } else serve(scorer === 0 ? 1 : -1);
  }
}

let sentAt = 0;
function update(dt, now) {
  movePaddle(dt);
  if (!online) {
    // The computer follows the ball, a little slowly.
    paddles[1] += Math.max(-200 * dt, Math.min(200 * dt, ball.y - paddles[1]));
  }
  if (host && !over) step(dt);
  if (online && now - sentAt > 66) {
    sentAt = now;
    if (host) room.send("state", { ball, paddles, scores, winner });
    else room.send("paddle", paddles[1]);
  }
}

function draw() {
  ctx.fillStyle = "#111317";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#2a2f38";
  ctx.setLineDash([8, 10]);
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
  ctx.setLineDash([]);
  ["#3ddc84", "#60a5fa"].forEach((color, side) => {
    ctx.fillStyle = color;
    ctx.fillRect((side === 0 ? 20 : W - 20) - PW / 2, paddles[side] - PH / 2, PW, PH);
  });
  ctx.fillStyle = "#e6e8eb";
  ctx.beginPath(); ctx.arc(ball.x, ball.y, 6, 0, Math.PI * 2); ctx.fill();
  ctx.font = "bold 28px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(scores[0] + "   " + scores[1], W / 2, 10);
  ctx.font = "13px system-ui";
  ctx.fillStyle = "#8b919c";
  ctx.textAlign = "left"; ctx.fillText(names[0] + (mySide === 0 ? " (you)" : ""), 10, 12);
  ctx.textAlign = "right"; ctx.fillText(names[1] + (mySide === 1 ? " (you)" : ""), W - 10, 12);
  if (over) {
    ctx.fillStyle = "rgba(0,0,0,.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#3ddc84";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 30px system-ui";
    ctx.fillText(winner === mySide ? "You win!" : names[winner] + " wins", W / 2, H / 2);
    if (!online) {
      ctx.fillStyle = "#e6e8eb";
      ctx.font = "16px system-ui";
      ctx.fillText("Tap or press Space to play again", W / 2, H / 2 + 34);
    }
  }
}

let last = performance.now();
function frame(now) {
  update(Math.min(0.05, (now - last) / 1000), now);
  last = now;
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
</script>
`;

const BLANK = `${BASE_STYLE}
<canvas id="game" width="480" height="360"></canvas>
<script>
// Your game starts here. The canvas is 480x360 and scales to fit.
// jace.submitScore(n) saves a score; jace.gameOver() ends the round.
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let t = 0;

function frame() {
  t += 1 / 60;
  ctx.fillStyle = "#111317";
  ctx.fillRect(0, 0, 480, 360);
  ctx.fillStyle = "#3ddc84";
  ctx.font = "bold 28px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Hello, " + jace.player.name + "!", 240, 180 + Math.sin(t * 3) * 20);
  requestAnimationFrame(frame);
}
frame();
</script>
`;

const HTML: Record<TemplateId, string> = { arcade: ARCADE, puzzle: PUZZLE, clicker: CLICKER, duel: DUEL, blank: BLANK };

export function templateHtml(id: TemplateId): string {
  return HTML[id] ?? BLANK;
}

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
