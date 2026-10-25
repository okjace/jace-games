import type * as BlocklyType from "blockly/core";
import type { CodeGenerator, Block } from "blockly/core";
import { BLOCK_RUNTIME } from "./blockRuntime";

/**
 * Scratch-style game blocks for Blockly 13.3.0 (the version Jace Social's
 * bot editor uses). Blocks compile to plain JavaScript calling the engine
 * in lib/studio/blockRuntime.ts, and the result is a normal game document
 * that runs in the same sandbox as games written in code. Only event
 * blocks ("when game starts", "every frame", …) produce code; loose blocks
 * that aren't inside one are ignored.
 */

type B = typeof BlocklyType;
type JsModule = typeof import("blockly/javascript");

const C = { events: "#d4a017", sprites: "#4c97ff", sensing: "#2ca5c9", game: "#2fa86b", multi: "#9966ff" };

const KEYS = [
  ["← left", "left"],
  ["→ right", "right"],
  ["↑ up", "up"],
  ["↓ down", "down"],
  ["space", "space"],
  ["enter", "enter"],
  ["a", "a"],
  ["d", "d"],
  ["w", "w"],
  ["s", "s"],
  ["any", "any"],
];
const COLORS = [
  ["green", "green"],
  ["blue", "blue"],
  ["red", "red"],
  ["yellow", "yellow"],
  ["white", "white"],
  ["grey", "grey"],
  ["purple", "purple"],
  ["orange", "orange"],
  ["black", "black"],
  ["navy", "navy"],
];
const PROPS = [
  ["x", "x"],
  ["y", "y"],
  ["size", "size"],
  ["x speed", "vx"],
  ["y speed", "vy"],
];

const hat = (type: string, message: string, args: object[], tooltip: string) => ({
  type,
  message0: `${message} %${args.length + 1} %${args.length + 2}`,
  args0: [...args, { type: "input_dummy" }, { type: "input_statement", name: "DO" }],
  colour: C.events,
  tooltip,
});
const num = (name: string) => ({ type: "input_value", name, check: "Number" });
const any = (name: string) => ({ type: "input_value", name });
const sprite = (name = "SPRITE") => ({ type: "input_value", name, check: "Sprite" });
const step = (type: string, message0: string, args0: object[], colour: string, tooltip: string) => ({
  type,
  message0,
  args0,
  previousStatement: null,
  nextStatement: null,
  inputsInline: true,
  colour,
  tooltip,
});
const value = (type: string, message0: string, args0: object[], output: string | null, colour: string, tooltip: string) => ({
  type,
  message0,
  args0,
  output,
  inputsInline: true,
  colour,
  tooltip,
});

