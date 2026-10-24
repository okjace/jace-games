import type { RoomChannel } from "@/lib/realtime/client";

export type SeatInfo = { seat: number; name: string; picture?: string | null; you?: boolean; left?: boolean };

/** Props for a turn-based game's board. The same board is used online and for pass-and-play. */
export type TurnGameProps<V = unknown, M = unknown> = {
  view: V;
  /** The seat this screen plays as. In pass-and-play it's whoever's turn it is; null for a spectator. */
  seat: number | null;
  /** Seats that may act right now. */
  turn: number[];
  players: SeatInfo[];
  onMove: (move: M) => void;
  busy: boolean;
  local: boolean;
  /** Online only: the room's live channel, for extras like drawing strokes. */
  channel?: RoomChannel | null;
  /** Server clock offset, for countdowns: serverNow - Date.now(). */
  clockSkew?: number;
};

/** Seat colors shared by every multiplayer board and the lobby. */
export const SEAT_COLORS = ["#f87171", "#facc15", "#38bdf8", "#a78bfa", "#fb923c", "#3ddc84", "#f472b6", "#94a3b8"];
