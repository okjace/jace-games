"use client";

import { useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import { DISPLAY_NAME_MAX, cleanDisplayName } from "@/lib/profile";
import type { SessionUser } from "@/lib/types";

/**
 * On the profile page: your display name (editable), your Jace username
 * (locked; it always matches Jace), and "Update from Jace" to pick up a new
 * username or picture right away.
 */
export function ProfileName({ user }: { user: SessionUser }) {
  const { updateUser } = useScores();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(user.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);

  const save = async (name: string) => {
    const cleaned = cleanDisplayName(name);
    if (!cleaned.ok) return setNote({ text: cleaned.error, good: false });
    setBusy(true);
    const res = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: cleaned.name }) }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return setNote({ text: body?.error ?? "Couldn't save.", good: false });
    updateUser(body.user);
    setEditing(false);
    setNote({ text: cleaned.name ? "Display name saved." : "Display name cleared: you'll show as your username.", good: true });
  };

  const refresh = async () => {
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/profile/refresh", { method: "POST" }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return setNote({ text: body?.error ?? "Couldn't reach Jace.", good: false });
    updateUser(body.user);
    const parts: string[] = [];
    if (body.usernameChanged) parts.push(`Username updated from @${body.usernameChanged.from} to @${body.usernameChanged.to}${body.renamed ? ` (and on ${body.renamed} thing${body.renamed === 1 ? "" : "s"} you made)` : ""}.`);
    if (body.pictureChanged) parts.push("Picture updated.");
    setNote({ text: parts.length ? parts.join(" ") : "Everything already matches your Jace account.", good: true });
  };

  return (
    <div className="flex flex-col gap-1.5">
      {editing ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save(draft);
          }}
        >
          <input
            value={draft}
            autoFocus
            maxLength={DISPLAY_NAME_MAX + 8}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={user.username}
            aria-label="Display name"
            className="h-10 w-56 rounded-xl border border-line bg-background px-3 text-lg font-bold outline-none focus:border-accent"
          />
          <button type="submit" disabled={busy} className="h-9 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-50">
            Save
          </button>
          <button type="button" onClick={() => (setEditing(false), setDraft(user.displayName ?? ""))} className="h-9 rounded-full px-3 text-sm text-muted hover:text-foreground">
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{user.displayName || user.username}</h1>
          <button type="button" onClick={() => setEditing(true)} className="rounded-full border border-line px-3 py-1 text-xs font-medium hover:bg-foreground/[.05]">
            ✏️ {user.displayName ? "Change display name" : "Set a display name"}
          </button>
        </div>
      )}
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span title="Your username comes from Jace and can't be changed here">
          🔒 @{user.username}
        </span>
        <button type="button" onClick={refresh} disabled={busy} className="rounded-full border border-line px-2.5 py-0.5 text-xs hover:bg-foreground/[.05] disabled:opacity-50">
          🔄 Update from Jace
        </button>
      </p>
      <p className="text-xs text-muted">Your username always matches your Jace account. Changed it on Jace? Press Update from Jace.</p>
      {note && (
        <p className={`text-sm ${note.good ? "text-accent" : "text-danger"}`} role="status">
          {note.text}
        </p>
      )}
    </div>
  );
}
