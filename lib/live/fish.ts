/**
 * Every creature (and thing) in Lake Frenzy. Shared by the server, which
 * rolls catches from it, and the Fishdex on players' phones, which lists it.
 * `weight` is out of the table's total, so odds = weight / TOTAL_WEIGHT.
 * All of these are original Jace Games creatures.
 */

export type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythic" | "Secret";

export type FishDef = {
  id: string;
  icon: string;
  name: string;
  rarity: Rarity;
  /** Pounds, before streak, frenzy and storm effects. */
  min: number;
  max: number;
  weight: number;
  blurb: string;
};

export type Special = { id: string; icon: string; name: string; kind: "junk" | "frenzy" | "storm" | "treasure"; weight: number; blurb: string };

export const RARITY_COLOR: Record<Rarity, string> = {
  Common: "#cbd5e1",
  Uncommon: "#4ade80",
  Rare: "#38bdf8",
  Epic: "#c084fc",
  Legendary: "#facc15",
  Mythic: "#fb7185",
  Secret: "#ffffff",
};

export const RARITY_ORDER: Rarity[] = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Secret"];

export const FISH: FishDef[] = [
  // Common
  { id: "minnow", icon: "🐟", name: "Minnow", rarity: "Common", min: 1, max: 3, weight: 2200, blurb: "Small, quick, everywhere." },
  { id: "sunfish", icon: "🐠", name: "Sunfish", rarity: "Common", min: 3, max: 8, weight: 1800, blurb: "Loves the warm shallows." },
  { id: "mudskip", icon: "🐟", name: "Mud Skipper", rarity: "Common", min: 2, max: 6, weight: 1400, blurb: "Walks on the bank when nobody's looking." },
  { id: "pebblebass", icon: "🐟", name: "Pebble Bass", rarity: "Common", min: 4, max: 10, weight: 1200, blurb: "Disguises itself as a rock. Badly." },
  // Uncommon
  { id: "puffer", icon: "🐡", name: "Puffer", rarity: "Uncommon", min: 5, max: 13, weight: 900, blurb: "Don't poke it." },
  { id: "bubblecrab", icon: "🦀", name: "Bubble Crab", rarity: "Uncommon", min: 4, max: 11, weight: 800, blurb: "Blows bubbles when it's happy." },
  { id: "reedeel", icon: "🐍", name: "Reed Eel", rarity: "Uncommon", min: 8, max: 18, weight: 650, blurb: "Hides between the reeds." },
  { id: "lilyfrog", icon: "🐸", name: "Lily Frog", rarity: "Uncommon", min: 2, max: 5, weight: 600, blurb: "Not a fish. Grabbed the hook anyway." },
  // Rare
  { id: "squid", icon: "🦑", name: "Ink Squid", rarity: "Rare", min: 10, max: 26, weight: 380, blurb: "Leaves a cloud behind when it's caught." },
  { id: "turtle", icon: "🐢", name: "Old Turtle", rarity: "Rare", min: 20, max: 46, weight: 300, blurb: "Older than the lake, probably." },
  { id: "glimmerguppy", icon: "✨", name: "Glimmer Guppy", rarity: "Rare", min: 6, max: 14, weight: 260, blurb: "Sparkles when the sun hits it." },
  { id: "moonkoi", icon: "🎏", name: "Moonlit Koi", rarity: "Rare", min: 14, max: 30, weight: 220, blurb: "Only bites at dusk. Or now." },
  // Epic
  { id: "shark", icon: "🦈", name: "Lake Shark", rarity: "Epic", min: 60, max: 121, weight: 110, blurb: "How did it get in here?" },
  { id: "thunderpike", icon: "⚡", name: "Thunder Pike", rarity: "Epic", min: 40, max: 90, weight: 95, blurb: "Crackles with static." },
  { id: "crystalcarp", icon: "💎", name: "Crystal Carp", rarity: "Epic", min: 30, max: 70, weight: 85, blurb: "You can see right through it." },
  { id: "emberel", icon: "🔥", name: "Ember Eel", rarity: "Epic", min: 35, max: 80, weight: 75, blurb: "Warm to the touch. The water steams." },
  // Legendary
  { id: "whale", icon: "🐋", name: "Legendary Whale", rarity: "Legendary", min: 150, max: 301, weight: 28, blurb: "The whole boat tips." },
  { id: "auroraray", icon: "🌌", name: "Aurora Ray", rarity: "Legendary", min: 120, max: 260, weight: 24, blurb: "Glides like the northern lights." },
  { id: "goldkoi", icon: "👑", name: "Golden Koi King", rarity: "Legendary", min: 90, max: 200, weight: 20, blurb: "Wears a tiny crown. Earned it." },
  { id: "voidangler", icon: "🕳️", name: "Void Angler", rarity: "Legendary", min: 130, max: 280, weight: 16, blurb: "Its lantern shows another world." },
  // Mythic
  { id: "stardragon", icon: "🐉", name: "Star Dragon Fish", rarity: "Mythic", min: 400, max: 800, weight: 5, blurb: "Fell from the sky and liked it here." },
  { id: "phoenixfin", icon: "🦅", name: "Phoenix Fin", rarity: "Mythic", min: 350, max: 700, weight: 4, blurb: "Burns bright, then swims again." },
  { id: "kraken", icon: "🐙", name: "Baby Kraken", rarity: "Mythic", min: 500, max: 1000, weight: 3, blurb: "Baby. Allegedly." },
  // Secret
  { id: "sovereign", icon: "🌟", name: "The Lake Sovereign", rarity: "Secret", min: 2000, max: 4000, weight: 1, blurb: "One in many thousands. The lake bows." },
];

export const SPECIALS: Special[] = [
  { id: "boot", icon: "🥾", name: "Soggy Boot", kind: "junk", weight: 900, blurb: "Worth nothing. Still a story." },
  { id: "can", icon: "🥫", name: "Rusty Can", kind: "junk", weight: 500, blurb: "Please recycle." },
  { id: "frenzy", icon: "🫧", name: "Frenzy!", kind: "frenzy", weight: 550, blurb: "Your next 3 catches are doubled." },
  { id: "storm", icon: "⛈️", name: "Storm Cloud", kind: "storm", weight: 450, blurb: "Everyone else's next catch is halved." },
  { id: "chest", icon: "🧰", name: "Sunken Chest", kind: "treasure", weight: 180, blurb: "Full of old coins: worth 50–150 lb." },
];

export const TOTAL_WEIGHT = [...FISH, ...SPECIALS].reduce((a, f) => a + f.weight, 0);

/** "1 in 640", for the Fishdex. */
export function oddsText(weight: number): string {
  const n = TOTAL_WEIGHT / weight;
  return n < 10 ? `${Math.round((weight / TOTAL_WEIGHT) * 100)}%` : `1 in ${Math.round(n).toLocaleString("en-US")}`;
}
