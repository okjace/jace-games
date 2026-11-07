"use client";

import { useEffect, useRef, useState } from "react";
import { Tabs, Toast, useReport, useSaved, type PartyProps } from "./shared";

/**
 * Gadget Factory: right answers earn coins; coins buy machines that build
 * gadgets every second. Random events keep it lively: a power surge doubles
 * output for a while, and a glitch slows everything until you tap Fix it.
 * Score = every gadget ever built.
 */

const MACHINES = [
  { id: "bench", icon: "🔧", name: "Tinker bench", cost: 20, rate: 1 },
  { id: "press", icon: "⚙️", name: "Gear press", cost: 100, rate: 6 },
  { id: "arm", icon: "🦾", name: "Robo arm", cost: 400, rate: 26 },
  { id: "lab", icon: "🧪", name: "Mad lab", cost: 1500, rate: 105 },
] as const;
type MachineId = (typeof MACHINES)[number]["id"];

type Saved = { spent: number; owned: Record<MachineId, number>; gadgets: number };
type Event = { kind: "surge" | "glitch"; until: number } | null;

const costOf = (base: number, owned: number) => Math.round(base * 1.15 ** owned);

export function GadgetFactory({ view, act, earn }: PartyProps) {
  const [tab, setTab] = useState<"play" | "earn">("earn");
  const [saved, save] = useSaved<Saved>(view.code, "factory", () => ({ spent: 0, owned: { bench: 0, press: 0, arm: 0, lab: 0 }, gadgets: 0 }));
  const [event, setEvent] = useState<Event>(null);
  const [toast, setToast] = useState<{ text: string; good: boolean; id: number } | null>(null);
  const eventRef = useRef<Event>(null);
  useEffect(() => {
    eventRef.current = event;
  }, [event]);

  const coins = Math.max(0, (view.party.bank ?? 0) - saved.spent);
  const baseRate = MACHINES.reduce((a, m) => a + m.rate * saved.owned[m.id], 0);
  const mult = event?.kind === "surge" ? 2 : event?.kind === "glitch" ? 0.5 : 1;
  const rate = baseRate * mult;
  useReport(act, saved.gadgets);

  const toastId = useRef(0);
  const say = (text: string, good = true) => setToast({ text, good, id: ++toastId.current });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  // Production, ten times a second.
  const rateRef = useRef(rate);
  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);
  useEffect(() => {
    let last = performance.now();
    const t = setInterval(() => {
      const n = performance.now();
      const made = (rateRef.current * (n - last)) / 1000;
      last = n;
      if (made > 0) save((cur) => ({ ...cur, gadgets: cur.gadgets + made }));
      const e = eventRef.current;
      if (e && Date.now() > e.until) setEvent(null);
    }, 100);
    return () => clearInterval(t);
  }, [save]);

  // Now and then, something happens (once you have machines).
  useEffect(() => {
    const t = setInterval(() => {
      if (eventRef.current || rateRef.current === 0 || Math.random() > 0.25) return;
      if (Math.random() < 0.6) {
        setEvent({ kind: "surge", until: Date.now() + 15_000 });
        setToast({ text: "⚡ Power surge! Double gadgets for 15s", good: true, id: Date.now() });
      } else {
        setEvent({ kind: "glitch", until: Date.now() + 20_000 });
        setToast({ text: "🐛 Glitch! Tap Fix it to get back to full speed", good: false, id: Date.now() });
      }
    }, 10_000);
    return () => clearInterval(t);
  }, []);

  const buy = (m: (typeof MACHINES)[number]) => {
    const cost = costOf(m.cost, saved.owned[m.id]);
    if (coins < cost) return say("Not enough coins. Answer questions to earn more!", false);
    save((cur) => ({ ...cur, spent: cur.spent + cost, owned: { ...cur.owned, [m.id]: cur.owned[m.id] + 1 } }));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-xl bg-panel px-4 py-2 text-sm">
        <span>🪙 {coins}</span>
        <span>{Math.round(rate).toLocaleString()}/s</span>
        <span className="font-semibold">⚙️ {Math.floor(saved.gadgets).toLocaleString()}</span>
      </div>
      <Tabs tab={tab} setTab={setTab} earnBadge={coins < 20 ? "!" : undefined} />
      {tab === "earn" ? (
        earn
      ) : (
        <>
          <div className={`relative overflow-hidden rounded-2xl border p-4 ${event?.kind === "surge" ? "border-warn bg-warn/10" : event?.kind === "glitch" ? "border-danger bg-danger/10" : "border-line bg-panel"}`}>
            <div className="flex min-h-24 flex-wrap items-center justify-center gap-1 text-2xl">
              {MACHINES.flatMap((m) => Array.from({ length: Math.min(saved.owned[m.id], 12) }, (_, i) => (
                <span key={`${m.id}${i}`} className={rate > 0 ? "inline-block animate-pulse" : ""}>
                  {m.icon}
                </span>
              )))}
              {baseRate === 0 && <p className="text-sm text-muted">Your factory floor is empty. Buy a machine!</p>}
            </div>
            {event?.kind === "glitch" && (
              <button type="button" onClick={() => (setEvent(null), say("Fixed! Back to full speed."))} className="mt-3 w-full rounded-full bg-danger py-2 font-bold text-white">
                🐛 Fix it!
              </button>
            )}
            {event?.kind === "surge" && <p className="mt-2 text-center text-sm font-bold text-warn">⚡ Power surge: double output!</p>}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {MACHINES.map((m) => {
              const cost = costOf(m.cost, saved.owned[m.id]);
              return (
                <button key={m.id} type="button" onClick={() => buy(m)} disabled={coins < cost} className="flex items-center gap-3 rounded-xl border border-line bg-panel p-3 text-left text-sm disabled:opacity-50">
                  <span className="text-3xl">{m.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {m.name} <span className="text-muted">×{saved.owned[m.id]}</span>
                    </span>
                    <span className="block text-xs text-muted">+{m.rate} gadgets/s</span>
                  </span>
                  <span className="font-semibold">🪙{cost}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      <Toast toast={toast} />
    </div>
  );
}
