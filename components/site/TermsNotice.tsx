"use client";

import { useEffect, useState } from "react";

const JACE = "https://jaceo.vercel.app";
const README = `${JACE}/forums/7b1b592b-ae13-4094-be3c-b18f95d1d347`;
const SEEN_KEY = "jace-live:terms-seen";
const SHOW_MS = 5000;

/**
 * Jace's terms notice, as a little message from Jace in the corner: "By
 * using this app, you agree to the Terms of Service and Privacy Policy".
 * Tapping it opens Jace's READ ME forum. It goes away by itself after 5
 * seconds and never comes back (remembered on this device, and on ur
 * account when signed in).
 */
export function TermsNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {}
    if (seen) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const markSeen = (signedIn: boolean) => {
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {}
      if (signedIn) void fetch("/api/me/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ termsSeen: true }) }).catch(() => {});
    };
    // Signed in: maybe it was already shown on another device.
    fetch("/api/me/prefs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((b: { prefs?: { termsSeen?: boolean } | null } | null) => {
        if (!live) return;
        const signedIn = !!b;
        if (b?.prefs?.termsSeen) return markSeen(false);
        setShow(true);
        markSeen(signedIn);
        timer = setTimeout(() => live && setShow(false), SHOW_MS);
      });
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!show) return null;
  return (
    <div role="status" className="jl-pop-in fixed bottom-4 left-4 z-[90] max-w-xs">
      <a
        href={README}
        target="_blank"
        rel="noopener"
        onClick={() => setShow(false)}
        className="flex items-start gap-2.5 rounded-2xl border border-[#2a2f38] bg-[#1c1f26]/95 px-3.5 py-3 text-xs text-[#e6e8eb] shadow-xl backdrop-blur transition-transform hover:-translate-y-0.5"
      >
        {/* A message from Jace (Jace's own colors, like its notices). */}
        <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#3ddc84] font-display text-sm font-black text-[#0c1410]">
          J
        </span>
        <span>
          <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#3ddc84]">Jace</span>
          By using this app, you agree to the <span className="font-semibold underline decoration-[#3ddc84]/60 underline-offset-2">Terms of Service</span> and{" "}
          <span className="font-semibold underline decoration-[#3ddc84]/60 underline-offset-2">Privacy Policy</span>.
        </span>
      </a>
    </div>
  );
}
