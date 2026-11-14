"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/components/live/fx/sfx";

/**
 * Jacey (the little blob in the corner) and a pile of easter eggs:
 * - first visit: Jacey says hi (with confetti)
 * - click Jacey: random nonsense
 * - Ctrl + P + Y (hold Ctrl and P, tap Y): PARTY MODE
 * - type "jace" anywhere: JACE MODE
 * - click the logo a bunch: it spins
 * - triple-click the LIVE badge: LIVEEEE
 * - click the garland: it jumps
 * - go quiet for a while: Jacey checks on you
 * - after midnight: Jacey says go to bed
 * None of it gets in the way: it ignores typing in boxes and never blocks clicks.
 */

const SEEN_KEY = "jace-live:jacey-seen";
const HIDE_KEY = "jace-live:jacey-hidden";

const NONSENSE = [
  "hiii 👋 im jacey!!",
  "did u kno u can pop the falling stuff? try it 🍂",
  "fun fact: i have no bones 🫠",
  "host a game!! pls!! i get lonley",
  "i ate a quiz once. it was a lil hard to swallow",
  "hold ctrl n P then hit Y 👀🪩",
  "ur doing amazing sweetie 💖",
  "type j-a-c-e anywhere. nothing will happen. (something will happen)",
  "brb thinking abt pizza 🍕",
  "click the © at the bottom like 7 times. trust",
  "i promise im not a virus 🦠 jk im a blob",
  "the LIVE thing at the top? triple click it. do it",
  "wat if questons answered u 🤯",
  "beep boop. sorry wrong website",
  "ur my fav player (dont tell the others)",
];

type Bubble = { id: number; text: string };
type Toast = { id: number; text: string; big?: boolean };

