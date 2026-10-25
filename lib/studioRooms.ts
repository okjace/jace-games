import "server-only";
import { studioStore } from "./db/studio";
import { registerGameResolver } from "./rooms";

/**
 * Lets rooms host community games: "c:<community game id>" resolves to the
 * published game's multiplayer settings. Imported by the rooms API routes.
 */
registerGameResolver(async (id) => {
  if (!id.startsWith("c:")) return null;
  const game = await studioStore().getGame(id.slice(2));
  if (!game || !game.published || game.removed || !game.multiplayer) return null;
  return {
    id,
    name: game.title,
    mode: game.multiplayer.mode,
    min: game.multiplayer.min,
    max: game.multiplayer.max,
    better: "higher",
  };
});
