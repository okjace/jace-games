"use client";

import type { PartyProps } from "./shared";

/**
 * Code Breakers: pick a secret password, answer to mine bits, and every few
 * right answers try to crack a rival's password (one of three guesses) to
 * steal some of their bits. Whether a guess is right is decided on the
 * server; the real password never reaches anyone else's device.
 */
export function CodeBreakers({ view, act, busy, earn }: PartyProps) {
  const p = view.party;

  if (!p.password) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <p className="text-4xl">🔐</p>
        <p className="text-xl font-bold">Pick your secret password</p>
        <p className="max-w-sm text-sm text-muted">Hackers will try to guess it. Don&apos;t say it out loud!</p>
        <div className="grid w-full max-w-sm gap-2">
          {(p.passwordChoices ?? []).map((w, i) => (
            <button key={w} type="button" disabled={busy} onClick={() => void act({ action: "password", choice: i })} className="h-12 rounded-xl border border-line bg-panel font-mono text-lg font-bold hover:border-accent">
              {w}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const last = view.last;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-xl bg-[#0b1f14] px-4 py-3 font-mono text-sm text-[#3ddc84]">
        <span>🔑 {p.password}</span>
        <span>
          hack: {p.hackReady ? "READY" : `${"▮".repeat(p.hackCharge ?? 0)}${"▯".repeat((p.hackEvery ?? 3) - (p.hackCharge ?? 0))}`}
        </span>
      </div>

      {last?.kind === "hacked" && <p className="rounded-xl bg-danger/10 px-3 py-2 text-center text-sm text-danger">🚨 {String(last.by)} cracked your password and stole {String(last.amount)} bits!</p>}
      {last?.kind === "defended" && <p className="rounded-xl bg-accent/10 px-3 py-2 text-center text-sm text-accent">🛡️ {String(last.by)} tried to hack you and failed!</p>}
      {last?.kind === "hack" && (
        <p className={`rounded-xl px-3 py-2 text-center text-sm ${last.ok ? "bg-accent/10 text-accent" : "bg-danger/10 text-danger"}`}>
          {last.ok ? `💻 Access granted! You stole ${String(last.amount)} bits from ${String(last.target)}.` : `🔒 Access denied. That wasn't ${String(last.target)}'s password.`}
        </p>
      )}

      {p.hack ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#3ddc84]/50 bg-[#0b1f14] p-5 text-center font-mono text-[#3ddc84]">
          <p className="text-lg font-bold">&gt; cracking {p.hack.targetName}…</p>
          <p className="text-sm opacity-80">Which one is their password?</p>
          <div className="grid w-full gap-2">
            {p.hack.options.map((w, i) => (
              <button key={i} type="button" disabled={busy} onClick={() => void act({ action: "guess", choice: i })} className="h-12 rounded-lg border border-[#3ddc84]/60 text-lg hover:bg-[#3ddc84]/10">
                {w}
              </button>
            ))}
          </div>
        </div>
      ) : p.hackReady ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-[#3ddc84]/50 bg-[#0b1f14] p-4 font-mono text-[#3ddc84]">
          <p className="text-center font-bold">&gt; hack ready. pick a target:</p>
          {(p.targets ?? []).length === 0 && <p className="text-center text-sm opacity-80">Nobody to hack yet. Keep mining!</p>}
          {(p.targets ?? []).map((t) => (
            <button key={t.id} type="button" disabled={busy} onClick={() => void act({ action: "hack", target: t.id })} className="flex items-center justify-between rounded-lg border border-[#3ddc84]/40 px-3 py-2 hover:bg-[#3ddc84]/10">
              <span>{t.name}</span>
              <span>{t.score.toLocaleString()} bits</span>
            </button>
          ))}
          <p className="text-center text-xs opacity-70">Or keep answering; your hack stays ready.</p>
        </div>
      ) : null}

      {!p.hack && earn}
      {last?.kind === "bits" && <p className="text-center text-sm text-accent">+{String(last.amount)} bits mined</p>}
    </div>
  );
}
