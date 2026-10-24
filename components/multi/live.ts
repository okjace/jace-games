"use client";

import type { ComponentType } from "react";
import type { RoomChannel } from "@/lib/realtime/client";
import type { SeatInfo } from "./types";

/**
 * Props for a live (real-time) game. The host's browser runs the game and
 * broadcasts its state on the channel; the others send their input. When
 * it's over, the host calls onEnd with the winning seats.
 */
export type LiveGameProps = {
  seat: number;
  seed: number;
  isHost: boolean;
  players: SeatInfo[];
  channel: RoomChannel | null;
  /** User ids currently connected to the room. */
  online: string[];
  onEnd: (winners: number[], scores?: Record<string, number>) => void;
};

/** Live games by id; filled in as they're added. */
export const LIVE_COMPONENTS: Record<string, ComponentType<LiveGameProps>> = {};
