import type { TemplateId } from "./templates";

/**
 * Blocks versions of the starter games (Blockly's JSON format). The puzzle
 * template is code only: a grid puzzle needs lists, which the blocks keep
 * out of the way for beginners.
 */

type Json = Record<string, unknown>;

const num = (n: number) => ({ shadow: { type: "math_number", fields: { NUM: n } } });
const text = (t: string) => ({ shadow: { type: "text", fields: { TEXT: t } } });
const val = (block: Json) => ({ block });
const get = (name: string): Json => ({ type: "variables_get", fields: { VAR: { name } } });
const b = (type: string, fields: Json = {}, inputs: Json = {}, extra: Json = {}): Json => ({ type, fields, inputs, ...extra });

/** Links statements one after another. */
function seq(...blocks: Json[]): Json {
  for (let i = blocks.length - 2; i >= 0; i--) blocks[i] = { ...blocks[i], next: { block: blocks[i + 1] } };
  return blocks[0];
}
const hat = (type: string, x: number, y: number, fields: Json, ...body: Json[]): Json => ({
  type,
  x,
  y,
  fields,
  inputs: body.length ? { DO: { block: seq(...body) } } : {},
});
const setVar = (name: string, value: Json) => b("variables_set", { VAR: { name } }, { VALUE: val(value) });
const changeVar = (name: string, by: number) => b("math_change", { VAR: { name } }, { DELTA: num(by) });
const ifThen = (cond: Json, ...body: Json[]) => b("controls_if", {}, { IF0: val(cond), DO0: { block: seq(...body) } });
const random = (from: number, to: number) => b("math_random_int", {}, { FROM: num(from), TO: num(to) });
const join = (...parts: Json[]) =>
  b("text_join", {}, Object.fromEntries(parts.map((p, i) => [`ADD${i}`, p.shadow ? p : val(p)])), { extraState: { itemCount: parts.length } });
const compare = (op: string, a: Json, c: Json) => b("logic_compare", { OP: op }, { A: val(a), B: val(c) });
const logic = (op: "AND" | "OR", a: Json, c: Json) => b("logic_operation", { OP: op }, { A: val(a), B: val(c) });
const prop = (p: string, sprite: string) => b("jg_get_prop", { PROP: p }, { SPRITE: val(get(sprite)) });
const workspace = (...blocks: Json[]) => ({ blocks: { languageVersion: 0, blocks } });

const ARCADE = workspace(
  hat(
    "jg_on_start",
    30,
    30,
    {},
    setVar("player", b("jg_new_emoji", { LOOK: "🚀" }, { X: num(240), Y: num(330), SIZE: num(32) })),
    b("jg_set_score", {}, { VALUE: num(0) }),
    b("jg_show_text", {}, { TEXT: text("Dodge the rocks! ← → or hold a finger") }),
    b("jg_after", {}, { SECS: num(3), DO: { block: b("jg_show_text", {}, { TEXT: text("") }) } }),
  ),
  hat(
    "jg_on_tick",
    30,
    400,
    {},
    ifThen(
      logic("OR", b("jg_key_down", { KEY: "left" }), logic("AND", b("jg_pointer_down"), compare("LT", b("jg_pointer", { AXIS: "x" }), prop("x", "player")))),
      b("jg_change_prop", { PROP: "x" }, { SPRITE: val(get("player")), VALUE: num(-5) }),
    ),
    ifThen(
      logic("OR", b("jg_key_down", { KEY: "right" }), logic("AND", b("jg_pointer_down"), compare("GT", b("jg_pointer", { AXIS: "x" }), prop("x", "player")))),
      b("jg_change_prop", { PROP: "x" }, { SPRITE: val(get("player")), VALUE: num(5) }),
    ),
    b("jg_keep_on", {}, { SPRITE: val(get("player")) }),
    ifThen(b("jg_touching_look", { LOOK: "☄️" }, { SPRITE: val(get("player")) }), b("jg_game_over")),
  ),
  hat(
    "jg_every",
    780,
    30,
    { SECS: 0.5 },
    setVar("rock", b("jg_new_emoji", { LOOK: "☄️" }, { X: val(random(10, 470)), Y: num(-20), SIZE: val(random(20, 40)) })),
    b("jg_set_prop", { PROP: "vy" }, { SPRITE: val(get("rock")), VALUE: val(random(3, 6)) }),
    b("jg_change_score", {}, { VALUE: num(1) }),
  ),
);

