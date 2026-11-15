"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** The link that opens a game's join screen with its code already in. */
export const joinLinkFor = (code: string) => (typeof window !== "undefined" ? `${window.location.origin}/live/play/${code}` : `/live/play/${code}`);

/**
 * How players get in without typing the code: a QR code to scan and a link
 * to copy or share. `size` is the QR code's width in pixels.
 */
export function JoinLink({ code, size = 200, compact = false }: { code: string; size?: number; compact?: boolean }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const link = joinLinkFor(code);
  useEffect(() => {
    let live = true;
    // Dark squares on white with a quiet border, so every phone camera reads it (even in dark mode).
    QRCode.toString(link, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } })
      .then((s) => live && setSvg(s))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [link]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className={`flex items-center gap-4 ${compact ? "flex-row" : "flex-col"}`}>
      {svg ? (
        // The SVG comes from the QR library (made from our own link), not from anyone's input.
        <div role="img" aria-label={`QR code to join game ${code}`} className="overflow-hidden rounded-2xl bg-white shadow" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="animate-pulse rounded-2xl bg-foreground/[.06]" style={{ width: size, height: size }} />
      )}
      <div className={`flex flex-col gap-2 ${compact ? "items-start" : "items-center"}`}>
        {!compact && <p className="text-sm font-semibold">📱 scan to join, or use the link</p>}
        <code className="max-w-full break-all rounded-full bg-foreground/[.06] px-3 py-1 text-sm">{link.replace(/^https?:\/\//, "")}</code>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void copy()} className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:bg-accent/10">
            {copied ? "✅ copied!" : "📋 copy link"}
          </button>
          {canShare && (
            <button type="button" onClick={() => void navigator.share({ title: "Join my Jace Live game!", url: link }).catch(() => {})} className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:bg-accent/10">
              📤 share
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