export const BLOCKS = [
  // Events
  hat("jg_on_start", "when game starts", [], "Runs when the game starts, and again on play again."),
  hat("jg_on_key", "when %1 key pressed", [{ type: "field_dropdown", name: "KEY", options: KEYS }], "Runs each time the key is pressed."),
  hat("jg_on_tap", "when the screen is tapped", [], "Runs on every tap or click."),
  hat("jg_on_sprite_tap", "when %1 is tapped", [{ type: "field_variable", name: "SPRITE", variable: "sprite" }], "Runs when the sprite in this variable is tapped or clicked."),
  hat("jg_on_tick", "every frame", [], "Runs 60 times a second."),
  hat("jg_every", "every %1 seconds", [{ type: "field_number", name: "SECS", value: 1, min: 0.05, precision: 0.05 }], "Runs again and again on a timer."),

  // Sprites
  value("jg_new_emoji", "new sprite %1 at x %2 y %3 size %4", [{ type: "field_input", name: "LOOK", text: "🙂" }, num("X"), num("Y"), num("SIZE")], "Sprite", C.sprites, "Makes an emoji sprite. Put it in a variable."),
  value("jg_new_shape", "new %1 %2 at x %3 y %4 size %5", [{ type: "field_dropdown", name: "COLOR", options: COLORS }, { type: "field_dropdown", name: "SHAPE", options: [["circle", "circle"], ["square", "square"]] }, num("X"), num("Y"), num("SIZE")], "Sprite", C.sprites, "Makes a shape sprite. Put it in a variable."),
  step("jg_move_by", "move %1 by x %2 y %3", [sprite(), num("DX"), num("DY")], C.sprites, "Moves a sprite."),
  step("jg_move_to", "move %1 to x %2 y %3", [sprite(), num("X"), num("Y")], C.sprites, "Puts a sprite somewhere. The screen is 480 wide and 360 tall."),
  step("jg_set_prop", "set %1 of %2 to %3", [{ type: "field_dropdown", name: "PROP", options: PROPS }, sprite(), num("VALUE")], C.sprites, "Speeds move the sprite by that much every frame."),
  step("jg_change_prop", "change %1 of %2 by %3", [{ type: "field_dropdown", name: "PROP", options: PROPS }, sprite(), num("VALUE")], C.sprites, ""),
  value("jg_get_prop", "%1 of %2", [{ type: "field_dropdown", name: "PROP", options: PROPS }, sprite()], "Number", C.sprites, ""),
  step("jg_bounce", "bounce %1 off edges", [sprite()], C.sprites, "Turns the sprite's speed around when it reaches an edge."),
  step("jg_keep_on", "keep %1 on screen", [sprite()], C.sprites, "Stops a sprite going past the edges."),
  step("jg_set_look", "set look of %1 to %2", [sprite(), { type: "field_input", name: "LOOK", text: "😎" }], C.sprites, ""),
  step("jg_remove", "remove %1", [sprite()], C.sprites, "Takes the sprite off the screen for good."),
  step("jg_remove_look", "remove every %1", [{ type: "field_input", name: "LOOK", text: "☄️" }], C.sprites, "Removes every sprite with this look."),
  value("jg_touching", "%1 touching %2 ?", [sprite("A"), sprite("B")], "Boolean", C.sprites, ""),
  value("jg_touching_look", "%1 touching any %2 ?", [sprite(), { type: "field_input", name: "LOOK", text: "☄️" }], "Boolean", C.sprites, "True if the sprite touches any sprite with that look."),
  value("jg_touching_edge", "%1 touching edge?", [sprite()], "Boolean", C.sprites, ""),

  // Sensing
  value("jg_key_down", "key %1 down?", [{ type: "field_dropdown", name: "KEY", options: KEYS }], "Boolean", C.sensing, "True while the key is held."),
  value("jg_pointer_down", "finger or mouse down?", [], "Boolean", C.sensing, ""),
  value("jg_pointer", "finger %1", [{ type: "field_dropdown", name: "AXIS", options: [["x", "x"], ["y", "y"]] }], "Number", C.sensing, "Where the last touch or click was."),
  value("jg_timer", "seconds since start", [], "Number", C.sensing, ""),
  value("jg_screen", "screen %1", [{ type: "field_dropdown", name: "AXIS", options: [["width", "width"], ["height", "height"]] }], "Number", C.sensing, ""),

  // Game
  step("jg_set_score", "set score to %1", [num("VALUE")], C.game, ""),
  step("jg_change_score", "change score by %1", [num("VALUE")], C.game, ""),
  value("jg_score", "score", [], "Number", C.game, ""),
  step("jg_game_over", "game over", [], C.game, "Ends the round and saves the score."),
  step("jg_show_text", "show text %1", [any("TEXT")], C.game, "Shows a line of text at the top. Empty text hides it."),
  step("jg_background", "set background %1", [{ type: "field_dropdown", name: "COLOR", options: COLORS }], C.game, ""),
  {
    type: "jg_after",
    message0: "after %1 seconds %2 %3",
    args0: [num("SECS"), { type: "input_dummy" }, { type: "input_statement", name: "DO" }],
    previousStatement: null,
    nextStatement: null,
    colour: C.game,
    tooltip: "Waits, then runs the blocks inside. Everything else keeps going.",
  },

  // Multiplayer
  hat("jg_on_message", "when message %1 received", [{ type: "field_input", name: "NAME", text: "hello" }], "Runs when another player sends this message."),
  step("jg_send", "send message %1 with %2", [{ type: "field_input", name: "NAME", text: "hello" }, any("VALUE")], C.multi, "Sends a message to the other players."),
  value("jg_message_value", "message value", [], null, C.multi, "What came with the message."),
  value("jg_message_from", "message sender's player number", [], "Number", C.multi, ""),
  value("jg_is_host", "am I the host?", [], "Boolean", C.multi, "The host is player 1. Let the host run the shared parts of the game."),
  value("jg_online", "playing with friends?", [], "Boolean", C.multi, ""),
  value("jg_my_number", "my player number", [], "Number", C.multi, ""),
  value("jg_player_count", "number of players", [], "Number", C.multi, ""),
  value("jg_my_name", "my name", [], "String", C.multi, ""),
  step("jg_game_over_winner", "game over, winner is player %1", [num("WINNER")], C.multi, "Online: the host ends the game and names the winner."),
];

