"use client";

import { useEffect, useState } from "react";
import { EMAIL_KINDS, emailOn, type EmailKind, type EmailPrefs } from "@/lib/emailKinds";

/**
 * Profile settings: which emails Jace Live sends u. They go through Jace (to
 * the email on ur Jace account, which Jace Live never sees), so Jace's own
 * "Emails from Jace's apps" switch turns them all off too.
 */
export function EmailCard({ moderator = false }: { moderator?: boolean }) {
  const [prefs, setPrefs] = useState<EmailPrefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/me/prefs", { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => live && setPrefs((b?.prefs?.emails as EmailPrefs | undefined) ?? {}))
      .catch(() => live && setPrefs({}));
    return () => {
      live = false;
    };
  }, []);

  const set = async (kind: EmailKind, on: boolean) => {
    const before = prefs;
    setPrefs({ ...(prefs ?? {}), [kind]: on });
    setError(null);
    const res = await fetch("/api/me/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails: { [kind]: on } }) }).catch(() => null);
    if (!res?.ok) {
      setPrefs(before);
      setError("couldnt save that, try again");
    }
  };

  const kinds = (Object.keys(EMAIL_KINDS) as EmailKind[]).filter((k) => k !== "reports" || moderator);
  return (
    <section className="rounded-3xl border border-line bg-panel p-5 shadow-[0_10px_30px_-18px_rgba(30,20,10,0.25)]">
      <h2 className="mb-2 font-display text-xl font-bold">📬 emails</h2>
      {kinds.map((kind) => (
        <label key={kind} className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2 hover:bg-accent/10">
          <input type="checkbox" disabled={!prefs} checked={emailOn(prefs ?? undefined, kind)} onChange={(e) => void set(kind, e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
          <span>
            <span className="block font-semibold">{EMAIL_KINDS[kind].label}</span>
            <span className="block text-xs text-muted">{EMAIL_KINDS[kind].desc}</span>
          </span>
        </label>
      ))}
      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
      <p className="mt-1 text-xs text-muted">
        sent by Jace to the email on ur Jace account (Jace Live never sees it). no ads, ever. turning off &quot;Emails from Jace&apos;s apps&quot; in ur Jace settings stops them all.
      </p>
    </section>
  );
}
