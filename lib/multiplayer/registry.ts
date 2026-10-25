import { battleship } from "./rules/battleship";
import { checkers } from "./rules/checkers";
import { chess } from "./rules/chess";
import { connect4 } from "./rules/connect4";
import { dots } from "./rules/dots";
import { draw } from "./rules/draw";
import { memory } from "./rules/memory";
import type { Rules } from "./types";

/** Rules for every turn-based game, by game id. Shared by the server and the browser. */
export const RULES: Record<string, Rules> = {
  connect4: connect4 as Rules,
  memory: memory as Rules,
  checkers: checkers as Rules,
  chess: chess as Rules,
  battleship: battleship as Rules,
  dots: dots as Rules,
  draw: draw as Rules,
};
