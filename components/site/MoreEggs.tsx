"use client";

import { useEffect } from "react";
import { sfx } from "@/components/live/fx/sfx";

/**
 * Even more easter eggs. Type a magic word anywhere (not in a text box):
 *   barrel roll · flip · gravity · rainbow · dance · pizza · snow · boo ·
 *   cat · jacey · party · help
 * And: poke Jacey 10 times, shake the mouse like crazy, hide the tab, copy
 * some text, double-click empty space, hold the host button, scroll to the
 * very bottom, 11:11, and Fridays.
 */

const egg = (detail: { shout?: string; big?: boolean; say?: string; party?: string[] }) => window.dispatchEvent(new CustomEvent("jl-egg", { detail }));

/** Adds a class to <html> for a while (each one is a CSS animation in globals.css). */
function mode(cls: string, ms: number) {
  const el = document.documentElement;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

/** A one-off thing that walks or falls across the screen. */
function walker(emoji: string, kind: "walk" | "rain", count = 1) {
  for (let i = 0; i < count; i++) {
    const s = document.createElement("span");
    s.textContent = emoji;
    s.setAttribute("aria-hidden", "true");
    s.className = kind === "walk" ? "jl-walker" : "jl-rainer";
    if (kind === "rain") {
      s.style.left = `${Math.random() * 100}vw`;
      s.style.animationDelay = `${Math.random() * 1.5}s`;
      s.style.fontSize = `${22 + Math.random() * 26}px`;
    }
    document.body.appendChild(s);
    s.addEventListener("animationend", () => s.remove());
  }
}

const WORDS: Record<string, () => void> = {
  "barrel roll": () => {
    mode("jl-barrel", 1300);
    egg({ shout: "do a barrel roll!! 🌀" });
    sfx.whoosh();
  },
  flip: () => {
    mode("jl-flip", 4000);
    egg({ say: "uh oh. evrything is upside down 🙃" });
  },
  gravity: () => {
    mode("jl-gravity", 3600);
    egg({ shout: "gravity: ON 🍎" });
    sfx.boom();
  },
  rainbow: () => {
    mode("jl-rainbow", 6000);
    egg({ party: ["🌈", "🦄", "✨"] });
  },
  dance: () => {
    mode("jl-dance", 5000);
    egg({ shout: "💃 DANCE BREAK 🕺", big: true, party: ["💃", "🕺", "🎶"] });
  },
  pizza: () => {
    walker("🍕", "rain", 40);
    egg({ say: "pizza time 🍕🍕🍕" });
  },
  snow: () => {
    walker("❄️", "rain", 60);
    egg({ say: "let it snoooow ⛄" });
  },
  boo: () => {
    mode("jl-boo", 1400);
    walker("👻", "walk");
    egg({ shout: "BOO!! 👻", big: true });
    sfx.alarm();
  },
  cat: () => {
    walker("🐈", "walk");
    egg({ say: "a wild cat appeared 🐈 (it does not care abt u)" });
  },
  jacey: () => {
    mode("jl-big-jacey", 3000);
    egg({ say: "THATS ME!!! 🥹" });
  },
  party: () => egg({ shout: "🎉 party!! 🎉", party: ["🎉", "🎊", "🥳", "🎈"] }),
  help: () =>
    egg({
      say: "psst 🤫 try typing: barrel roll, flip, gravity, rainbow, dance, pizza, snow, boo, cat, jace, jacey… or hold ctrl+p n hit y",
    }),
};

export function MoreEggs() {
  useEffect(() => {
    // Magic words.
    let typed = "";
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      typed = (typed + e.key.toLowerCase()).slice(-16);
      for (const [word, run] of Object.entries(WORDS)) {
        if (typed.endsWith(word)) {
          typed = "";
          run();
          break;
        }
      }
    };

    // Poke Jacey 10 times quickly: Jacey gets mad (then gets over it).
    let pokes: number[] = [];
    const click = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("[aria-label^=Jacey]")) {
        const now = Date.now();
        pokes = [...pokes.filter((x) => now - x < 4000), now];
        if (pokes.length >= 10) {
          pokes = [];
          mode("jl-mad", 2500);
          egg({ say: "STOP POKING ME 😤😤" });
          setTimeout(() => egg({ say: "ok im over it. hi again 🥰" }), 3000);
        }
      }
    };

    // Shake the mouse back and forth like crazy.
    let flips: number[] = [];
    let lastDx = 0;
    let lastX = 0;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      if (Math.abs(dx) > 25 && Math.sign(dx) !== Math.sign(lastDx)) {
        const now = Date.now();
        flips = [...flips.filter((x) => now - x < 1200), now];
        if (flips.length >= 9) {
          flips = [];
          mode("jl-dizzy", 2000);
          egg({ say: "whoa whoa im dizzy 😵‍💫" });
        }
      }
      if (Math.abs(dx) > 25) lastDx = dx;
    };

    // Leaving the tab.
    let realTitle = document.title;
    const vis = () => {
      if (document.visibilityState === "hidden") {
        realTitle = document.title;
        document.title = "come back 🥺";
      } else if (document.title === "come back 🥺") {
        document.title = "yay ur back!! 🎉";
        setTimeout(() => (document.title = realTitle), 1800);
      }
    };

    // Copying text.
    const copy = () => egg({ say: "copying my homework?? 👀 (its fine)" });

    // Double-click empty space: confetti from the theme.
    const dbl = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && !t.closest("a,button,input,textarea,select,canvas,[role=button]")) egg({ party: ["✨", "⭐", "💫"] });
    };

    // Hold the host button for 2 seconds.
    let hold: ReturnType<typeof setTimeout> | null = null;
    const down = (e: PointerEvent) => {
      const a = (e.target as HTMLElement | null)?.closest("a[href='/live/host/new']");
      if (a) hold = setTimeout(() => egg({ say: "ur committed. i respect that 🫡" }), 2000);
    };
    const up = () => {
      if (hold) clearTimeout(hold);
      hold = null;
    };

    // Scrolling to the very bottom a few times.
    let bottoms = 0;
    let atBottom = false;
    const scroll = () => {
      const end = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (end && !atBottom && ++bottoms === 3) egg({ say: "ur at the bottom. theres nothing down here. except me 👋" });
      atBottom = end;
    };

    // 11:11 and Fridays.
    const special = setTimeout(() => {
      const d = new Date();
      if (d.getHours() % 12 === 11 && d.getMinutes() === 11) egg({ shout: "11:11 make a wish ✨", party: ["✨", "🌠"] });
      else if (d.getDay() === 5 && Math.random() < 0.4) egg({ say: "its FRIDAY!!! 🎉 u kno what that means. (nothing. host a game tho)" });
    }, 9000);

    window.addEventListener("keydown", key);
    document.addEventListener("click", click);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("visibilitychange", vis);
    document.addEventListener("copy", copy);
    document.addEventListener("dblclick", dbl);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      clearTimeout(special);
      window.removeEventListener("keydown", key);
      document.removeEventListener("click", click);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("visibilitychange", vis);
      document.removeEventListener("copy", copy);
      document.removeEventListener("dblclick", dbl);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("scroll", scroll);
    };
  }, []);
  return null;
}
