"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Tabs, Toast, useReport, useSaved, type PartyProps } from "./shared";

/**
 * Snack Shack: right answers bring in food (one unit per serving). Hungry
 * customers line up with an order and a patience bar; tap them to serve
 * before they walk out. Spend cash on upgrades; your score is all the cash
 * you've ever taken in.
 */

const MENU = [
  { icon: "🍟", name: "Fries", price: 3, unlock: 0 },
  { icon: "🍔", name: "Burger", price: 5, unlock: 0 },
  { icon: "🥤", name: "Soda", price: 2, unlock: 0 },
  { icon: "🍦", name: "Cone", price: 4, unlock: 60 },
  { icon: "🍕", name: "Pizza", price: 7, unlock: 150 },
  { icon: "🌮", name: "Taco", price: 6, unlock: 300 },
];
const FACES = ["🧑", "👩", "👨", "🧒", "👵", "👴", "🧔", "👩‍🦰", "🧑‍🎤", "🧑‍🚀", "🥷", "🤠"];

const UPGRADES = {
  recipe: { icon: "📖", name: "Secret recipes", desc: "+25% on every sale", base: 40, max: 3 },
  chairs: { icon: "🪑", name: "Comfy chairs", desc: "Customers wait 30% longer", base: 30, max: 3 },
  grill: { icon: "🔥", name: "Speedy grill", desc: "Serves someone by itself every few seconds", base: 80, max: 3 },
} as const;
type UpgradeId = keyof typeof UPGRADES;

type Customer = { id: number; face: string; item: number; arrived: number; patience: number };
type Saved = { used: number; cash: number; earned: number; levels: Record<UpgradeId, number>; unlocked: number };

const upgradeCost = (id: UpgradeId, level: number) => Math.round(UPGRADES[id].base * 2.2 ** level);

