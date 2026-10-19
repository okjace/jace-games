"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  loadJaceCache,
  loadLocal,
  mergeHistory,
  newScoreId,
  saveJaceCache,
  setUploadDeclined,
  updateLocal,
  uploadDeclined,
} from "@/lib/localScores";
import type { JaceScore, LocalScore, ScoreEntry, ScoreSubmission, SessionUser, SyncState } from "@/lib/types";

/**
 * Keeps scores in sync with Jace. Every finished game is saved on this device
 * first, then uploaded with a stable external_id; failed uploads stay
 * pending and are retried when the browser comes back online, when the tab
 * becomes visible again, and every minute. On sign-in, the player's scores
 * on Jace (including the old Jace site's Snake and Memory Match scores) are
 * fetched and merged in.
 */

type Notice = { kind: "error" | "info"; text: string } | null;

type ScoresContextValue = {
  user: SessionUser | null;
  sync: SyncState;
  pendingCount: number;
  /** Everything in the player's history, newest first. */
  history: ScoreEntry[];
  /** Saves a finished game and starts uploading it. */
  record: (game: string, score: number, durationMs: number) => LocalScore;
  /** Scores played signed out on this device, offered for upload after sign-in. */
  anonymousCount: number;
  showUploadOffer: boolean;
  uploadAnonymous: () => void;
  declineUpload: () => void;
  notice: Notice;
  dismissNotice: () => void;
  /** Ask Jace again (after "coming soon" or an error). */
  retry: () => void;
};

const ScoresContext = createContext<ScoresContextValue | null>(null);

export function useScores(): ScoresContextValue {
  const ctx = useContext(ScoresContext);
  if (!ctx) throw new Error("useScores must be used inside <ScoresProvider>");
  return ctx;
}

const NOTICES: Record<string, string> = {
  banned: "This Jace account is banned.",
  denied: "Sign in was cancelled.",
  signin: "Couldn't sign in with Jace. Please try again.",
  state: "That sign-in link expired. Please try again.",
};

const BATCH = 500;
const RETRY_MS = 60_000;

function toSubmission(s: LocalScore): ScoreSubmission {
  return {
    external_id: s.id,
    game: s.game,
    score: s.score,
    created_at: s.createdAt,
    duration_ms: s.durationMs,
  };
}

