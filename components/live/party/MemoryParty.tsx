"use client";

import { useEffect, useRef } from "react";
import type { MpView } from "@/lib/live/memoryParty";
import { openRoomChannel } from "@/lib/realtime/client";
import { useJuice } from "../fx/Juice";
import { sfx } from "../fx/sfx";
import type { StageProps } from "./index";

/**
 * Memory Party: one shared board for the whole room. Phones flip cards
 * (each right answer is a turn); the big screen shows the same board. Both
 * refresh as soon as anyone flips.
 */

/** The board: face-down cards, cards showing for a moment, and claimed pairs in their owner's colour. */
export function MpBoard({ mp, onFlip, big = false, busy = false }: { mp: MpView; onFlip?: (cell: number) => void; big?: boolean; busy?: boolean }) {
  const showing = new Set(mp.showing);
  const canFlip = !!onFlip && (mp.moves > 0 || mp.myOpen !== null) && !busy;
  return (
    <div className={`grid gap-2 ${big ? "grid-cols-8" : "grid-cols-6"}`}>
      {mp.faces.map((f, c) => {
        const owner = mp.owner[c] >= 0 ? mp.players[mp.owner[c]] : null;
        const up = f !== null;
        const mineOpen = mp.myOpen === c;
        return (
          <button
            key={c}
            type="button"
            disabled={!canFlip || !!owner || mineOpen}
            onClick={() => onFlip?.(c)}
            aria-label={owner ? `${f}, matched by ${owner.name}` : up ? `Card showing ${f}` : "Face-down card"}
            className={`relative flex aspect-[3/4] items-center justify-center rounded-xl font-bold transition-transform duration-300 ${big ? "text-5xl" : "text-3xl"} ${
              owner ? "opacity-90" : up ? "bg-white shadow-lg" : "bg-gradient-to-br from-fuchsia-400 to-indigo-500 shadow-md hover:scale-105"
            } ${mineOpen ? "ring-4 ring-amber-300" : ""} ${showing.has(c) && !owner ? "animate-[jl-pop-in_0.35s_ease-out]" : ""}`}
            style={owner ? { background: owner.color } : undefined}
          >
            {up ? f : <span className="text-white/70">?</span>}
            {owner && <span className={`absolute bottom-1 left-1 right-1 truncate rounded bg-black/30 px-1 text-white ${big ? "text-xs" : "text-[9px]"}`}>{owner.name}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function MemoryParty({ view, act, earn, busy }: StageProps) {
  const juice = useJuice();
  const mp = (view.party as { mp?: MpView }).mp;

  // Refresh when anyone flips, and again when their cards turn back over.
  const actRef = useRef(act);
  useEffect(() => {
    actRef.current = act;
  }, [act]);
  useEffect(() => {
    const ch = openRoomChannel(view.topic, null);
    let later: ReturnType<typeof setTimeout> | null = null;
    const off = ch.on("mp", () => {
      void actRef.current({ action: "mparty-view" });
      if (later) clearTimeout(later);
      later = setTimeout(() => void actRef.current({ action: "mparty-view" }), 3700);
    });
    return () => {
      off();
      ch.close();
      if (later) clearTimeout(later);
    };
  }, [view.topic]);

  const flip = async (cell: number) => {
    const v = await act({ action: "mparty-flip", cell });
    const last = v?.last;
    if (!last) return;
    if (last.kind === "mp-match") {
      sfx.levelUp();
      juice.pop(`+${String(last.points)}${Number(last.combo) > 1 ? ` combo ×${String(last.combo)}` : ""}`, "#86efac");
      if (last.cleared) juice.confetti(120);
    } else if (last.kind === "mp-miss") {
      sfx.wrong();
      juice.shake();
    } else if (last.kind === "mp-late") {
      sfx.wrong();
      juice.pop("too slow!! someone got it 😭", "#fca5a5");
    } else sfx.tap();
    setTimeout(() => void act({ action: "mparty-view" }), 3700);
  };

  if (!mp) return earn;
  const mine = mp.players.find((p) => p.name === view.me.name);
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-3xl bg-black/25 p-3 backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-2 text-sm font-bold">
          <span className={`rounded-full px-3 py-1 ${mp.moves > 0 || mp.myOpen !== null ? "bg-white text-black" : "bg-black/30"}`}>🎴 {mp.myOpen !== null ? "flip 1 more!" : `${mp.moves} turn${mp.moves === 1 ? "" : "s"}`}</span>
          <span className="rounded-full bg-black/30 px-3 py-1">board {mp.round + 1}</span>
          <span className="rounded-full bg-black/30 px-3 py-1" style={mine ? { boxShadow: `inset 0 0 0 2px ${mine.color}` } : undefined}>
            {mine?.pairs ?? 0} pairs
          </span>
        </div>
        <MpBoard mp={mp} onFlip={(c) => void flip(c)} busy={busy} />
        <p className="mt-2 text-center text-xs font-semibold text-white/80">evry flip shows for evryone for a sec. watch the board!! 👀</p>
      </div>
      <p className="text-center text-sm font-black">answer right = a turn (flip 2 cards) 👇</p>
      {earn}
    </div>
  );
}
