import { MAX_GAME_BYTES } from "./limits";

/**
 * The Jace game SDK (window.jace) for Studio games, which are all Jace Live
 * modes. One list, used by the help box in the Studio editor and by Jace AI
 * (so the AI writes games that use the SDK the same way people do).
 */

export const SDK_ITEMS: [string, string][] = [
  ["jace.live", "the Live part. null when u test outside a Live game (then use pretend coins, like 50)"],
  ["jace.live.coins", "every coin the player has earned by answering questions (it only goes up, so keep track of what ur game spends)"],
  ["jace.live.onCoins((total, gained) => …)", "runs each time they earn more coins"],
  ["jace.live.earn()", "opens the questions so they can earn more coins (put this on an \"earn coins\" button)"],
  ["jace.submitScore(n)", "their score (whole number, higher is better, their best counts). it can be at most 20 points per coin earned"],
  ["jace.gameOver()", "their run is over (they can start again)"],
  ["jace.player.name", "who's playing"],
  ["jace.theme", "the site's colours right now: background, panel, accent, accent2, text, muted, line, and dark (true in dark mode). use them so ur game matches Jace Live"],
  ["--jl-bg, --jl-panel, --jl-accent, --jl-accent2, --jl-text, --jl-muted, --jl-line", "the same colours as CSS variables (the page background already uses --jl-bg)"],
  ["jace.onReady(cb)", "runs cb once the page is ready"],
  ["jace.random() / jace.seed", "random numbers that are the same each time for this player in this game"],
];

export const SDK_LIMITS_TEXT = `Games run in a locked-down frame: no network (fetch, WebSocket, images from other sites), no cookies or storage, no popups. Put images and sounds in the game as data: URLs. Up to ${MAX_GAME_BYTES / 1024} KB per game.`;

export const BLOCKS_LIVE_TEXT = "In the blocks editor, the Live category has the same things: when I get coins, coins I have, spend coins, have N coins?, and go answer questions.";

/** The SDK as plain text (for AI prompts). */
export const SDK_TEXT = [
  "The Jace game SDK (window.jace), for Jace Live Studio games. Players earn coins by answering quiz questions; the game is what they spend coins on.",
  ...SDK_ITEMS.map(([k, v]) => `- ${k}: ${v}`),
  SDK_LIMITS_TEXT,
].join("\n");