// Hats are colored like events but the multiplayer one belongs with its friends.
(BLOCKS.find((b) => b.type === "jg_on_message") as { colour: string }).colour = C.multi;

export const HATS = new Set(["jg_on_start", "jg_on_key", "jg_on_tap", "jg_on_sprite_tap", "jg_on_tick", "jg_every", "jg_on_message"]);

const shadowNum = (n: number) => ({ shadow: { type: "math_number", fields: { NUM: n } } });
const shadowText = (t: string) => ({ shadow: { type: "text", fields: { TEXT: t } } });
const spriteVar = (name: string) => ({ block: { type: "variables_get", fields: { VAR: { name } } } });

export const TOOLBOX = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Events",
      colour: C.events,
      contents: ["jg_on_start", "jg_on_key", "jg_on_tap", "jg_on_sprite_tap", "jg_on_tick", "jg_every"].map((type) => ({ kind: "block", type })),
    },
    {
      kind: "category",
      name: "Sprites",
      colour: C.sprites,
      contents: [
        { kind: "block", type: "variables_set", fields: { VAR: { name: "sprite" } }, inputs: { VALUE: { block: { type: "jg_new_emoji", inputs: { X: shadowNum(240), Y: shadowNum(180), SIZE: shadowNum(40) } } } } },
        { kind: "block", type: "jg_new_emoji", inputs: { X: shadowNum(240), Y: shadowNum(180), SIZE: shadowNum(40) } },
        { kind: "block", type: "jg_new_shape", inputs: { X: shadowNum(240), Y: shadowNum(180), SIZE: shadowNum(30) } },
        { kind: "block", type: "jg_move_by", inputs: { SPRITE: spriteVar("sprite"), DX: shadowNum(5), DY: shadowNum(0) } },
        { kind: "block", type: "jg_move_to", inputs: { SPRITE: spriteVar("sprite"), X: shadowNum(240), Y: shadowNum(180) } },
        { kind: "block", type: "jg_set_prop", inputs: { SPRITE: spriteVar("sprite"), VALUE: shadowNum(0) } },
        { kind: "block", type: "jg_change_prop", inputs: { SPRITE: spriteVar("sprite"), VALUE: shadowNum(5) } },
        { kind: "block", type: "jg_get_prop", inputs: { SPRITE: spriteVar("sprite") } },
        { kind: "block", type: "jg_bounce", inputs: { SPRITE: spriteVar("sprite") } },
        { kind: "block", type: "jg_keep_on", inputs: { SPRITE: spriteVar("sprite") } },
        { kind: "block", type: "jg_set_look", inputs: { SPRITE: spriteVar("sprite") } },
        { kind: "block", type: "jg_touching", inputs: { A: spriteVar("sprite") } },
        { kind: "block", type: "jg_touching_look", inputs: { SPRITE: spriteVar("sprite") } },
        { kind: "block", type: "jg_touching_edge", inputs: { SPRITE: spriteVar("sprite") } },
        { kind: "block", type: "jg_remove", inputs: { SPRITE: spriteVar("sprite") } },
        { kind: "block", type: "jg_remove_look" },
      ],
    },
    {
      kind: "category",
      name: "Sensing",
      colour: C.sensing,
      contents: ["jg_key_down", "jg_pointer_down", "jg_pointer", "jg_timer", "jg_screen"].map((type) => ({ kind: "block", type })),
    },
    {
      kind: "category",
      name: "Game",
      colour: C.game,
      contents: [
        { kind: "block", type: "jg_set_score", inputs: { VALUE: shadowNum(0) } },
        { kind: "block", type: "jg_change_score", inputs: { VALUE: shadowNum(1) } },
        { kind: "block", type: "jg_score" },
        { kind: "block", type: "jg_game_over" },
        { kind: "block", type: "jg_show_text", inputs: { TEXT: shadowText("Hello!") } },
        { kind: "block", type: "jg_background" },
        { kind: "block", type: "jg_after", inputs: { SECS: shadowNum(1) } },
        { kind: "block", type: "math_random_int", inputs: { FROM: shadowNum(1), TO: shadowNum(10) } },
      ],
    },
    {
      kind: "category",
      name: "Multiplayer",
      colour: C.multi,
      contents: [
        { kind: "block", type: "jg_on_message" },
        { kind: "block", type: "jg_send", inputs: { VALUE: shadowNum(0) } },
        ...["jg_message_value", "jg_message_from", "jg_is_host", "jg_online", "jg_my_number", "jg_player_count", "jg_my_name"].map((type) => ({ kind: "block", type })),
        { kind: "block", type: "jg_game_over_winner", inputs: { WINNER: shadowNum(1) } },
      ],
    },
    { kind: "sep" },
    {
      kind: "category",
      name: "Logic",
      categorystyle: "logic_category",
      contents: ["controls_if", "logic_compare", "logic_operation", "logic_negate", "logic_boolean"].map((type) => ({ kind: "block", type })),
    },
    {
      kind: "category",
      name: "Loops",
      categorystyle: "loop_category",
      contents: [
        { kind: "block", type: "controls_repeat_ext", inputs: { TIMES: shadowNum(10) } },
        { kind: "block", type: "controls_whileUntil" },
        { kind: "block", type: "controls_for", inputs: { FROM: shadowNum(1), TO: shadowNum(10), BY: shadowNum(1) } },
        { kind: "block", type: "controls_flow_statements" },
      ],
    },
    {
      kind: "category",
      name: "Math",
      categorystyle: "math_category",
      contents: [
        { kind: "block", type: "math_number" },
        { kind: "block", type: "math_arithmetic", inputs: { A: shadowNum(1), B: shadowNum(1) } },
        { kind: "block", type: "math_random_int", inputs: { FROM: shadowNum(1), TO: shadowNum(10) } },
        { kind: "block", type: "math_round", inputs: { NUM: shadowNum(3.1) } },
        { kind: "block", type: "math_single", inputs: { NUM: shadowNum(9) } },
        { kind: "block", type: "math_modulo", inputs: { DIVIDEND: shadowNum(64), DIVISOR: shadowNum(10) } },
      ],
    },
    {
      kind: "category",
      name: "Text",
      categorystyle: "text_category",
      contents: [{ kind: "block", type: "text" }, { kind: "block", type: "text_join" }],
    },
    { kind: "category", name: "Variables", categorystyle: "variable_category", custom: "VARIABLE" },
  ],
};

