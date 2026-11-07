import "server-only";
import { liveStore } from "@/lib/db/live";
import { getUserInfo } from "@/lib/jace";
import type { Session } from "@/lib/session";
import { allow } from "@/lib/rateLimit";
import { isSiteOwner } from "@/lib/studio/server";
import { LiveError } from "./engine";
import { LIMITS, cleanQuestions, type LiveSet } from "./types";

/**
 * Question sets: anyone signed in with Jace can make them. Public sets show
 * up in Discover; unlisted ones only by link; private ones only to their
 * owner. Banned or muted Jace accounts can't make sets public.
 */

export function canSee(set: LiveSet, userId: string | null): boolean {
  if (set.owner_id === userId || isSiteOwner(userId)) return true;
  return !set.removed && set.visibility !== "private";
}

/** A set for someone who isn't its owner: answers stay hidden so the set can't be used to cheat. */
export function publicSet(set: LiveSet, userId: string | null) {
  if (set.owner_id === userId) return set;
  return {
    ...set,
    questions: set.questions.map((q) => {
      const { correct, accepted, ...rest } = q;
      void correct;
      void accepted;
      return rest;
    }),
  };
}

const cleanTags = (raw: unknown): string[] =>
  [...new Set((Array.isArray(raw) ? raw : []).map((t) => String(t).toLowerCase().replace(/[^a-z0-9 -]/g, "").trim().slice(0, LIMITS.tag)).filter(Boolean))].slice(0, LIMITS.tags);

export async function saveSet(session: Session, id: string | null, body: Record<string, unknown>): Promise<LiveSet> {
  if (!allow(`live-save:${session.user.id}`, 60, 60_000)) throw new LiveError("Saving too often. Wait a moment.", 429);
  const store = liveStore();
  const existing = id ? await store.getSet(id) : null;
  if (id && (!existing || existing.owner_id !== session.user.id)) throw new LiveError("That set isn't yours.", 403);
  if (JSON.stringify(body).length > LIMITS.setBytes) throw new LiveError("This set is too big (1 MB max).", 413);

  const cleaned = cleanQuestions(body.questions ?? existing?.questions ?? []);
  if (!cleaned.ok) throw new LiveError(cleaned.error);
  const visibility = (["public", "unlisted", "private"] as const).find((v) => v === body.visibility) ?? existing?.visibility ?? "private";
  if (visibility === "public" && existing?.visibility !== "public") {
    const info = await getUserInfo(session.token).catch(() => null);
    if (info?.banned || info?.muted) throw new LiveError("This Jace account can't publish sets.", 403);
  }
  const fields = {
    title: (typeof body.title === "string" ? body.title : existing?.title ?? "Untitled set").trim().slice(0, LIMITS.title) || "Untitled set",
    description: (typeof body.description === "string" ? body.description : existing?.description ?? "").slice(0, LIMITS.description),
    cover: typeof body.cover === "string" && body.cover.trim() ? [...body.cover.trim()].slice(0, 2).join("") : (existing?.cover ?? "❓"),
    tags: body.tags !== undefined ? cleanTags(body.tags) : (existing?.tags ?? []),
    visibility,
    questions: cleaned.questions,
  };
  if (existing) return (await store.updateSet(existing.id, fields))!;
  if (!allow(`live-create:${session.user.id}`, 20, 3_600_000)) throw new LiveError("You've made a lot of sets this hour.", 429);
  return store.createSet({ ...fields, owner_id: session.user.id, owner_name: session.user.username });
}
