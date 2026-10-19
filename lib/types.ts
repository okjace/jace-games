/** The signed-in Jace account, as kept in the session cookie and shown in the UI. */
export type SessionUser = {
  id: string;
  username: string;
  picture: string | null;
};

/** A score as Jace's API returns it (GET /api/oauth/scores). */
export type JaceScore = {
  id: string;
  game: string;
  score: number;
  created_at: string;
};

/** One row of a Jace leaderboard (best score per player). */
export type LeaderboardRow = {
  user_id: string;
  username: string;
  picture: string | null;
  score: number;
  created_at: string;
};

/**
 * A score kept on this device. `id` is a UUID made when the game ended and is
 * sent to Jace as `external_id`, so uploading it twice never duplicates it.
 * `owner` is the Jace user id it belongs to, or null if played signed out.
 */
export type LocalScore = {
  id: string;
  game: string;
  score: number;
  createdAt: string;
  durationMs: number;
  owner: string | null;
  status: "pending" | "synced" | "rejected";
  rejectReason?: string;
};

/** A score in a player's history, from Jace or from this device. */
export type ScoreEntry = {
  id: string;
  game: string;
  score: number;
  createdAt: string;
  /** Not on Jace yet (waiting to upload, or played signed out). */
  localOnly: boolean;
};

/** What the browser sends to POST /api/scores. */
export type ScoreSubmission = {
  external_id: string;
  game: string;
  score: number;
  created_at: string;
  duration_ms: number;
};

export type SyncState =
  | "signed-out" // scores live on this device only
  | "syncing"
  | "synced"
  | "pending" // offline or a failed upload; will retry
  | "coming-soon" // Jace hasn't shipped the scores API yet
  | "reauth" // the token predates the scores scope; sign in again
  | "error";