// ---------- Code generation ----------

function defineGenerators(js: JsModule) {
  const { javascriptGenerator: gen, Order } = js;
  const v = (b: Block, g: CodeGenerator, name: string, fallback = "0") => g.valueToCode(b, name, Order.NONE) || fallback;
  const sp = (b: Block, g: CodeGenerator, name = "SPRITE") => v(b, g, name, "null");
  const f = (b: Block, name: string) => JSON.stringify(String(b.getFieldValue(name) ?? ""));
  const body = (b: Block, g: CodeGenerator) => g.statementToCode(b, "DO");
  const set = (type: string, fn: (b: Block, g: CodeGenerator) => string | [string, number]) => {
    gen.forBlock[type] = fn as unknown as (typeof gen.forBlock)[string];
  };

  set("jg_on_start", (b, g) => `$g.onStart(function () {\n${body(b, g)}});\n`);
  set("jg_on_key", (b, g) => `$g.onKey(${f(b, "KEY")}, function () {\n${body(b, g)}});\n`);
  set("jg_on_tap", (b, g) => `$g.onTap(function () {\n${body(b, g)}});\n`);
  set("jg_on_sprite_tap", (b, g) => {
    const name = g.getVariableName(b.getFieldValue("SPRITE"));
    return `$g.onSpriteTap(function () { return ${name}; }, function () {\n${body(b, g)}});\n`;
  });
  set("jg_on_tick", (b, g) => `$g.onTick(function () {\n${body(b, g)}});\n`);
  set("jg_every", (b, g) => `$g.every(${Number(b.getFieldValue("SECS")) || 1}, function () {\n${body(b, g)}});\n`);
  set("jg_on_message", (b, g) => `$g.onMessage(${f(b, "NAME")}, function () {\n${body(b, g)}});\n`);

  set("jg_new_emoji", (b, g) => [`$g.sprite(${f(b, "LOOK")}, ${v(b, g, "X", "240")}, ${v(b, g, "Y", "180")}, ${v(b, g, "SIZE", "40")})`, Order.FUNCTION_CALL]);
  set("jg_new_shape", (b, g) => [`$g.shape(${f(b, "SHAPE")}, ${f(b, "COLOR")}, ${v(b, g, "X", "240")}, ${v(b, g, "Y", "180")}, ${v(b, g, "SIZE", "30")})`, Order.FUNCTION_CALL]);
  set("jg_move_by", (b, g) => `$g.moveBy(${sp(b, g)}, ${v(b, g, "DX")}, ${v(b, g, "DY")});\n`);
  set("jg_move_to", (b, g) => `$g.moveTo(${sp(b, g)}, ${v(b, g, "X")}, ${v(b, g, "Y")});\n`);
  set("jg_set_prop", (b, g) => `$g.set(${sp(b, g)}, ${f(b, "PROP")}, ${v(b, g, "VALUE")});\n`);
  set("jg_change_prop", (b, g) => `$g.change(${sp(b, g)}, ${f(b, "PROP")}, ${v(b, g, "VALUE")});\n`);
  set("jg_get_prop", (b, g) => [`$g.get(${sp(b, g)}, ${f(b, "PROP")})`, Order.FUNCTION_CALL]);
  set("jg_bounce", (b, g) => `$g.bounce(${sp(b, g)});\n`);
  set("jg_keep_on", (b, g) => `$g.keepOn(${sp(b, g)});\n`);
  set("jg_set_look", (b, g) => `$g.setLook(${sp(b, g)}, ${f(b, "LOOK")});\n`);
  set("jg_remove", (b, g) => `$g.remove(${sp(b, g)});\n`);
  set("jg_remove_look", (b) => `$g.removeLook(${f(b, "LOOK")});\n`);
  set("jg_touching", (b, g) => [`$g.touching(${sp(b, g, "A")}, ${sp(b, g, "B")})`, Order.FUNCTION_CALL]);
  set("jg_touching_look", (b, g) => [`$g.touchingLook(${sp(b, g)}, ${f(b, "LOOK")})`, Order.FUNCTION_CALL]);
  set("jg_touching_edge", (b, g) => [`$g.touchingEdge(${sp(b, g)})`, Order.FUNCTION_CALL]);

  set("jg_key_down", (b) => [`$g.keyDown(${f(b, "KEY")})`, Order.FUNCTION_CALL]);
  set("jg_pointer_down", () => ["$g.pointerDown()", Order.FUNCTION_CALL]);
  set("jg_pointer", (b) => [`$g.pointer(${f(b, "AXIS")})`, Order.FUNCTION_CALL]);
  set("jg_timer", () => ["$g.time()", Order.FUNCTION_CALL]);
  set("jg_screen", (b) => [`$g.screen(${f(b, "AXIS")})`, Order.FUNCTION_CALL]);

  set("jg_set_score", (b, g) => `$g.setScore(${v(b, g, "VALUE")});\n`);
  set("jg_change_score", (b, g) => `$g.changeScore(${v(b, g, "VALUE")});\n`);
  set("jg_score", () => ["$g.score()", Order.FUNCTION_CALL]);
  set("jg_game_over", () => "$g.gameOver();\n");
  set("jg_show_text", (b, g) => `$g.showText(${v(b, g, "TEXT", "''")});\n`);
  set("jg_background", (b) => `$g.background(${f(b, "COLOR")});\n`);
  set("jg_after", (b, g) => `$g.after(${v(b, g, "SECS", "1")}, function () {\n${body(b, g)}});\n`);

  set("jg_send", (b, g) => `$g.send(${f(b, "NAME")}, ${v(b, g, "VALUE", "null")});\n`);
  set("jg_message_value", () => ["$g.messageValue()", Order.FUNCTION_CALL]);
  set("jg_message_from", () => ["$g.messageFrom()", Order.FUNCTION_CALL]);
  set("jg_is_host", () => ["$g.isHost()", Order.FUNCTION_CALL]);
  set("jg_online", () => ["$g.online()", Order.FUNCTION_CALL]);
  set("jg_my_number", () => ["$g.myNumber()", Order.FUNCTION_CALL]);
  set("jg_player_count", () => ["$g.playerCount()", Order.FUNCTION_CALL]);
  set("jg_my_name", () => ["$g.myName()", Order.FUNCTION_CALL]);
  set("jg_game_over_winner", (b, g) => `$g.gameOver(${v(b, g, "WINNER", "1")});\n`);

  // Loops can't freeze the game: each event gets a budget of steps.
  gen.INFINITE_LOOP_TRAP = "$g.loop();\n";
  gen.addReservedWords("$g,jace");
}

