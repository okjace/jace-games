"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Our own "are you sure?" popup, instead of the browser's confirm() (which
 * freezes or hides behind fullscreen games). `await ask("End the game?")`
 * gives true or false. <ConfirmHost/> (in the layout) shows it, inside the
 * fullscreen element when something is fullscreen.
 */

type Ask = { id: number; message: string; yes: string; no: string; danger: boolean; resolve: (ok: boolean) => void; target?: HTMLElement };
let show: ((a: Ask) => void) | null = null;

export function ask(message: string, opts: { yes?: string; no?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    // Before the host mounts (it always does in the layout), fall back to the browser's.
    if (!show) return resolve(window.confirm(message));
    show({ id: Date.now(), message, yes: opts.yes ?? "yep", no: opts.no ?? "nvm", danger: opts.danger ?? true, resolve });
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState<Ask | null>(null);
  const yesRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // It goes inside the fullscreen element if there is one, or it wouldn't show.
    show = (a) => setReq((cur) => (cur && cur.resolve(false), { ...a, target: (document.fullscreenElement as HTMLElement | null) ?? document.body }));
    return () => {
      show = null;
    };
  }, []);
  useEffect(() => {
    if (!req) return;
    yesRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      req.resolve(false);
      setReq(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [req]);
  const answer = (ok: boolean) => {
    req?.resolve(ok);
    setReq(null);
  };
  if (!req?.target) return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={req.message} className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onPointerDown={(e) => e.target === e.currentTarget && answer(false)}>
      <div className="jl-pop-in flex w-full max-w-sm flex-col gap-4 rounded-3xl border-4 border-black bg-panel p-6 text-center text-foreground shadow-[8px_8px_0_#000]">
        <p className="text-5xl" aria-hidden="true">
          {req.danger ? "😬" : "🤔"}
        </p>
        <p className="font-display text-xl font-extrabold">{req.message}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => answer(false)} className="h-12 flex-1 rounded-full border-2 border-line bg-panel font-bold hover:bg-foreground/[.05]">
            {req.no}
          </button>
          <button
            ref={yesRef}
            type="button"
            onClick={() => answer(true)}
            className={`h-12 flex-1 rounded-full font-black text-white shadow-[0_4px_0_rgba(0,0,0,0.3)] active:translate-y-1 active:shadow-none ${req.danger ? "bg-red-500" : "bg-accent"}`}
          >
            {req.yes}
          </button>
        </div>
      </div>
    </div>,
    req.target,
  );
}
