"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { GameProps } from "./shared";

/** Game id (lib/games.ts) → its component. Each loads only on its own page. */
export const GAME_COMPONENTS: Record<string, ComponentType<GameProps>> = {
  snake: dynamic(() => import("./Snake"), { ssr: false }),
  memory: dynamic(() => import("./Memory"), { ssr: false }),
  "2048": dynamic(() => import("./Game2048"), { ssr: false }),
  tetris: dynamic(() => import("./Tetris"), { ssr: false }),
  minesweeper: dynamic(() => import("./Minesweeper"), { ssr: false }),
  flappy: dynamic(() => import("./Flappy"), { ssr: false }),
  breakout: dynamic(() => import("./Breakout"), { ssr: false }),
  wordle: dynamic(() => import("./Wordle"), { ssr: false }),
  reaction: dynamic(() => import("./Reaction"), { ssr: false }),
  typing: dynamic(() => import("./Typing"), { ssr: false }),
};
