"use client";

/**
 * Canvas effects for the solo games: particle bursts, floating text and
 * screen shake. Games keep one of each in a ref, call `update(dt)` every
 * frame and `draw(ctx)` after drawing the board. Sounds come from the Live
 * sound kit (components/live/fx/sfx), which shares the mute button.
 */

export { sfx, haptic } from "@/components/live/fx/sfx";

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; gravity: number };
type Floater = { x: number; y: number; text: string; color: string; life: number; size: number };

export class Fx {
  private parts: Particle[] = [];
  private floaters: Floater[] = [];
  private shakeT = 0;
  private shakeAmt = 0;

  /** A burst of particles from a point. */
  burst(x: number, y: number, color: string | string[], n = 14, speed = 170, gravity = 260, size = 3) {
    const colors = Array.isArray(color) ? color : [color];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.75);
      const life = 0.45 + Math.random() * 0.45;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.25, life, max: life, size: size * (0.6 + Math.random() * 0.8), color: colors[i % colors.length], gravity });
    }
  }

  /** Text that floats up and fades ("+10"). */
  float(x: number, y: number, text: string, color = "#fff", size = 18) {
    this.floaters.push({ x, y, text, color, life: 1, size });
  }

  shake(amount = 6, seconds = 0.25) {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
    this.shakeT = Math.max(this.shakeT, seconds);
  }

  get busy() {
    return this.parts.length > 0 || this.floaters.length > 0 || this.shakeT > 0;
  }

  update(dt: number) {
    for (const p of this.parts) {
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const f of this.floaters) {
      f.y -= 40 * dt;
      f.life -= dt * 1.1;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.shakeT === 0) this.shakeAmt = 0;
  }

  /** Call before drawing the board: moves the canvas for screen shake (pair with ctx.restore()). */
  begin(ctx: CanvasRenderingContext2D) {
    ctx.save();
    if (this.shakeT > 0) ctx.translate((Math.random() - 0.5) * this.shakeAmt * 2, (Math.random() - 0.5) * this.shakeAmt * 2);
  }

  /** Call after drawing the board. */
  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.font = `900 ${f.size}px sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  clear() {
    this.parts = [];
    this.floaters = [];
    this.shakeT = 0;
  }
}

/** Lighten (+) or darken (−) a #rrggbb colour by an amount in [-1, 1]. */
export function shade(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
