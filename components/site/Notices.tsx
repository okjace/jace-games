"use client";

import { useScores } from "@/components/ScoresProvider";

/** Sign-in errors (e.g. a banned account) and the offer to upload signed-out scores. */
export function Notices() {
  const { notice, dismissNotice, showUploadOffer, anonymousCount, uploadAnonymous, declineUpload } = useScores();
  if (!notice && !showUploadOffer) return null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pt-4 sm:px-6">
      {notice && (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${
            notice.kind === "error" ? "border-danger/40 bg-danger/10 text-danger" : "border-line bg-panel"
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={dismissNotice}
            aria-label="Dismiss"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-foreground/[.08]"
          >
            ✕
          </button>
        </div>
      )}
      {showUploadOffer && (
        <div className="flex flex-col gap-3 rounded-2xl border border-accent/40 bg-accent/[.07] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            You have <strong>{anonymousCount}</strong> score{anonymousCount === 1 ? "" : "s"} on this device from
            playing signed out. Add {anonymousCount === 1 ? "it" : "them"} to your Jace account?
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={uploadAnonymous}
              className="h-9 rounded-full bg-accent px-4 font-medium text-on-accent transition-colors hover:bg-accent-hover"
            >
              Upload scores
            </button>
            <button
              type="button"
              onClick={declineUpload}
              className="h-9 rounded-full border border-line px-4 font-medium transition-colors hover:bg-foreground/[.05]"
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