export type BlocklyKit = { Blockly: B; js: JsModule };

let kit: Promise<BlocklyKit> | null = null;
/** Loads Blockly (in the browser only) and defines the game blocks once. */
export function loadBlockly(): Promise<BlocklyKit> {
  return (kit ??= (async () => {
    const Blockly = await import("blockly/core");
    await import("blockly/blocks");
    const en = await import("blockly/msg/en");
    const js = await import("blockly/javascript");
    Blockly.setLocale(en as unknown as Record<string, string>);
    Blockly.common.defineBlocksWithJsonArray(BLOCKS);
    defineGenerators(js);
    return { Blockly, js };
  })());
}

/** JavaScript for the workspace's event blocks. */
export function workspaceCode(k: BlocklyKit, ws: BlocklyType.Workspace): string {
  const gen = k.js.javascriptGenerator;
  gen.init(ws);
  gen.isInitialized = true;
  let code = "";
  for (const block of ws.getTopBlocks(true)) {
    if (HATS.has(block.type) && block.isEnabled()) code += gen.blockToCode(block) + "\n";
  }
  return gen.finish(code).trim();
}

/** A whole game document from generated code. */
export function blocksHtml(code: string): string {
  return `${BLOCK_RUNTIME}<script>\n// Your game, made with blocks.\n${code.replace(/<\/script/gi, "<\\/script")}\n</script>\n`;
}