export function EasterEggs() {
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [confetti, setConfetti] = useState<{ id: number; emoji: string[] } | null>(null);
  const [hidden, setHidden] = useState(false);
  const [bounce, setBounce] = useState(0);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = (text: string, ms = 5000) => {
    setBubble({ id: Date.now(), text });
    setBounce((b) => b + 1);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), ms);
  };
  const shout = (text: string, big = false) => {
    setToast({ id: Date.now(), text, big });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };
  const party = (emoji: string[]) => setConfetti({ id: Date.now(), emoji });

  // Hi on the first visit; Jacey's hide/show is remembered.
  useEffect(() => {
    let seen = true;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(localStorage.getItem(HIDE_KEY) === "1");
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    const t = setTimeout(() => {
      if (!seen) {
        say("heyyy welcome to jace live!! 🎉 im jacey. click stuff, things happen 👀", 8000);
        party(["🎉", "🎊", "✨", "💖"]);
      } else {
        const h = new Date().getHours();
        if (h >= 0 && h < 4) say(`its ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}... go to sleep 😴 (jk play one more)`, 7000);
      }
    }, 1200);
    // A hello for the devs.
    console.log("%chi dev 👋 i profesenal program. (jacey says hi too)", "font-size:16px;font-weight:800;color:#f97316");
    return () => clearTimeout(t);
  }, []);

  // Other eggs (MoreEggs.tsx) ask for a shout, a Jacey line or confetti with a "jl-egg" event.
  useEffect(() => {
    const onEgg = (e: Event) => {
      const d = (e as CustomEvent<{ shout?: string; big?: boolean; say?: string; party?: string[] }>).detail ?? {};
      if (d.shout) shout(d.shout, d.big);
      if (d.say) say(d.say);
      if (d.party) party(d.party);
    };
    window.addEventListener("jl-egg", onEgg);
    return () => window.removeEventListener("jl-egg", onEgg);
  }, []);

  // Ctrl+P+Y, typing "jace", and checking in when it's quiet.
  useEffect(() => {
    let pHeld = false;
    let typed = "";
    let idle: ReturnType<typeof setTimeout>;
    const resetIdle = () => {
      clearTimeout(idle);
      idle = setTimeout(() => say("u still there? 👀"), 90_000);
    };
    const key = (e: KeyboardEvent) => {
      resetIdle();
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      // Hold Ctrl and P (that would normally print, so it's caught here), then press Y.
      if ((e.ctrlKey || e.metaKey) && k === "p") {
        e.preventDefault();
        pHeld = true;
        return;
      }
      if ((e.ctrlKey || e.metaKey) && k === "y" && pHeld) {
        e.preventDefault();
        pHeld = false;
        document.documentElement.classList.add("jl-party");
        setTimeout(() => document.documentElement.classList.remove("jl-party"), 9000);
        shout("🪩 PARTY MODE 🪩", true);
        party(["🪩", "🎉", "🌈", "🕺", "💃", "✨"]);
        sfx.levelUp();
        setTimeout(() => sfx.levelUp(), 350);
      }
      if (e.key.length === 1) {
        typed = (typed + e.key.toLowerCase()).slice(-4);
        if (typed === "jace") {
          document.documentElement.classList.add("jl-jace");
          setTimeout(() => document.documentElement.classList.remove("jl-jace"), 4000);
          shout("😎 JACE MODE ACTIVATED 😎", true);
          party(["😎", "🔥", "💯"]);
          sfx.cash();
        }
      }
    };
    const keyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "p" || e.key === "Control" || e.key === "Meta") pHeld = false;
    };
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("pointermove", resetIdle, { passive: true });
    resetIdle();
    return () => {
      clearTimeout(idle);
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("pointermove", resetIdle);
    };
  }, []);

  // Clicks on the logo, the LIVE badge and the garland.
  useEffect(() => {
    let logo: number[] = [];
    let badge: number[] = [];
    const click = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const now = Date.now();
      if (t.closest("[data-egg=logo]")) {
        logo = [...logo.filter((x) => now - x < 3000), now];
        if (logo.length === 5) {
          const el = t.closest("[data-egg=logo]") as HTMLElement;
          el.style.animation = "none";
          void el.offsetWidth;
          el.style.animation = "jl-spin 0.9s ease-in-out";
          shout("wheeee 🌀");
          sfx.whoosh();
        }
        if (logo.length >= 10) {
          logo = [];
          say("ok ur gonna break it 😭 stop");
        }
      }
      if (t.closest("[data-egg=live]")) {
        badge = [...badge.filter((x) => now - x < 800), now];
        if (badge.length >= 3) {
          badge = [];
          shout("📣 LIVEEEEEEEEEE 📣", true);
          party(["📣", "🔴", "⚡"]);
          sfx.go();
        }
      }
      const g = t.closest("[data-egg=garland]") as HTMLElement | null;
      if (g) {
        g.style.animation = "none";
        void g.offsetWidth;
        g.style.animation = "jl-jump 0.6s ease-out";
        sfx.coin();
      }
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);

  // Not in the middle of a game (Jacey would sit on the controls).
  const pathname = usePathname();
  const inGame = pathname.startsWith("/live/play/") || (pathname.startsWith("/live/host/") && pathname !== "/live/host/new");

  const hide = (h: boolean) => {
    setHidden(h);
    try {
      localStorage.setItem(HIDE_KEY, h ? "1" : "0");
    } catch {}
  };

  return (
    <>
      {confetti && (
        <div key={`confetti-${confetti.id}`} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[85] overflow-hidden" onAnimationEnd={(e) => e.target === e.currentTarget.lastChild && setConfetti(null)}>
          {Array.from({ length: 46 }, (_, i) => (
            <span
              key={i}
              className="jl-confetti absolute top-[-40px] text-2xl"
              style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 12) * 0.08}s`, animationDuration: `${2.2 + (i % 5) * 0.35}s` }}
            >
              {confetti.emoji[i % confetti.emoji.length]}
            </span>
          ))}
        </div>
      )}
      {toast && (
        <div key={`toast-${toast.id}`} role="status" className="pointer-events-none fixed inset-x-0 top-24 z-[86] flex justify-center px-4">
          <p className={`jl-pop-in rotate-[-2deg] rounded-2xl border-4 border-black bg-yellow-300 px-6 py-3 font-display font-extrabold text-black shadow-[6px_6px_0_#000] ${toast.big ? "text-3xl sm:text-5xl" : "text-xl"}`}>
            {toast.text}
          </p>
        </div>
      )}
      {/* Jacey. */}
      <div className={`fixed bottom-3 left-3 z-[60] flex items-end gap-2 ${inGame ? "hidden" : ""}`}>
        {hidden ? (
          <button type="button" onClick={() => hide(false)} aria-label="Bring Jacey back" title="bring jacey back" className="h-8 w-8 rounded-full bg-accent/80 text-sm text-white shadow-md hover:scale-110">
            👋
          </button>
        ) : (
          <>
            <button
              key={bounce}
              type="button"
              onClick={() => {
                say(NONSENSE[Math.floor(Math.random() * NONSENSE.length)]);
                sfx.tap();
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                hide(true);
              }}
              aria-label="Jacey, the Jace Live blob. Click for nonsense."
              title="jacey (right-click to hide)"
              className="jl-jacey relative h-14 w-14 shrink-0 hover:scale-110"
            >
              <svg viewBox="0 0 64 64" className="h-full w-full drop-shadow-lg" aria-hidden="true">
                <path d="M32 6c14 0 26 10 26 26 0 15-10 26-26 26S6 47 6 32 18 6 32 6z" fill="var(--accent)" />
                <ellipse cx="22" cy="20" rx="7" ry="4" fill="#fff" opacity="0.35" transform="rotate(-25 22 20)" />
                <circle cx="24" cy="30" r="5" fill="#fff" />
                <circle cx="40" cy="30" r="5" fill="#fff" />
                <circle className="jl-eye" cx="25" cy="31" r="2.6" fill="#111" />
                <circle className="jl-eye" cx="41" cy="31" r="2.6" fill="#111" />
                <path d="M24 41c4 5 12 5 16 0" stroke="#111" strokeWidth="3" fill="none" strokeLinecap="round" />
                <circle cx="17" cy="38" r="3.5" fill="#fb7185" opacity="0.55" />
                <circle cx="47" cy="38" r="3.5" fill="#fb7185" opacity="0.55" />
              </svg>
            </button>
            {bubble && (
              <p key={bubble.id} className="jl-pop-in mb-6 max-w-[16rem] rounded-2xl rounded-bl-none border-2 border-line bg-panel px-3 py-2 text-sm font-semibold shadow-lg">
                {bubble.text}
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
