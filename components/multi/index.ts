"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { TurnGameProps } from "./types";

type AnyTurnGame = ComponentType<TurnGameProps<unknown, unknown>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const turn = (load: () => Promise<{ default: ComponentType<TurnGameProps<any, any>> }>) =>
  dynamic(load as unknown as () => Promise<{ default: AnyTurnGame }>, { ssr: false });

/** Boards for turn-based games (lib/multiplayer/registry.ts has their rules). */
export const TURN_COMPONENTS: Record<string, AnyTurnGame> = {
  connect4: turn(() => import("./ConnectFour")),
};
