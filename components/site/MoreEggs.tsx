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
function walker(emoji: string, kind: "walk" | "walk-high" | "rain" | "rise" | "launch", count = 1) {
  for (let i = 0; i < count; i++) {
    const s = document.createElement("span");
    s.textContent = emoji;
    s.setAttribute("aria-hidden", "true");
    s.className = { walk: "jl-walker", "walk-high": "jl-walker jl-walker-high", rain: "jl-rainer", rise: "jl-riser", launch: "jl-launcher" }[kind];
    if (kind === "rain" || kind === "rise") {
      s.style.left = `${Math.random() * 100}vw`;
      s.style.animationDelay = `${Math.random() * 1.5}s`;
      s.style.fontSize = `${22 + Math.random() * 26}px`;
    }
    document.body.appendChild(s);
    s.addEventListener("animationend", () => s.remove());
  }
}

/** A green "code rain" over the page for a few seconds. */
function matrix() {
  const c = document.createElement("canvas");
  c.className = "jl-matrix";
  c.setAttribute("aria-hidden", "true");
  document.body.appendChild(c);
  const w = (c.width = window.innerWidth);
  const h = (c.height = window.innerHeight);
  const ctx = c.getContext("2d")!;
  const cols = Math.floor(w / 16);
  const drops = Array.from({ length: cols }, () => Math.random() * -40);
  const start = performance.now();
  const frame = (now: number) => {
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#22c55e";
    ctx.font = "15px monospace";
    drops.forEach((y, i) => {
      ctx.fillText("JACELIVE01ジャース"[Math.floor(Math.random() * 15)], i * 16, y * 16);
      drops[i] = y * 16 > h && Math.random() > 0.96 ? 0 : y + 1;
    });
    if (now - start < 5000) requestAnimationFrame(frame);
    else c.remove();
  };
  requestAnimationFrame(frame);
}

export type Egg = { id: string; name: string; how: string; run: () => void };

