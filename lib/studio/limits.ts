/** Game Studio limits, shared by the editor (to warn early) and the server (to enforce). */

/** The most a game can weigh: its HTML plus its blocks, in bytes. */
export const MAX_GAME_BYTES = 256 * 1024;
export const MAX_TITLE = 60;
export const MAX_DESCRIPTION = 500;
export const MAX_REPORT = 500;
export const MAX_PLAYERS = 8;
/** Scores are whole numbers within ±1e9. */
export const MAX_SCORE = 1e9;

export function byteSize(s: string): number {
  return new TextEncoder().encode(s).length;
}

export function gameBytes(html: string, blocksJson: unknown): number {
  return byteSize(html) + (blocksJson == null ? 0 : byteSize(JSON.stringify(blocksJson)));
}