/** Compiles saved blocks (without showing an editor), e.g. for a new game from a template. */
export async function compileBlocks(json: object): Promise<string> {
  const k = await loadBlockly();
  const ws = new k.Blockly.Workspace();
  try {
    k.Blockly.serialization.workspaces.load(json, ws);
    return blocksHtml(workspaceCode(k, ws));
  } finally {
    ws.dispose();
  }
}

const themes = new Map<string, BlocklyType.Theme>();
export function blocklyTheme(Blockly: B, dark: boolean): BlocklyType.Theme {
  const name = dark ? "jace-games-dark" : "jace-games-light";
  if (themes.has(name)) return themes.get(name)!;
  const theme = Blockly.Theme.defineTheme(name, {
    name,
    base: Blockly.Themes.Classic,
    componentStyles: dark
      ? {
          workspaceBackgroundColour: "#111317",
          toolboxBackgroundColour: "#16181d",
          toolboxForegroundColour: "#e6e8eb",
          flyoutBackgroundColour: "#1c1f26",
          flyoutForegroundColour: "#e6e8eb",
          flyoutOpacity: 1,
          scrollbarColour: "#3a404b",
          insertionMarkerColour: "#ffffff",
          insertionMarkerOpacity: 0.3,
          cursorColour: "#d0d0d0",
        }
      : {
          workspaceBackgroundColour: "#f4f5f7",
          toolboxBackgroundColour: "#ffffff",
          toolboxForegroundColour: "#16181d",
          flyoutBackgroundColour: "#eceef1",
          flyoutForegroundColour: "#16181d",
          flyoutOpacity: 1,
          scrollbarColour: "#c3c8d0",
        },
    fontStyle: { family: "system-ui, sans-serif", weight: "600", size: 12 },
  });
  themes.set(name, theme);
  return theme;
}