const tapCookie = () => [
  b("jg_change_score", {}, { VALUE: val(get("per tap")) }),
  b("jg_set_prop", { PROP: "size" }, { SPRITE: val(get("cookie")), VALUE: num(135) }),
  b("jg_after", {}, { SECS: num(0.08), DO: { block: b("jg_set_prop", { PROP: "size" }, { SPRITE: val(get("cookie")), VALUE: num(120) }) } }),
];
const buyUpgrade = () => [
  ifThen(compare("GTE", b("jg_score"), get("upgrade cost")), b("jg_change_score", {}, { VALUE: val(b("math_single", { OP: "NEG" }, { NUM: val(get("upgrade cost")) })) }), changeVar("per tap", 1), changeVar("upgrade cost", 10)),
];

const CLICKER = workspace(
  hat(
    "jg_on_start",
    30,
    30,
    {},
    setVar("cookie", b("jg_new_emoji", { LOOK: "🍪" }, { X: num(240), Y: num(190), SIZE: num(120) })),
    setVar("star", b("jg_new_emoji", { LOOK: "⭐" }, { X: num(420), Y: num(310), SIZE: num(50) })),
    b("jg_set_score", {}, { VALUE: num(0) }),
    setVar("time left", b("math_number", { NUM: 30 })),
    setVar("per tap", b("math_number", { NUM: 1 })),
    setVar("upgrade cost", b("math_number", { NUM: 20 })),
  ),
  hat("jg_on_sprite_tap", 30, 420, { SPRITE: { name: "cookie" } }, ...tapCookie()),
  hat("jg_on_key", 30, 740, { KEY: "space" }, ...tapCookie()),
  hat("jg_on_sprite_tap", 640, 420, { SPRITE: { name: "star" } }, ...buyUpgrade()),
  hat("jg_on_key", 640, 740, { KEY: "enter" }, ...buyUpgrade()),
  hat(
    "jg_every",
    30,
    1000,
    { SECS: 0.1 },
    b("jg_show_text", {}, { TEXT: val(join(text("⏱ "), b("math_round", { OP: "ROUNDUP" }, { NUM: val(get("time left")) }), text("s · ⭐ (Enter) +1 per tap for "), get("upgrade cost"))) }),
  ),
  hat(
    "jg_every",
    30,
    1120,
    { SECS: 1 },
    changeVar("time left", -1),
    ifThen(compare("LT", get("time left"), b("math_number", { NUM: 1 })), b("jg_game_over")),
  ),
);

const tap = () => [
  b("jg_change_score", {}, { VALUE: num(1) }),
  b("jg_send", { NAME: "score" }, { VALUE: val(b("jg_score")) }),
  ifThen(
    compare("GTE", b("jg_score"), b("math_number", { NUM: 30 })),
    b("jg_send", { NAME: "won" }, { VALUE: val(b("jg_my_number")) }),
    b("jg_game_over_winner", {}, { WINNER: val(b("jg_my_number")) }),
  ),
];

const DUEL = workspace(
  hat(
    "jg_on_start",
    30,
    30,
    {},
    b("jg_set_score", {}, { VALUE: num(0) }),
    setVar("button", b("jg_new_emoji", { LOOK: "👆" }, { X: num(240), Y: num(200), SIZE: num(110) })),
    b("jg_show_text", {}, { TEXT: text("First to 30 taps wins! (or press Space)") }),
  ),
  hat("jg_on_sprite_tap", 30, 280, { SPRITE: { name: "button" } }, ...tap()),
  hat("jg_on_key", 30, 640, { KEY: "space" }, ...tap()),
  hat("jg_on_message", 760, 30, { NAME: "score" }, b("jg_show_text", {}, { TEXT: val(join(text("Other player: "), b("jg_message_value"))) })),
  hat("jg_on_message", 760, 200, { NAME: "won" }, b("jg_game_over_winner", {}, { WINNER: val(b("jg_message_value")) })),
);

const BLANK = workspace(hat("jg_on_start", 30, 30, {}, setVar("sprite", b("jg_new_emoji", { LOOK: "🙂" }, { X: num(240), Y: num(180), SIZE: num(60) }))));

const BLOCK_TEMPLATES: Partial<Record<TemplateId, object>> = { arcade: ARCADE, clicker: CLICKER, duel: DUEL, blank: BLANK };

/** The blocks version of a template, or null if it's code only. */
export function blockTemplate(id: TemplateId): object | null {
  return BLOCK_TEMPLATES[id] ?? null;
}