export function ScoresProvider({
  initialUser,
  children,
}: {
  initialUser: SessionUser | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [sync, setSync] = useState<SyncState>(initialUser ? "syncing" : "signed-out");
  const [local, setLocal] = useState<LocalScore[]>([]);
  const [jace, setJace] = useState<JaceScore[]>([]);
  const [declined, setDeclined] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const flushing = useRef(false);
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Load this device's scores once mounted (localStorage isn't there on the server).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocal(loadLocal());
    if (initialUser) {
      setJace(loadJaceCache(initialUser.id));
      setDeclined(uploadDeclined(initialUser.id));
    }
  }, [initialUser]);

  // Show (then strip) ?error=… and ?signedin=1 from the sign-in redirect.
  useEffect(() => {
    const url = new URL(window.location.href);
    const error = url.searchParams.get("error");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (error) setNotice({ kind: "error", text: NOTICES[error] ?? NOTICES.signin });
    if (error || url.searchParams.has("signedin")) {
      url.searchParams.delete("error");
      url.searchParams.delete("signedin");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  }, []);

  const signedOut = useCallback(
    (banned = false) => {
      userRef.current = null;
      setUser(null);
      setSync("signed-out");
      setJace([]);
      if (banned) setNotice({ kind: "error", text: NOTICES.banned });
      router.refresh();
    },
    [router],
  );

  const fetchJaceScores = useCallback(async (): Promise<boolean> => {
    const u = userRef.current;
    if (!u) return false;
    const res = await fetch("/api/scores", { cache: "no-store" });
    if (res.status === 401) {
      signedOut();
      return false;
    }
    const data = (await res.json()) as { available?: boolean; needsReauth?: boolean; scores?: JaceScore[] };
    if (!data.available) {
      setSync("coming-soon");
      return false;
    }
    if (data.needsReauth) {
      setSync("reauth");
      return false;
    }
    const scores = data.scores ?? [];
    saveJaceCache(u.id, scores);
    setJace(scores);
    return true;
  }, [signedOut]);

  /** Uploads every pending score that belongs to the signed-in player. */
  const flush = useCallback(async () => {
    const u = userRef.current;
    if (!u || flushing.current) return;
    flushing.current = true;
    try {
      const pending = loadLocal().filter((s) => s.owner === u.id && s.status === "pending");
      if (pending.length === 0) {
        setSync((s) => (s === "syncing" || s === "pending" ? "synced" : s));
        return;
      }
      setSync("syncing");
      let imported = 0;
      for (let i = 0; i < pending.length; i += BATCH) {
        const res = await fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scores: pending.slice(i, i + BATCH).map(toSubmission) }),
        });
        if (res.status === 401) return signedOut();
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        const data = (await res.json()) as {
          available?: boolean;
          needsReauth?: boolean;
          imported?: number;
          accepted?: string[];
          rejected?: { id: string | null; reason: string }[];
        };
        if (!data.available) return setSync("coming-soon");
        if (data.needsReauth) return setSync("reauth");
        imported += data.imported ?? 0;
        const accepted = new Set(data.accepted ?? []);
        const rejected = new Map((data.rejected ?? []).map((r) => [r.id, r.reason]));
        setLocal(
          updateLocal((list) =>
            list.map((s) =>
              accepted.has(s.id)
                ? { ...s, status: "synced" }
                : rejected.has(s.id)
                  ? { ...s, status: "rejected", rejectReason: rejected.get(s.id) }
                  : s,
            ),
          ),
        );
      }
      if (imported > 0) await fetchJaceScores().catch(() => {});
      setSync("synced");
    } catch {
      setSync(navigator.onLine ? "error" : "pending");
    } finally {
      flushing.current = false;
    }
  }, [fetchJaceScores, signedOut]);

  // On load while signed in: re-check the account (bans, revoked tokens),
  // pull the player's Jace scores, then upload anything pending.
  useEffect(() => {
    if (!initialUser) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        const data = (await res.json()) as { user: SessionUser | null; banned?: boolean };
        if (cancelled) return;
        if (!data.user) return signedOut(!!data.banned);
        userRef.current = data.user;
        setUser(data.user);
        const ok = await fetchJaceScores();
        if (ok && !cancelled) await flush();
      } catch {
        if (!cancelled) setSync("pending");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialUser, fetchJaceScores, flush, signedOut]);

  // Retry pending uploads when back online, when the tab is shown, and every minute.
  const pendingCount = useMemo(
    () => (user ? local.filter((s) => s.owner === user.id && s.status === "pending").length : 0),
    [local, user],
  );
  useEffect(() => {
    if (!user) return;
    const kick = () => {
      if (document.visibilityState === "visible") void flush();
    };
    window.addEventListener("online", kick);
    document.addEventListener("visibilitychange", kick);
    const timer = pendingCount > 0 && sync !== "coming-soon" ? setInterval(kick, RETRY_MS) : null;
    return () => {
      window.removeEventListener("online", kick);
      document.removeEventListener("visibilitychange", kick);
      if (timer) clearInterval(timer);
    };
  }, [user, flush, pendingCount, sync]);

  const record = useCallback(
    (game: string, score: number, durationMs: number): LocalScore => {
      const u = userRef.current;
      const entry: LocalScore = {
        id: newScoreId(),
        game,
        score: Math.round(score),
        createdAt: new Date().toISOString(),
        durationMs: Math.round(durationMs),
        owner: u?.id ?? null,
        status: "pending",
      };
      setLocal(updateLocal((list) => [...list, entry]));
      if (u) void flush();
      return entry;
    },
    [flush],
  );

  const anonymousCount = useMemo(
    () => local.filter((s) => s.owner === null && s.status === "pending").length,
    [local],
  );

  const uploadAnonymous = useCallback(() => {
    const u = userRef.current;
    if (!u) return;
    setLocal(
      updateLocal((list) => list.map((s) => (s.owner === null && s.status === "pending" ? { ...s, owner: u.id } : s))),
    );
    void flush();
  }, [flush]);

  const declineUpload = useCallback(() => {
    const u = userRef.current;
    if (!u) return;
    setUploadDeclined(u.id);
    setDeclined(true);
  }, []);

  const retry = useCallback(() => {
    void (async () => {
      setSync("syncing");
      try {
        if (await fetchJaceScores()) await flush();
      } catch {
        setSync(navigator.onLine ? "error" : "pending");
      }
    })();
  }, [fetchJaceScores, flush]);

  const history = useMemo(() => mergeHistory(user?.id ?? null, local, jace), [user, local, jace]);

  const value = useMemo<ScoresContextValue>(
    () => ({
      user,
      sync: user && sync === "synced" && pendingCount > 0 ? "pending" : sync,
      pendingCount,
      history,
      record,
      anonymousCount,
      showUploadOffer: !!user && anonymousCount > 0 && !declined,
      uploadAnonymous,
      declineUpload,
      notice,
      dismissNotice: () => setNotice(null),
      retry,
    }),
    [user, sync, pendingCount, history, record, anonymousCount, declined, uploadAnonymous, declineUpload, notice, retry],
  );

  return <ScoresContext.Provider value={value}>{children}</ScoresContext.Provider>;
}
