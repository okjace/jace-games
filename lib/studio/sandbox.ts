/**
 * Builds the document a community game runs in. The game's HTML is put
 * after a Content-Security-Policy that blocks every network request (no
 * fetch, XHR, WebSocket, images or scripts from elsewhere) and after the
 * Jace SDK, which talks to the page around it with postMessage only. The
 * document goes into <iframe sandbox="allow-scripts allow-pointer-lock"
 * srcdoc>, so it runs on an opaque origin: no cookies, no storage, no
 * access to this site, and it can't navigate the top window.
 */

export const GAME_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "media-src data: blob:",
  "font-src data:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

export type SandboxPlayer = { seat: number; name: string; you: boolean; host: boolean };

export type SandboxInit = {
  player: { name: string };
  seed: number;
  room: { mode: "race" | "live"; isHost: boolean; mySeat: number; players: SandboxPlayer[] } | null;
};

/** Limits the page enforces on messages from a game. */
export const SDK_LIMITS = {
  eventPattern: /^[A-Za-z0-9_:.-]{1,32}$/,
  maxDataBytes: 8 * 1024,
  messagesPerSecond: 20,
  logsPerSecond: 30,
};

/**
 * window.jace inside the game. Messages from the page are only accepted
 * from window.parent; everything the game sends goes to the parent, which
 * checks it again (it never trusts the game).
 */
const SDK = `(function(){
"use strict";
var init = __INIT__;
var P = window.parent;
var handlers = {};
function post(m){ m.__jace = 1; try { P.postMessage(m, "*"); } catch (e) {} }
function text(v){ try { return typeof v === "string" ? v : JSON.stringify(v); } catch (e) { return String(v); } }
function log(level, args){ post({ type: "log", level: level, text: Array.prototype.map.call(args, text).join(" ").slice(0, 500) }); }
["log","info","warn","error"].forEach(function(level){
  var orig = console[level];
  console[level] = function(){ log(level, arguments); if (orig) orig.apply(console, arguments); };
});
window.addEventListener("error", function(e){ log("error", [e.message + (e.lineno ? " (line " + e.lineno + ")" : "")]); });
window.addEventListener("unhandledrejection", function(e){ log("error", ["Unhandled promise rejection: " + text(e.reason)]); });
var seed = init.seed >>> 0;
function random(){ seed = (seed + 0x6D2B79F5) >>> 0; var t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
var room = null;
if (init.room) {
  room = Object.freeze({
    mode: init.room.mode,
    isHost: init.room.isHost,
    mySeat: init.room.mySeat,
    players: Object.freeze(init.room.players.map(function(p){ return Object.freeze(p); })),
    send: function(event, data){ post({ type: "send", event: String(event), data: data === undefined ? null : data }); },
    on: function(event, cb){
      event = String(event);
      (handlers[event] = handlers[event] || []).push(cb);
      return function(){ handlers[event] = (handlers[event] || []).filter(function(f){ return f !== cb; }); };
    }
  });
}
window.addEventListener("message", function(e){
  if (e.source !== P || !e.data || e.data.__jace !== 1) return;
  var m = e.data;
  if (m.type === "msg") (handlers[m.event] || []).slice().forEach(function(cb){ try { cb(m.data, m.from); } catch (err) { log("error", [String(err)]); } });
});
var jace = {
  player: Object.freeze({ name: init.player.name }),
  seed: init.seed,
  random: random,
  submitScore: function(n){ n = Number(n); if (isFinite(n)) post({ type: "score", score: Math.round(n) }); },
  gameOver: function(result){
    var w = result && Array.isArray(result.winners) ? result.winners.filter(function(s){ return typeof s === "number" && s % 1 === 0; }).slice(0, 8) : null;
    post({ type: "gameOver", winners: w });
  },
  onReady: function(cb){
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ cb(jace); });
    else setTimeout(function(){ cb(jace); }, 0);
  },
  room: room
};
Object.defineProperty(window, "jace", { value: Object.freeze(jace), writable: false, configurable: false });
})();`;

function scriptJson(v: unknown): string {
  return JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/** The whole document for an iframe's srcdoc: CSP first, then the SDK, then the game. */
export function buildSrcdoc(html: string, init: SandboxInit): string {
  const sdk = SDK.replace("__INIT__", () => scriptJson(init));
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${GAME_CSP}">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<script>${sdk}</script>` +
    html
  );
}
