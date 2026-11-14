"use client";

import type { SeasonId } from "@/lib/seasons";

/**
 * Big trees in the bottom corners of the page, dressed for the theme:
 * maples in fall, a lit-up tree at Christmas, a spooky bare tree at
 * Halloween, blossoms in spring, palms in summer, snowy pines in winter.
 * They sway, sit behind everything and never get in the way of clicks.
 */

type Kind = "round" | "pine" | "bare" | "palm";
type Tree = { kind: Kind; leaves: string[]; trunk: string; lights?: boolean; snow?: boolean; star?: boolean; extra?: string };

const TREES: Partial<Record<SeasonId, [Tree, Tree]>> = {
  fall: [
    { kind: "round", leaves: ["#ea580c", "#dc2626", "#f59e0b"], trunk: "#7c4a21", extra: "🍁" },
    { kind: "round", leaves: ["#f59e0b", "#d97706", "#b91c1c"], trunk: "#6b3f1d", extra: "🍂" },
  ],
  thanksgiving: [
    { kind: "round", leaves: ["#d97706", "#b45309", "#dc2626"], trunk: "#6b3f1d", extra: "🦃" },
    { kind: "round", leaves: ["#f59e0b", "#ea580c", "#92400e"], trunk: "#7c4a21", extra: "🌽" },
  ],
  halloween: [
    { kind: "bare", leaves: ["#3b0764"], trunk: "#1f1530", extra: "🦇" },
    { kind: "bare", leaves: ["#3b0764"], trunk: "#2a1d3d", extra: "🎃" },
  ],
  christmas: [
    { kind: "pine", leaves: ["#166534", "#15803d", "#14532d"], trunk: "#5b3a1e", lights: true, star: true, snow: true },
    { kind: "pine", leaves: ["#15803d", "#166534", "#14532d"], trunk: "#5b3a1e", lights: true, snow: true, extra: "🎁" },
  ],
  winter: [
    { kind: "pine", leaves: ["#1e5a4a", "#24705c", "#174a3d"], trunk: "#4b3621", snow: true },
    { kind: "pine", leaves: ["#24705c", "#1e5a4a", "#174a3d"], trunk: "#4b3621", snow: true, extra: "⛄" },
  ],
  newyear: [
    { kind: "pine", leaves: ["#1e3a5f", "#1e40af", "#172554"], trunk: "#3f3f46", lights: true, star: true },
    { kind: "pine", leaves: ["#1e40af", "#1e3a5f", "#172554"], trunk: "#3f3f46", lights: true, extra: "🥂" },
  ],
  valentines: [
    { kind: "round", leaves: ["#f472b6", "#fb7185", "#f9a8d4"], trunk: "#7c3a4a", extra: "💖" },
    { kind: "round", leaves: ["#fb7185", "#f472b6", "#fda4af"], trunk: "#7c3a4a", extra: "🌹" },
  ],
  stpatricks: [
    { kind: "round", leaves: ["#16a34a", "#22c55e", "#15803d"], trunk: "#5b3a1e", extra: "🍀" },
    { kind: "round", leaves: ["#22c55e", "#16a34a", "#4ade80"], trunk: "#5b3a1e", extra: "🪙" },
  ],
  spring: [
    { kind: "round", leaves: ["#f9a8d4", "#fbcfe8", "#f472b6"], trunk: "#6b4226", extra: "🌸" },
    { kind: "round", leaves: ["#fbcfe8", "#f9a8d4", "#fda4af"], trunk: "#6b4226", extra: "🐦" },
  ],
  easter: [
    { kind: "round", leaves: ["#bbf7d0", "#fbcfe8", "#ddd6fe"], trunk: "#6b4226", extra: "🥚" },
    { kind: "round", leaves: ["#fde68a", "#bbf7d0", "#fbcfe8"], trunk: "#6b4226", extra: "🐰" },
  ],
  earth: [
    { kind: "round", leaves: ["#16a34a", "#22c55e", "#15803d"], trunk: "#5b3a1e", extra: "🐦" },
    { kind: "pine", leaves: ["#166534", "#15803d", "#14532d"], trunk: "#5b3a1e", extra: "🦊" },
  ],
  summer: [
    { kind: "palm", leaves: ["#16a34a", "#22c55e"], trunk: "#a16207", extra: "🥥" },
    { kind: "palm", leaves: ["#22c55e", "#15803d"], trunk: "#a16207", extra: "🦜" },
  ],
  july4: [
    { kind: "round", leaves: ["#16a34a", "#22c55e", "#15803d"], trunk: "#5b3a1e", extra: "🇺🇸" },
    { kind: "round", leaves: ["#22c55e", "#16a34a", "#15803d"], trunk: "#5b3a1e", extra: "🎆" },
  ],
  school: [
    { kind: "round", leaves: ["#65a30d", "#ca8a04", "#16a34a"], trunk: "#6b4226", extra: "🍎" },
    { kind: "round", leaves: ["#16a34a", "#65a30d", "#ca8a04"], trunk: "#6b4226", extra: "🎒" },
  ],
  lunar: [
    { kind: "round", leaves: ["#f9a8d4", "#fbcfe8", "#fecaca"], trunk: "#4b2e1e", extra: "🏮" },
    { kind: "round", leaves: ["#fecaca", "#f9a8d4", "#fbcfe8"], trunk: "#4b2e1e", extra: "🧧" },
  ],
  candy: [
    { kind: "round", leaves: ["#f472b6", "#a78bfa", "#fde68a"], trunk: "#be185d", extra: "🍭" },
    { kind: "round", leaves: ["#a78bfa", "#f472b6", "#99f6e4"], trunk: "#be185d", extra: "🧁" },
  ],
  ocean: [
    { kind: "palm", leaves: ["#0d9488", "#14b8a6"], trunk: "#a16207", extra: "🐚" },
    { kind: "palm", leaves: ["#14b8a6", "#0d9488"], trunk: "#a16207", extra: "🦀" },
  ],
  space: [
    { kind: "bare", leaves: ["#6d28d9"], trunk: "#4c1d95", extra: "🛸" },
    { kind: "bare", leaves: ["#6d28d9"], trunk: "#4c1d95", extra: "👽" },
  ],
  neon: [
    { kind: "palm", leaves: ["#e879f9", "#22d3ee"], trunk: "#7e22ce", extra: "🌴" },
    { kind: "palm", leaves: ["#22d3ee", "#e879f9"], trunk: "#7e22ce", extra: "🎧" },
  ],
  retro: [
    { kind: "pine", leaves: ["#4d7c0f", "#65a30d", "#3f6212"], trunk: "#57534e", extra: "👾" },
    { kind: "pine", leaves: ["#65a30d", "#4d7c0f", "#3f6212"], trunk: "#57534e", extra: "🕹️" },
  ],
};