export function SnackShack({ view, act, earn }: PartyProps) {
  const [tab, setTab] = useState<"play" | "earn">("earn");
  const [saved, save] = useSaved<Saved>(view.code, "snack", () => ({ used: 0, cash: 0, earned: 0, levels: { recipe: 0, chairs: 0, grill: 0 }, unlocked: 3 }));
  const [queue, setQueue] = useState<Customer[]>([]);
  const [now, setNow] = useState(0);
  const [toast, setToast] = useState<{ text: string; good: boolean; id: number } | null>(null);
  const nextId = useRef(0);
  const savedRef = useRef(saved);
  useEffect(() => {
    savedRef.current = saved;
  }, [saved]);

  const food = Math.max(0, (view.party.bank ?? 0) - saved.used);
  useReport(act, saved.earned);

  const toastId = useRef(0);
  const say = useCallback((text: string, good = true) => setToast({ text, good, id: ++toastId.current }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(t);
  }, [toast]);

  const foodRef = useRef(food);
  useEffect(() => {
    foodRef.current = food;
  }, [food]);
  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  /** Serves one customer if there's food: cash (plus a tip for quick service) and one less food. */
  const serveCustomer = useCallback(
    (c: Customer, auto = false) => {
      if (foodRef.current <= 0) {
        if (!auto) say("Out of food! Answer questions to restock.", false);
        return false;
      }
      const s = savedRef.current;
      const waited = (performance.now() - c.arrived) / c.patience;
      const tip = waited < 0.35 ? 2 : 0;
      const price = Math.round(MENU[c.item].price * (1 + 0.25 * s.levels.recipe)) + tip;
      foodRef.current -= 1;
      save((cur) => ({ ...cur, used: cur.used + 1, cash: cur.cash + price, earned: cur.earned + price }));
      if (!auto) say(`+$${price}${tip ? " (fast tip!)" : ""}`);
      return true;
    },
    [save, say],
  );

  // Customers arrive, wait, and leave; the grill serves on its own.
  useEffect(() => {
    let arrive = 0;
    let grill = 0;
    let last = performance.now();
    const t = setInterval(() => {
      const n = performance.now();
      const dt = (n - last) / 1000;
      last = n;
      arrive -= dt;
      grill -= dt;
      const s = savedRef.current;
      let next = queueRef.current.filter((c) => n - c.arrived < c.patience);
      if (arrive <= 0 && next.length < 5) {
        arrive = 1.8 + Math.random() * 2.2;
        const items = MENU.filter((m) => s.earned >= m.unlock).length;
        next = [
          ...next,
          { id: nextId.current++, face: FACES[Math.floor(Math.random() * FACES.length)], item: Math.floor(Math.random() * items), arrived: n, patience: (8000 + Math.random() * 5000) * (1 + 0.3 * s.levels.chairs) },
        ];
      }
      if (s.levels.grill > 0 && grill <= 0) {
        grill = 6 / s.levels.grill;
        if (next.length && serveCustomer(next[0], true)) next = next.slice(1);
      }
      queueRef.current = next;
      setQueue(next);
      setNow(n);
    }, 200);
    return () => clearInterval(t);
  }, [serveCustomer]);

  const serve = (c: Customer) => {
    if (serveCustomer(c)) setQueue((q) => q.filter((x) => x.id !== c.id));
  };

  const buy = (id: UpgradeId) => {
    const lvl = saved.levels[id];
    if (lvl >= UPGRADES[id].max) return;
    const cost = upgradeCost(id, lvl);
    if (saved.cash < cost) return say("Not enough cash yet.", false);
    save((cur) => ({ ...cur, cash: cur.cash - cost, levels: { ...cur.levels, [id]: lvl + 1 } }));
    say(`${UPGRADES[id].name} upgraded!`);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-xl bg-panel px-4 py-2 text-sm">
        <span>🥫 {food} food</span>
        <span>💵 ${saved.cash}</span>
        <span className="font-semibold">Earned ${saved.earned}</span>
      </div>
      <Tabs tab={tab} setTab={setTab} earnBadge={food < 3 ? "!" : undefined} />
      {tab === "earn" ? (
        earn
      ) : (
        <>
          <div className="rounded-2xl border border-line bg-[#7c4a2d] p-3">
            <p className="mb-2 text-center text-xs font-bold tracking-widest text-amber-100">🍔 SNACK SHACK 🍔</p>
            <div className="grid min-h-40 grid-cols-3 gap-2 sm:grid-cols-5">
              {queue.map((c) => {
                const left = Math.max(0, 1 - (now - c.arrived) / c.patience);
                return (
                  <button key={c.id} type="button" onClick={() => serve(c)} className="animate-pop flex flex-col items-center gap-1 rounded-xl bg-amber-50 p-2 text-neutral-900 active:scale-95" aria-label={`Serve ${MENU[c.item].name}`}>
                    <span className="text-3xl">{c.face}</span>
                    <span className="rounded-full bg-white px-2 text-lg shadow">{MENU[c.item].icon}</span>
                    <span className="h-1.5 w-full rounded-full bg-neutral-300">
                      <span className="block h-full rounded-full" style={{ width: `${left * 100}%`, background: left > 0.5 ? "#26a269" : left > 0.25 ? "#e2a500" : "#e5484d" }} />
                    </span>
                  </button>
                );
              })}
              {queue.length === 0 && <p className="col-span-full self-center text-center text-sm text-amber-100">No customers yet…</p>}
            </div>
          </div>
          <p className="text-center text-xs text-muted">Tap a customer to serve them. Quick service earns tips.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(UPGRADES) as UpgradeId[]).map((id) => {
              const u = UPGRADES[id];
              const lvl = saved.levels[id];
              const maxed = lvl >= u.max;
              return (
                <button key={id} type="button" disabled={maxed} onClick={() => buy(id)} className="flex flex-col items-start rounded-xl border border-line bg-panel p-3 text-left text-sm disabled:opacity-60">
                  <span className="font-semibold">
                    {u.icon} {u.name} {"★".repeat(lvl)}
                  </span>
                  <span className="text-xs text-muted">{u.desc}</span>
                  <span className="mt-1 text-xs font-semibold">{maxed ? "Maxed" : `$${upgradeCost(id, lvl)}`}</span>
                </button>
              );
            })}
          </div>
          <p className="text-center text-xs text-muted">
            Menu: {MENU.map((m) => (saved.earned >= m.unlock ? m.icon : "🔒")).join(" ")} (new items unlock as you earn)
          </p>
        </>
      )}
      <Toast toast={toast} />
    </div>
  );
}
