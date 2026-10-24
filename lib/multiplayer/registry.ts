import { connect4 } from "./rules/connect4";
import type { Rules } from "./types";

/** Rules for every turn-based game, by game id. Shared by the server and the browser. */
export const RULES: Record<string, Rules> = {
  connect4: connect4 as Rules,
};