const BULBS = ["#ef4444", "#facc15", "#22c55e", "#3b82f6", "#f472b6"];

function TreeSvg({ t, flip }: { t: Tree; flip: boolean }) {
  return (
    <svg viewBox="0 0 200 260" className="h-full w-auto" style={{ transform: flip ? "scaleX(-1)" : undefined }} aria-hidden="true">
      {t.kind === "round" && (
        <>
          <path d="M92 260 L96 150 Q98 130 86 112 L96 116 L100 96 L104 116 L116 108 Q104 130 106 150 L110 260 Z" fill={t.trunk} />
          {[
            [100, 78, 62, 0],
            [56, 110, 46, 1],
            [146, 108, 48, 2],
            [74, 58, 42, 1],
            [128, 56, 44, 0],
            [100, 126, 40, 2],
          ].map(([x, y, r, c], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={t.leaves[c % t.leaves.length]} opacity={0.95} />
          ))}
          {[
            [70, 80],
            [130, 90],
            [100, 50],
            [150, 130],
            [52, 130],
          ].map(([x, y], i) => (
            <circle key={`h${i}`} cx={x} cy={y} r={7} fill="#fff" opacity={0.18} />
          ))}
        </>
      )}
      {t.kind === "pine" && (
        <>
          <rect x="92" y="215" width="16" height="45" fill={t.trunk} />
          {[
            [100, 20, 46, 90],
            [100, 70, 66, 145],
            [100, 120, 86, 205],
            [100, 160, 98, 235],
          ].map(([x, top, half, bottom], i) => (
            <path key={i} d={`M${x} ${top} L${x + half} ${bottom} L${x - half} ${bottom} Z`} fill={t.leaves[i % t.leaves.length]} />
          ))}
          {t.snow &&
            [
              [100, 20, 30, 50],
              [100, 70, 44, 104],
              [100, 120, 58, 160],
            ].map(([x, top, half, bottom], i) => <path key={`s${i}`} d={`M${x} ${top} L${x + half * 0.5} ${bottom - 8} Q${x} ${bottom} ${x - half * 0.5} ${bottom - 8} Z`} fill="#fff" opacity={0.85} />)}
          {t.lights &&
            Array.from({ length: 16 }, (_, i) => {
              const row = Math.floor(i / 4);
              const y = 95 + row * 38;
              const span = 30 + row * 18;
              const x = 100 - span + ((i % 4) + 0.5) * ((span * 2) / 4);
              return <circle key={`l${i}`} className="jl-bulb" cx={x} cy={y + ((i * 7) % 12)} r={5} fill={BULBS[i % BULBS.length]} style={{ animationDelay: `${(i % 5) * 0.3}s` }} />;
            })}
          {t.star && <text x="100" y="30" textAnchor="middle" fontSize="34">⭐</text>}
        </>
      )}
      {t.kind === "bare" && (
        <g stroke={t.trunk} strokeLinecap="round" fill="none">
          <path d="M100 260 Q96 180 104 120" strokeWidth="20" />
          <path d="M102 170 Q70 140 40 120" strokeWidth="9" />
          <path d="M104 150 Q140 120 170 110" strokeWidth="9" />
          <path d="M104 120 Q90 80 70 50" strokeWidth="7" />
          <path d="M104 120 Q120 80 140 40" strokeWidth="7" />
          <path d="M60 128 Q50 105 32 96" strokeWidth="4" />
          <path d="M150 116 Q165 95 182 92" strokeWidth="4" />
          <path d="M78 64 Q60 52 52 30" strokeWidth="3" />
          <path d="M132 54 Q150 40 156 22" strokeWidth="3" />
        </g>
      )}
      {t.kind === "palm" && (
        <>
          <path d="M96 260 Q90 180 110 80 L118 82 Q102 180 110 260 Z" fill={t.trunk} />
          {[
            "M114 82 Q150 50 196 70 Q150 64 114 90",
            "M114 82 Q80 40 30 52 Q80 58 112 92",
            "M114 82 Q150 90 180 140 Q140 100 112 92",
            "M114 82 Q76 96 42 140 Q84 100 112 94",
            "M114 82 Q118 40 100 8 Q124 44 118 86",
          ].map((d, i) => (
            <path key={i} d={d} fill={t.leaves[i % t.leaves.length]} />
          ))}
        </>
      )}
      {t.extra && (
        <text x={t.kind === "bare" ? 150 : 150} y={t.kind === "bare" ? 135 : 230} fontSize="30" textAnchor="middle" className={t.kind === "bare" ? "jl-dangle" : undefined}>
          {t.extra}
        </text>
      )}
    </svg>
  );
}

export function Corners({ season }: { season: SeasonId }) {
  const pair = TREES[season];
  if (!pair) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 -z-[5] hidden h-[34vh] max-h-[340px] min-h-48 justify-between sm:flex">
      <div className="jl-tree h-full origin-bottom" style={{ marginLeft: "-28px" }}>
        <TreeSvg t={pair[0]} flip={false} />
      </div>
      <div className="jl-tree h-full origin-bottom" style={{ marginRight: "-28px", animationDelay: "1.3s" }}>
        <TreeSvg t={pair[1]} flip />
      </div>
    </div>
  );
}
