"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/components/live/fx/sfx";

/** The © line in the footer. Click it enough times and find out. */
export function CopyrightEgg() {
  const [clicks, setClicks] = useState(0);
  const [shown, setShown] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => {
    setClicks(0);
    setShown(Date.now());
    sfx.levelUp();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(null), 4200);
  };
  const click = () => {
    const n = clicks + 1;
    setClicks(n);
    if (n >= 7) show();
    else if (n >= 4) sfx.tap();
  };
  // The admin egg menu can show it too.
  useEffect(() => {
    const onRun = (e: Event) => (e as CustomEvent<string>).detail === "profesenal" && show();
    window.addEventListener("jl-run-egg", onRun);
    return () => window.removeEventListener("jl-run-egg", onRun);
  });
  return (
    <>
      <button type="button" onClick={click} className="select-none text-xs text-muted" style={clicks >= 4 ? { transform: `rotate(${(clicks - 3) * 4}deg) scale(${1 + (clicks - 3) * 0.06})` } : undefined}>
        © {new Date().getFullYear()} Jace
      </button>
      {shown && (
        <div key={shown} role="status" className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center">
          <div className="jl-pop-in rotate-[-4deg] rounded-3xl border-4 border-black bg-yellow-300 px-8 py-6 text-center text-black shadow-[8px_8px_0_#000]">
            <p className="text-6xl">🤓💻</p>
            <p className="mt-2 font-display text-4xl font-extrabold">i profesenal program</p>
            <p className="mt-1 text-sm font-semibold">(dont tell anyone)</p>
          </div>
        </div>
      )}
    </>
  );
}
