"use client";

import { useState, useSyncExternalStore } from "react";
import { callSnapshot, callSubscribe, joinCall, leaveCall, setMuted } from "./callClient";

/**
 * Voice chat in a game: a small button in the corner that opens the call
 * panel. Join the game call or ur team's call (you start muted), mute or
 * leave any time. You only connect with ur Jace Social friends.
 */
export function CallPanel({ code, hasTeam }: { code: string; hasTeam: boolean }) {
  const ui = useSyncExternalStore(callSubscribe, callSnapshot, callSnapshot);
  const [open, setOpen] = useState(false);
  const inCall = !!ui.room && ui.code === code;
  return (
    <div className="fixed bottom-20 right-3 z-[65] flex flex-col items-end gap-2">
      {open && (
        <section aria-label="Voice chat" className="jl-pop-in w-72 rounded-2xl border border-line bg-panel p-3 text-sm text-foreground shadow-xl">
          <p className="font-display text-lg font-extrabold">📞 voice chat</p>
          <p className="mb-2 text-xs text-muted">only with ur Jace Social friends in this game. u join muted.</p>
          {!inCall ? (
            <div className="flex flex-col gap-2">
              <button type="button" disabled={ui.joining} onClick={() => void joinCall(code, "game")} className="rounded-full bg-accent px-4 py-2 font-bold text-on-accent disabled:opacity-60">
                {ui.joining ? "joining…" : "📞 join game call"}
              </button>
              {hasTeam && (
                <button type="button" disabled={ui.joining} onClick={() => void joinCall(code, "team")} className="rounded-full border border-line px-4 py-2 font-bold hover:bg-accent/10 disabled:opacity-60">
                  👥 join team call
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="font-semibold">{ui.room === "team" ? "👥 team call" : "📞 game call"}</p>
              {ui.peers.length === 0 ? (
                <p className="text-xs text-muted">no friends in this call yet. invite some!</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {ui.peers.map((p) => (
                    <li key={p.id} className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${p.connected ? "bg-emerald-500" : "bg-amber-400"}`} />
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <span className="text-xs text-muted">{p.connected ? "🔊" : "connecting…"}</span>
                    </li>
                  ))}
                </ul>
              )}
              {ui.notFriends > 0 && <p className="text-xs text-muted">{ui.notFriends} other {ui.notFriends === 1 ? "person is" : "ppl are"} in this call but not ur friend, so u cant hear each other.</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setMuted(!ui.muted)} aria-pressed={!ui.muted} className={`flex-1 rounded-full px-3 py-2 font-bold ${ui.muted ? "border border-line hover:bg-accent/10" : "bg-emerald-500 text-white"}`}>
                  {ui.muted ? "🔇 unmute" : "🎙️ mute"}
                </button>
                <button type="button" onClick={() => void leaveCall()} className="flex-1 rounded-full bg-danger px-3 py-2 font-bold text-white">
                  📴 leave
                </button>
              </div>
            </div>
          )}
          {ui.error && <p className="mt-2 text-xs font-semibold text-danger">{ui.error}</p>}
        </section>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={inCall ? (ui.muted ? "In a call, muted" : "In a call, talking") : "Voice chat"}
        className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl shadow-lg ${inCall ? (ui.muted ? "bg-amber-400" : "bg-emerald-500") : "bg-panel border border-line"}`}
      >
        {inCall ? (ui.muted ? "🔇" : "🎙️") : "📞"}
      </button>
    </div>
  );
}
