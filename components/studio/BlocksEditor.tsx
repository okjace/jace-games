"use client";

import { useEffect, useRef, useState } from "react";
import type { WorkspaceSvg } from "blockly/core";
import { TOOLBOX, blocklyTheme, blocksHtml, loadBlockly, workspaceCode } from "@/lib/studio/blocks";
import { useDarkMode } from "./ui";

/**
 * The blocks editor: Blockly with the Scratch-like "zelos" look and the
 * game blocks from lib/studio/blocks.ts. Every change is saved to the
 * workspace JSON and compiled to a game document, both handed to onChange.
 * Remount it (change its key) to load different blocks.
 */
export function BlocksEditor({ initial, onChange }: { initial: object | null; onChange: (json: object, html: string, code: string, initial: boolean) => void }) {
  const div = useRef<HTMLDivElement>(null);
  const ws = useRef<WorkspaceSvg | null>(null);
  const [status, setStatus] = useState("Loading the blocks…");
  const dark = useDarkMode();
  const darkRef = useRef(dark);
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ro: ResizeObserver | undefined;
    (async () => {
      const kit = await loadBlockly();
      const { Blockly } = kit;
      if (disposed || !div.current) return;
      const w = Blockly.inject(div.current, {
        toolbox: TOOLBOX,
        renderer: "zelos",
        theme: blocklyTheme(Blockly, darkRef.current),
        trashcan: true,
        sounds: false,
        zoom: { controls: true, wheel: true, startScale: 0.75, maxScale: 2, minScale: 0.3 },
        grid: { spacing: 24, length: 2, colour: darkRef.current ? "#2a2f38" : "#dfe2e7", snap: true },
        move: { scrollbars: true, drag: true, wheel: false },
      });
      ws.current = w;
      if (initial) {
        // Loading isn't an edit, so it doesn't fire change events.
        Blockly.Events.disable();
        try {
          Blockly.serialization.workspaces.load(initial, w);
        } catch (e) {
          setStatus(`Some blocks couldn't be loaded: ${(e as Error).message}`);
        } finally {
          Blockly.Events.enable();
        }
      }
      const emit = (first = false) => {
        const code = workspaceCode(kit, w);
        cb.current(Blockly.serialization.workspaces.save(w), blocksHtml(code), code, first);
      };
      emit(true);
      w.addChangeListener((ev) => {
        if (ev.isUiEvent) return;
        clearTimeout(timer);
        timer = setTimeout(() => emit(), 300);
      });
      ro = new ResizeObserver(() => Blockly.svgResize(w));
      ro.observe(div.current);
      setStatus((s) => (s.startsWith("Loading") ? "" : s));
    })().catch((e) => setStatus(`The blocks editor couldn't load: ${(e as Error).message}`));
    return () => {
      disposed = true;
      clearTimeout(timer);
      ro?.disconnect();
      ws.current?.dispose();
      ws.current = null;
    };
    // Loaded once per mount; the parent remounts to load other blocks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    darkRef.current = dark;
    const w = ws.current;
    if (!w) return;
    void loadBlockly().then(({ Blockly }) => w.setTheme(blocklyTheme(Blockly, dark)));
  }, [dark]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-xl border border-line">
      <div ref={div} className="absolute inset-0" />
      {status && <p className="absolute left-3 top-3 rounded-full bg-panel px-3 py-1 text-xs text-muted shadow">{status}</p>}
    </div>
  );
}
