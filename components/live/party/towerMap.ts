import { DEVICES, THEMES, type TowerMap } from "@/lib/live/maps";

/** Draws a Tower Siege map's ground, road, gate, castle and decorations. Used by the game and the map maker. */
export function drawMapBase(ctx: CanvasRenderingContext2D, map: TowerMap, cell: number, opts: { grid?: boolean } = {}) {
  const t = THEMES[map.theme];
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      ctx.fillStyle = t.grass[(x + y) % 2];
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  // The road: a thick rounded line through the cell centers, with a darker edge.
  if (map.path.length) {
    const line = (width: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      map.path.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, (x + 0.5) * cell, (y + 0.5) * cell));
      if (map.path.length === 1) ctx.lineTo((map.path[0][0] + 0.5) * cell + 0.01, (map.path[0][1] + 0.5) * cell);
      ctx.stroke();
    };
    line(cell * 0.92, t.edge);
    line(cell * 0.72, t.road);
  }
  if (opts.grid) {
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 1;
    for (let x = 1; x < map.cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cell, 0);
      ctx.lineTo(x * cell, map.rows * cell);
      ctx.stroke();
    }
    for (let y = 1; y < map.rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cell);
      ctx.lineTo(map.cols * cell, y * cell);
      ctx.stroke();
    }
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${cell * 0.62}px sans-serif`;
  for (const d of map.decor) ctx.fillText(d.icon, (d.x + 0.5) * cell, (d.y + 0.55) * cell);
  // Devices: road ones sit flat on the road, ground ones on a little plinth.
  for (const d of map.devices ?? []) {
    const cx = (d.x + 0.5) * cell;
    const cy = (d.y + 0.5) * cell;
    const def = DEVICES[d.kind];
    if (d.kind === "mud") {
      ctx.fillStyle = "rgba(92,58,30,0.75)";
      ctx.beginPath();
      ctx.ellipse(cx, cy, cell * 0.4, cell * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    if (def.on === "ground") {
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + cell * 0.28, cell * 0.32, cell * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = `${cell * (def.on === "road" ? 0.5 : 0.6)}px sans-serif`;
    ctx.fillText(def.icon, cx, cy + cell * 0.04);
    if (d.kind === "zone" && d.channel) {
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${cell * 0.3}px sans-serif`;
      ctx.fillText(String(d.channel), cx + cell * 0.28, cy - cell * 0.26);
    }
  }
  if (map.path.length) {
    const [gx, gy] = map.path[0];
    ctx.font = `${cell * 0.6}px sans-serif`;
    ctx.fillText("🚪", (gx + 0.5) * cell, (gy + 0.55) * cell);
    if (map.path.length > 1) {
      const [cx, cy] = map.path[map.path.length - 1];
      ctx.font = `${cell * 0.8}px sans-serif`;
      ctx.fillText("🏰", (cx + 0.5) * cell, (cy + 0.5) * cell);
    }
  }
}
