"use client";

import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { html } from "@codemirror/lang-html";
import { Compartment, EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, keymap } from "@codemirror/view";
import { useDarkMode } from "./ui";

const fill = EditorView.theme({
  "&": { height: "100%", fontSize: "13px" },
  ".cm-scroller": { fontFamily: "var(--font-geist-mono), ui-monospace, monospace" },
});
const light = EditorView.theme({ "&": { backgroundColor: "var(--panel)" }, ".cm-gutters": { backgroundColor: "var(--panel)", border: "none" } }, { dark: false });

/**
 * CodeMirror 6 with HTML (and the JavaScript and CSS inside it), matching
 * the site's light or dark theme. `value` only replaces the text when it
 * changes from outside (restoring a version); typing reports through onChange.
 */
export function CodeEditor({ value, onChange, onSave }: { value: string; onChange: (v: string) => void; onSave?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const theme = useRef(new Compartment());
  const dark = useDarkMode();
  const cbs = useRef({ onChange, onSave });
  useEffect(() => {
    cbs.current = { onChange, onSave };
  });

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          html(),
          keymap.of([indentWithTab, { key: "Mod-s", preventDefault: true, run: () => (cbs.current.onSave?.(), true) }]),
          fill,
          theme.current.of(oneDark),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) cbs.current.onChange(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // The editor is made once; later values are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: theme.current.reconfigure(dark ? oneDark : light) });
  }, [dark]);

  return <div ref={host} className="h-full min-h-0 overflow-hidden rounded-xl border border-line" />;
}
