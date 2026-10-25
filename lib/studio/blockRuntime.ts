/**
 * The small engine block games run on, inside the same sandbox as code
 * games: a 480x360 canvas that scales to fit, sprites (emoji or shapes)
 * with positions, sizes and speeds, events (start, keys, taps, every
 * frame, timers, messages from other players), a score, and game over.
 * Blocks compile to calls on `$g` (see lib/studio/blocks.ts).
 */

export const BLOCK_RUNTIME = `<style>
  html, body { margin: 0; height: 100%; background: #111317; overflow: hidden; touch-action: none;
    user-select: none; -webkit-user-select: none; }
  canvas { display: block; width: 100vw; height: 100vh; object-fit: contain; }
</style>
<canvas id="stage" width="480" height="360"></canvas>
<script>
// The block game engine. Everything your blocks do goes through $g.
var $g = (function () {
  "use strict";
  var canvas = document.getElementById("stage");
  var ctx = canvas.getContext("2d");
  var W = 480, H = 360;
  var COLORS = { green: "#3ddc84", blue: "#60a5fa", red: "#f87171", yellow: "#fbbf24", white: "#e6e8eb", grey: "#8b919c", purple: "#a78bfa", orange: "#fb923c", black: "#111317", navy: "#1e3a5f" };
  var on = { start: [], tick: [], tap: [], key: {}, spriteTap: [], every: [], msg: {} };
  var sprites = [], timers = [], down = {};
  var score = 0, scoreShown = false, over = false, background = "#111317", text = "", time = 0;
  var pointer = { x: W / 2, y: H / 2, down: false };
  var message = { value: null, from: -1 };
  var steps = 0;
  var room = window.jace && jace.room;

  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function color(c) { return COLORS[c] || c || "#e6e8eb"; }
  function run(fn, args) {
    steps = 200000;
    try { fn.apply(null, args || []); } catch (e) { console.error(String(e && e.message || e)); }
  }
  function keyName(k) {
    var map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", " ": "space", Enter: "enter" };
    return map[k] || (k.length === 1 ? k.toLowerCase() : k);
  }
  function toGame(e) {
    var r = canvas.getBoundingClientRect();
    var s = Math.min(r.width / W, r.height / H);
    return { x: (e.clientX - r.left - (r.width - W * s) / 2) / s, y: (e.clientY - r.top - (r.height - H * s) / 2) / s };
  }
  function alive(s) { return s && typeof s === "object" && s.alive; }
  function touching(a, b) {
    if (!alive(a) || !alive(b) || a === b) return false;
    return Math.abs(a.x - b.x) < (a.size + b.size) * 0.4 && Math.abs(a.y - b.y) < (a.size + b.size) * 0.4;
  }

  addEventListener("keydown", function (e) {
    var k = keyName(e.key);
    if (e.key.indexOf("Arrow") === 0 || e.key === " ") e.preventDefault();
    if (over && (k === "space" || k === "enter")) return restart();
    if (down[k]) return;
    down[k] = true;
    if (over) return;
    (on.key[k] || []).concat(on.key.any || []).forEach(function (fn) { run(fn); });
  });
  addEventListener("keyup", function (e) { down[keyName(e.key)] = false; });
  addEventListener("blur", function () { down = {}; });
  canvas.addEventListener("pointerdown", function (e) {
    var p = toGame(e);
    pointer.x = p.x; pointer.y = p.y; pointer.down = true;
    if (over) return restart();
    for (var i = sprites.length - 1; i >= 0; i--) {
      var s = sprites[i];
      if (Math.abs(p.x - s.x) < s.size / 2 + 6 && Math.abs(p.y - s.y) < s.size / 2 + 6) {
        on.spriteTap.forEach(function (h) { if (h.sprite() === s) run(h.fn); });
        break;
      }
    }
    on.tap.forEach(function (fn) { run(fn); });
  });
  canvas.addEventListener("pointermove", function (e) { var p = toGame(e); pointer.x = p.x; pointer.y = p.y; });
  addEventListener("pointerup", function () { pointer.down = false; });
  addEventListener("pointercancel", function () { pointer.down = false; });

  function start() {
    sprites = []; timers = []; score = 0; scoreShown = false; over = false; text = ""; time = 0; background = "#111317";
    on.every.forEach(function (e) { e.next = e.secs; });
    on.start.forEach(function (fn) { run(fn); });
  }
  function restart() { start(); }

  function update(dt) {
    if (over) return;
    time += dt;
    var f = dt * 60;
    sprites.forEach(function (s) {
      s.x += s.vx * f; s.y += s.vy * f;
      // Moving sprites that fly far off screen are cleaned up.
      if ((s.vx || s.vy) && (s.x < -200 || s.x > W + 200 || s.y < -200 || s.y > H + 200)) s.alive = false;
    });
    sprites = sprites.filter(alive);
    on.every.forEach(function (e) {
      e.next -= dt;
      if (e.next <= 0) { e.next += Math.max(0.05, e.secs); if (!over) run(e.fn); }
    });
    var due = timers.filter(function (t) { return t.at <= time; });
    timers = timers.filter(function (t) { return t.at > time; });
    due.forEach(function (t) { if (!over) run(t.fn); });
    if (!over) on.tick.forEach(function (fn) { run(fn); });
  }

  function draw() {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    sprites.forEach(function (s) {
      if (s.look) {
        ctx.font = s.size + "px serif";
        ctx.fillText(s.look, s.x, s.y + s.size * 0.05);
      } else {
        ctx.fillStyle = s.color;
        if (s.shape === "circle") { ctx.beginPath(); ctx.arc(s.x, s.y, s.size / 2, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
      }
    });
    if (scoreShown) {
      ctx.fillStyle = "#e6e8eb"; ctx.font = "bold 18px system-ui"; ctx.textAlign = "left";
      ctx.fillText("Score " + score, 12, 18);
    }
    if (text) {
      ctx.fillStyle = "#e6e8eb"; ctx.font = "bold 22px system-ui"; ctx.textAlign = "center";
      ctx.fillText(text, W / 2, 40);
    }
    if (over) {
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.fillStyle = "#3ddc84"; ctx.font = "bold 32px system-ui"; ctx.fillText("Game over", W / 2, H / 2 - 18);
      ctx.fillStyle = "#e6e8eb"; ctx.font = "16px system-ui";
      ctx.fillText("Score " + score + " · tap or press Space to play again", W / 2, H / 2 + 20);
    }
  }

  var last = performance.now();
  function frame(now) {
    update(Math.min(0.05, (now - last) / 1000));
    last = now;
    draw();
    requestAnimationFrame(frame);
  }
  setTimeout(function () { start(); requestAnimationFrame(frame); }, 0);

  function makeSprite(props) {
    var s = { x: W / 2, y: H / 2, size: 40, vx: 0, vy: 0, look: null, shape: "circle", color: "#e6e8eb", alive: true };
    for (var k in props) s[k] = props[k];
    sprites.push(s);
    return s;
  }
  var PROPS = { x: 1, y: 1, size: 1, vx: 1, vy: 1 };

  return {
    onStart: function (fn) { on.start.push(fn); },
    onTick: function (fn) { on.tick.push(fn); },
    onTap: function (fn) { on.tap.push(fn); },
    onKey: function (k, fn) { (on.key[k] = on.key[k] || []).push(fn); },
    onSpriteTap: function (sprite, fn) { on.spriteTap.push({ sprite: sprite, fn: fn }); },
    every: function (secs, fn) { secs = Math.max(0.05, num(secs)); on.every.push({ secs: secs, next: secs, fn: fn }); },
    onMessage: function (name, fn) {
      if (!room) return;
      room.on(String(name), function (data, from) { message.value = data; message.from = from; if (!over) run(fn); });
    },
    loop: function () { if (--steps < 0) throw new Error("A loop ran too long, so it was stopped."); },
    sprite: function (look, x, y, size) { return makeSprite({ look: String(look), x: num(x), y: num(y), size: Math.max(1, num(size)) }); },
    shape: function (shape, c, x, y, size) { return makeSprite({ shape: shape === "square" ? "square" : "circle", color: color(c), x: num(x), y: num(y), size: Math.max(1, num(size)) }); },
    set: function (s, p, v) { if (alive(s) && PROPS[p]) s[p] = p === "size" ? Math.max(1, num(v)) : num(v); },
    change: function (s, p, v) { if (alive(s) && PROPS[p]) s[p] = p === "size" ? Math.max(1, s[p] + num(v)) : s[p] + num(v); },
    get: function (s, p) { return alive(s) && PROPS[p] ? Math.round(s[p] * 100) / 100 : 0; },
    moveTo: function (s, x, y) { if (alive(s)) { s.x = num(x); s.y = num(y); } },
    moveBy: function (s, dx, dy) { if (alive(s)) { s.x += num(dx); s.y += num(dy); } },
    bounce: function (s) {
      if (!alive(s)) return;
      var r = s.size / 2;
      if (s.x < r) { s.x = r; s.vx = Math.abs(s.vx); }
      if (s.x > W - r) { s.x = W - r; s.vx = -Math.abs(s.vx); }
      if (s.y < r) { s.y = r; s.vy = Math.abs(s.vy); }
      if (s.y > H - r) { s.y = H - r; s.vy = -Math.abs(s.vy); }
    },
    keepOn: function (s) {
      if (!alive(s)) return;
      var r = s.size / 2;
      s.x = Math.max(r, Math.min(W - r, s.x));
      s.y = Math.max(r, Math.min(H - r, s.y));
    },
    setLook: function (s, look) { if (alive(s)) s.look = String(look); },
    remove: function (s) { if (alive(s)) s.alive = false; },
    removeLook: function (look) { sprites.forEach(function (s) { if (s.look === String(look)) s.alive = false; }); },
    touching: touching,
    touchingLook: function (s, look) {
      look = String(look);
      for (var i = 0; i < sprites.length; i++) if (sprites[i].look === look && touching(s, sprites[i])) return true;
      return false;
    },
    touchingEdge: function (s) {
      if (!alive(s)) return false;
      var r = s.size / 2;
      return s.x <= r || s.x >= W - r || s.y <= r || s.y >= H - r;
    },
    keyDown: function (k) {
      if (k === "any") { for (var key in down) if (down[key]) return true; return false; }
      return !!down[k];
    },
    pointerDown: function () { return pointer.down; },
    pointer: function (axis) { return Math.round(axis === "y" ? pointer.y : pointer.x); },
    time: function () { return Math.round(time * 100) / 100; },
    screen: function (axis) { return axis === "height" ? H : W; },
    setScore: function (v) { score = Math.round(num(v)); scoreShown = true; },
    changeScore: function (v) { score = Math.round(score + num(v)); scoreShown = true; },
    score: function () { return score; },
    gameOver: function (winner) {
      if (over) return;
      over = true;
      if (winner !== undefined && room && room.mode === "live") jace.gameOver({ winners: [Math.round(num(winner)) - 1] });
      else { jace.submitScore(score); jace.gameOver(); }
    },
    showText: function (t) { text = t === null || t === undefined ? "" : String(t).slice(0, 80); },
    background: function (c) { background = color(c); },
    after: function (secs, fn) { timers.push({ at: time + Math.max(0, num(secs)), fn: fn }); },
    send: function (name, value) { if (room) room.send(String(name), value === undefined ? null : value); },
    messageValue: function () { return message.value; },
    messageFrom: function () { return message.from + 1; },
    isHost: function () { return !room || room.isHost; },
    online: function () { return !!room; },
    myNumber: function () { return room ? room.mySeat + 1 : 1; },
    playerCount: function () { return room ? room.players.length : 1; },
    myName: function () { return jace.player.name; }
  };
})();
</script>
`;