/** Every easter egg, with how to find it. The admin egg menu (EggMenu) can run any of them. */
export const EGGS: Egg[] = [
  { id: "party", name: "🪩 party mode", how: "hold ctrl + P, then press Y", run: () => window.dispatchEvent(new CustomEvent("jl-run-egg", { detail: "party mode" })) },
  { id: "jace", name: "😎 jace mode", how: "type jace", run: () => window.dispatchEvent(new CustomEvent("jl-run-egg", { detail: "jace mode" })) },
  { id: "pro", name: "🤓 i profesenal program", how: "click the © at the bottom 7 times", run: () => window.dispatchEvent(new CustomEvent("jl-run-egg", { detail: "profesenal" })) },
  {
    id: "barrel",
    name: "🌀 barrel roll",
    how: "type barrel roll",
    run: () => {
      mode("jl-barrel", 1300);
      egg({ shout: "do a barrel roll!! 🌀" });
      sfx.whoosh();
    },
  },
  {
    id: "flip",
    name: "🙃 flip",
    how: "type flip",
    run: () => {
      mode("jl-flip", 4000);
      egg({ say: "uh oh. evrything is upside down 🙃" });
    },
  },
  {
    id: "gravity",
    name: "🍎 gravity",
    how: "type gravity",
    run: () => {
      mode("jl-gravity", 3600);
      egg({ shout: "gravity: ON 🍎" });
      sfx.boom();
    },
  },
  { id: "rainbow", name: "🌈 rainbow", how: "type rainbow", run: () => (mode("jl-rainbow", 6000), egg({ party: ["🌈", "🦄", "✨"] })) },
  { id: "dance", name: "💃 dance break", how: "type dance", run: () => (mode("jl-dance", 5000), egg({ shout: "💃 DANCE BREAK 🕺", big: true, party: ["💃", "🕺", "🎶"] })) },
  { id: "pizza", name: "🍕 pizza rain", how: "type pizza", run: () => (walker("🍕", "rain", 40), egg({ say: "pizza time 🍕🍕🍕" })) },
  { id: "snow", name: "❄️ snowstorm", how: "type snow", run: () => (walker("❄️", "rain", 60), egg({ say: "let it snoooow ⛄" })) },
  {
    id: "boo",
    name: "👻 boo",
    how: "type boo",
    run: () => {
      mode("jl-boo", 1400);
      walker("👻", "walk");
      egg({ shout: "BOO!! 👻", big: true });
      sfx.alarm();
    },
  },
  { id: "cat", name: "🐈 a cat", how: "type cat", run: () => (walker("🐈", "walk"), egg({ say: "a wild cat appeared 🐈 (it does not care abt u)" })) },
  { id: "jacey", name: "🥹 giant jacey", how: "type jacey", run: () => (mode("jl-big-jacey", 3000), egg({ say: "THATS ME!!! 🥹" })) },
  { id: "partyword", name: "🎉 party", how: "type party", run: () => egg({ shout: "🎉 party!! 🎉", party: ["🎉", "🎊", "🥳", "🎈"] }) },
  {
    id: "disco",
    name: "🕺 disco",
    how: "type disco",
    run: () => {
      mode("jl-disco", 6000);
      egg({ shout: "🪩 DISCO 🪩", big: true });
      sfx.levelUp();
    },
  },
  { id: "matrix", name: "🟩 the matrix", how: "type matrix", run: () => (matrix(), egg({ say: "there is no spoon 🥄" })) },
  { id: "bubbles", name: "🫧 bubbles", how: "type bubbles", run: () => (walker("🫧", "rise", 45), egg({ say: "blub blub 🫧" })) },
  { id: "zoom", name: "🔍 zoom", how: "type zoom", run: () => (mode("jl-zoom", 2400), egg({ say: "ZOOOOM 🔍" })) },
  { id: "tiny", name: "🐜 tiny", how: "type tiny", run: () => (mode("jl-tiny", 4000), egg({ say: "evrything is so smol 🐜" })) },
  { id: "money", name: "💸 money rain", how: "type money", run: () => (walker("💸", "rain", 40), egg({ say: "we rich now 💸 (we r not)" }), sfx.cash()) },
  {
    id: "lava",
    name: "🌋 the floor is lava",
    how: "type lava",
    run: () => {
      mode("jl-lava", 5000);
      egg({ shout: "THE FLOOR IS LAVA 🌋", big: true });
      mode("jl-big-jacey", 1200);
    },
  },
  { id: "sleep", name: "😴 sleepy", how: "type sleep", run: () => (mode("jl-sleep", 5000), egg({ say: "zzz… 😴 (wake me up when its game time)" })) },
  { id: "hello", name: "👋 hello", how: "type hello", run: () => egg({ say: "HIIII 👋👋 hello to u too!!" }) },
  { id: "42", name: "🌌 42", how: "type 42", run: () => egg({ say: "42. the answer to life, the universe n evrything 🌌" }) },
  { id: "rocket", name: "🚀 rocket", how: "type rocket", run: () => (walker("🚀", "launch"), egg({ say: "3… 2… 1… liftoff 🚀" }), sfx.whoosh()) },
  {
    id: "ufo",
    name: "🛸 ufo",
    how: "type ufo",
    run: () => {
      walker("🛸", "walk-high");
      mode("jl-abduct", 3000);
      egg({ say: "HELP THEYRE TAKING ME 🛸😱" });
    },
  },
  { id: "spin", name: "🔄 spin", how: "type spin", run: () => (mode("jl-spin-cards", 1600), sfx.whoosh()) },
  { id: "uwu", name: "🥺 uwu", how: "type uwu", run: () => (walker("💕", "rise", 30), egg({ say: "uwu 🥺👉👈" })) },
  { id: "konami", name: "🕹️ old school", how: "↑ ↑ ↓ ↓ ← → ← → B A", run: () => egg({ shout: "🕹️ +30 LIVES (not rly)", big: true, party: ["🕹️", "👾", "⭐"] }) },
  { id: "escape", name: "😈 no escape", how: "press Escape 5 times fast", run: () => (mode("jl-boo", 900), egg({ say: "there is no escape 😈" })) },
  { id: "squish", name: "🫠 stop squishing", how: "resize the window a bunch", run: () => egg({ say: "stop squishing me 🫠" }) },
  { id: "realone", name: "💎 ur a real one", how: "stay on the site for 10 minutes", run: () => egg({ shout: "💎 achievement: ur a real one", party: ["💎", "✨"] }) },
  { id: "backflip", name: "🤸 jacey backflip", how: "shift + click Jacey", run: () => (mode("jl-backflip", 900), egg({ say: "did u see that?? 🤸" })) },
  { id: "makeup", name: "😂 make up ur mind", how: "click the theme effects button 10 times fast", run: () => egg({ say: "make up ur mind 😂" }) },
  { id: "mad", name: "😤 mad jacey", how: "click Jacey 10 times fast", run: () => (mode("jl-mad", 2500), egg({ say: "STOP POKING ME 😤😤" })) },
  { id: "dizzy", name: "😵‍💫 dizzy", how: "shake ur mouse left n right like crazy", run: () => (mode("jl-dizzy", 2000), egg({ say: "whoa whoa im dizzy 😵‍💫" })) },
  { id: "help", name: "🤫 hints", how: "type help", run: () => egg({ say: "psst 🤫 try typing: barrel roll, flip, gravity, rainbow, dance, pizza, snow, boo, cat, disco, matrix, lava, ufo, uwu… or hold ctrl+p n hit y" }) },
];

