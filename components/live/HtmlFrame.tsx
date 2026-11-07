"use client";

import { useEffect, useMemo, useRef } from "react";
import { GAME_CSP } from "@/lib/studio/sandbox";

/**
 * A set creator's custom HTML, run like a community game: an iframe with
 * sandbox="allow-scripts" only (never allow-same-origin), behind a CSP that
 * blocks every network request. Inside, `jace.answer(value)` submits an
 * answer (a short string) and `jace.locked` says whether answering is over.
 * Messages are only accepted from this frame's own window.
 */
const SDK = `(function(){
"use strict";
var P = window.parent, locked = __LOCKED__, handlers = [];
function post(m){ m.__jaceLive = 1; try { P.postMessage(m, "*"); } catch (e) {} }
window.addEventListener("message", function(e){
  if (e.source !== P || !e.data || e.data.__jaceLive !== 1) return;
  if (e.data.type === "lock") { locked = true; handlers.forEach(function(f){ try { f(); } catch (x) {} }); }
});
var jace = {
  answer: function(v){ if (locked) return; post({ type: "answer", value: String(v).slice(0, 200) }); },
  get locked(){ return locked; },
  onLock: function(f){ if (typeof f === "function") handlers.push(f); },
  onReady: function(cb){ if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ cb(jace); }); else setTimeout(function(){ cb(jace); }, 0); }
};
Object.defineProperty(window, "jace", { value: jace, writable: false, configurable: false });
})();`;

const BASE_STYLE = `<style>html,body{margin:0;font-family:system-ui,sans-serif;color:#e6e8eb;background:#1c1f26}body{padding:12px}</style>`;

export function HtmlFrame({
  html,
  onAnswer,
  locked = false,
  title,
  height = 260,
}: {
  html: string;
  onAnswer?: (value: string) => void;
  locked?: boolean;
  title: string;
  height?: number;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const cb = useRef(onAnswer);
  useEffect(() => {
    cb.current = onAnswer;
  });

  // Rebuild only when the HTML changes; locking is sent as a message.
  const srcdoc = useMemo(
    () =>
      `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${GAME_CSP}">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">${BASE_STYLE}<script>${SDK.replace("__LOCKED__", "false")}</script></head><body>${html}</body></html>`,
    [html],
  );

  useEffect(() => {
    let last = 0;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const m = e.data as { __jaceLive?: number; type?: string; value?: unknown };
      if (m?.__jaceLive !== 1 || m.type !== "answer" || typeof m.value !== "string") return;
      const now = Date.now();
      if (now - last < 300) return; // one answer at a time
      last = now;
      cb.current?.(m.value.slice(0, 200));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (locked) ref.current?.contentWindow?.postMessage({ __jaceLive: 1, type: "lock" }, "*");
  }, [locked]);

  return (
    <iframe
      ref={ref}
      title={title}
      sandbox="allow-scripts"
      srcDoc={srcdoc}
      className="w-full rounded-xl border border-line bg-panel"
      style={{ height }}
    />
  );
}

/** A starting point for custom-HTML questions in the editor. */
export const HTML_TEMPLATE = `<p style="font-size:20px">Drag the slider to 42, then press Submit.</p>
<input id="v" type="range" min="0" max="100" value="50" style="width:100%">
<p>Value: <b id="out">50</b></p>
<button id="go" style="font-size:18px;padding:8px 16px">Submit</button>
<script>
  const v = document.getElementById("v"), out = document.getElementById("out");
  v.oninput = () => (out.textContent = v.value);
  document.getElementById("go").onclick = () => jace.answer(v.value);
  jace.onLock(() => (document.getElementById("go").disabled = true));
</script>`;
