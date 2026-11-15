"use client";

import { useEffect, useRef, useState } from "react";
import { EMOTES } from "@/lib/live/emotes";
import { openRoomChannel } from "@/lib/realtime/client";

type Floater = { id: number; emoji: string; x: number; drift: number };

/** Emotes floating up the screen (on the host's big screen and players' screens). */
export function EmoteLayer({ topic, big = false }: { topic: string; big?: boolean }) {
  const [list, setList] = useState<Floater[]>([]);
  const next = useRef(0);
  useEffect(() => {
    const ch = openRoomChannel(topic, null);
    const off = ch.on("emote", (p) => {
      const m = p as { emoji?: string; x?: number };
      if (!m.emoji || !(EMOTES as readonly string[]).includes(m.emoji)) return;
      const id = ++next.current;
      setList((cur) => [...cur.slice(-40), { id, emoji: m.emoji!, x: 6 + (Number(m.x) || Math.random()) * 88, drift: (Math.random() - 0.5) * 60 }]);
      setTimeout(() => setList((cur) => cur.filter((f) => f.id !== id)), 3200);
    });
    return () => {
      off();
      ch.close();
    };
  }, [topic]);
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      {list.map((f) => (
        <span key={f.id} className={`jl-emote absolute bottom-0 ${big ? "text-6xl" : "text-4xl"}`} style={{ left: `${f.x}%`, ["--drift" as string]: `${f.drift}px` }}>
          {f.emoji}
        </span>
      ))}
    </div>
  );
}

/** The row of emote buttons on a player's screen. */
export function EmoteBar({ code, token, tone = "panel" }: { code: string; token: string; tone?: "panel" | "stage" }) {
  const [wait, setWait] = useState(false);
  const send = async (emoji: string) => {
    if (wait) return;
    setWait(true);
    setTimeout(() => setWait(false), 900);
    await fetch(`/api/live/games/${code}/emote`, { method: "POST", headers: { "Content-Type": "application/json", "X-Live-Token": token }, body: JSON.stringify({ emoji }) }).catch(() => null);
  };
  return (
    <div className={`flex flex-wrap justify-center gap-1 rounded-full p-1 ${tone === "stage" ? "bg-black/25" : "border border-line bg-panel"}`} role="group" aria-label="Send an emote">
      {EMOTES.map((e) => (
        <button key={e} type="button" onClick={() => void send(e)} disabled={wait} aria-label={`Send ${e}`} className="h-9 w-9 rounded-full text-xl transition-transform hover:scale-125 active:scale-90 disabled:opacity-50">
          {e}
        </button>
      ))}
    </div>
  );
}