/** Typed words that set off an egg (the egg's id, unless it's different). */
const WORDS: Record<string, string> = {
  "barrel roll": "barrel",
  flip: "flip",
  gravity: "gravity",
  rainbow: "rainbow",
  dance: "dance",
  pizza: "pizza",
  snow: "snow",
  boo: "boo",
  cat: "cat",
  jacey: "jacey",
  party: "partyword",
  disco: "disco",
  matrix: "matrix",
  bubbles: "bubbles",
  zoom: "zoom",
  tiny: "tiny",
  money: "money",
  lava: "lava",
  sleep: "sleep",
  hello: "hello",
  "42": "42",
  rocket: "rocket",
  ufo: "ufo",
  spin: "spin",
  uwu: "uwu",
  help: "help",
};
const run = (id: string) => EGGS.find((e) => e.id === id)?.run();

export function MoreEggs() {
  useEffect(() => {
    // Magic words, the Konami code and mashing Escape.
    let typed = "";
    const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
    let kpos = 0;
    let escapes: number[] = [];
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      kpos = k === KONAMI[kpos] ? kpos + 1 : k === KONAMI[0] ? 1 : 0;
      if (kpos === KONAMI.length) {
        kpos = 0;
        run("konami");
      }
      if (e.key === "Escape") {
        const now = Date.now();
        escapes = [...escapes.filter((x) => now - x < 2000), now];
        if (escapes.length >= 5) {
          escapes = [];
          run("escape");
        }
      }
      if (e.key.length !== 1) return;
      typed = (typed + e.key.toLowerCase()).slice(-16);
      for (const [word, id] of Object.entries(WORDS)) {
        if (typed.endsWith(word)) {
          typed = "";
          run(id);
          break;
        }
      }
    };

    // Poke Jacey 10 times quickly: Jacey gets mad (then gets over it).
    let pokes: number[] = [];
    let flicks: number[] = [];
    const click = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("[aria-label^=Jacey]") && e.shiftKey) {
        run("backflip");
        return;
      }
      // Flicking the theme effects button on and off.
      if (t?.closest("[aria-label*=effects]")) {
        const now = Date.now();
        flicks = [...flicks.filter((x) => now - x < 4000), now];
        if (flicks.length >= 10) {
          flicks = [];
          run("makeup");
        }
      }
      if (t?.closest("[aria-label^=Jacey]")) {
        const now = Date.now();
        pokes = [...pokes.filter((x) => now - x < 4000), now];
        if (pokes.length >= 10) {
          pokes = [];
          run("mad");
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
          run("dizzy");
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

    // Squishing the window around.
    let resizes: number[] = [];
    const resize = () => {
      const now = Date.now();
      if (now - (resizes[resizes.length - 1] ?? 0) < 300) return;
      resizes = [...resizes.filter((x) => now - x < 6000), now];
      if (resizes.length >= 8) {
        resizes = [];
        run("squish");
      }
    };
    // Hanging around for 10 minutes.
    const realOne = setTimeout(() => run("realone"), 10 * 60_000);
    // The admin egg menu (and other parts of the site) can run any egg by id.
    const runEgg = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (typeof id === "string" && !["party mode", "jace mode", "profesenal"].includes(id)) run(id);
    };

    window.addEventListener("resize", resize);
    window.addEventListener("jl-run-egg", runEgg);
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
      clearTimeout(realOne);
      window.removeEventListener("resize", resize);
      window.removeEventListener("jl-run-egg", runEgg);
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
