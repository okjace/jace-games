"use client";

import { useSyncExternalStore } from "react";
import { callSnapshot, callSubscribe, joinCall, leaveCall, setMuted } from "./callClient";

/** Is this device in a call in this game right now (and muted)? For the chat's 📞 button. */
export function useInCall(code: string): { inCall: boolean; muted: boolean } {
  const ui = useSyncExternalStore(callSubscribe, callSnapshot, callSnapshot);
  return { inCall: !!ui.room && ui.code === code, muted: ui.muted };
}

/**
 * Voice chat controls, shown inside the game chat (its 📞 button). Join the
 * game call or ur team's call (you start muted), mute or leave any time. You
 * only connect with ur Jace Social friends.
 */
export function CallControls({ code, hasTeam, tone = "panel" }: { code: string; hasTeam: boolean; tone?: "panel" | "stage" }) {
  const ui = useSyncExternalStore(callSubscribe, callSnapshot, callSnapshot);
  const inCall = !!ui.room && ui.code === code;
  const muted = tone === "stage" ? "text-white/70" : "text-muted";
  const outline = tone === "stage" ? "border-white/25 hover:bg-white/10" : "border-line hover:bg-accent/10";
  return (
    <section aria-label="Voice chat" className="flex flex-col gap-2 p-3 text-sm">
      <p className={`text-xs ${muted}`}>📞 voice chat, only w/ ur Jace Social friends in this game. u join muted.</p>
      {!inCall ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={ui.joining} onClick={() => void joinCall(code, "game")} className="flex-1 rounded-full bg-accent px-3 py-2 font-bold text-on-accent disabled:opacity-60">
            {ui.joining ? "joining…" : "📞 join game call"}
          </button>
          {hasTeam && (
            <button type="button" disabled={ui.joining} onClick={() => void joinCall(code, "team")} className={`flex-1 rounded-full border px-3 py-2 font-bold disabled:opacity-60 ${outline}`}>
              👥 join team call
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="font-semibold">{ui.room === "team" ? "👥 in the team call" : "📞 in the game call"}</p>
          {ui.peers.length === 0 ? (
            <p className={`text-xs ${muted}`}>no friends in this call yet. invite some!</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {ui.peers.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${p.connected ? "bg-emerald-500" : "bg-amber-400"}`} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className={`text-xs ${muted}`}>{p.connected ? "🔊" : "connecting…"}</span>
                </li>
              ))}
            </ul>
          )}
          {ui.notFriends > 0 && (
            <p className={`text-xs ${muted}`}>
              {ui.notFriends} other {ui.notFriends === 1 ? "person is" : "ppl are"} in this call but not ur friend, so u cant hear each other.
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setMuted(!ui.muted)} aria-pressed={!ui.muted} className={`flex-1 rounded-full px-3 py-2 font-bold ${ui.muted ? `border ${outline}` : "bg-emerald-500 text-white"}`}>
              {ui.muted ? "🔇 unmute" : "🎙️ mute"}
            </button>
            <button type="button" onClick={() => void leaveCall()} className="flex-1 rounded-full bg-danger px-3 py-2 font-bold text-white">
              📴 leave
            </button>
          </div>
        </div>
      )}
      {ui.error && <p className="text-xs font-semibold text-danger">{ui.error}</p>}
    </section>
  );
}
