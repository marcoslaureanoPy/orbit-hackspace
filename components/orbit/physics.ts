/** Ring layout + soft motion helpers for Orbit bubbles (CSS + rAF friendly). */

export const ORBIT_RADIUS_MIN = 220;
export const ORBIT_RADIUS_MAX = 320;

/** Card (true rectangle) bubble size — readable for long findings */
export const BUBBLE_W = 300;
export const BUBBLE_H = 260;

/** Round (circular) bubble diameter bounds — larger safe inner circle */
export const ROUND_D_MIN = 200;
export const ROUND_D_MAX = 280;
export const ROUND_D_BASE = 220;

export type BubbleShape = "round" | "card";

export function bubbleSize(
  shape: BubbleShape,
  contentLength = 0,
): { w: number; h: number } {
  if (shape === "card") return { w: BUBBLE_W, h: BUBBLE_H };
  const d = diameterFromContent(contentLength);
  return { w: d, h: d };
}

/** Soft diameter from content mass — longer text grows the sphere a bit, stays circular. */
export function diameterFromContent(contentLength: number): number {
  const extra = Math.min(
    ROUND_D_MAX - ROUND_D_BASE,
    Math.floor(Math.max(0, contentLength - 80) / 12),
  );
  return clamp(ROUND_D_BASE + extra, ROUND_D_MIN, ROUND_D_MAX);
}

export function ringPosition(
  index: number,
  total: number,
  cx: number,
  cy: number,
  radius = 260,
  bw = BUBBLE_W,
  bh = BUBBLE_H,
): { x: number; y: number; angle: number } {
  const n = Math.max(total, 1);
  // Start from top-right, clockwise — matches hub-and-spoke sketch
  const angle = -Math.PI / 2 + (index / n) * Math.PI * 2 + Math.PI / n;
  const x = cx + Math.cos(angle) * radius - bw / 2;
  const y = cy + Math.sin(angle) * radius - bh / 2;
  return { x, y, angle };
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function nextRingSlot(
  occupied: Array<{ x: number; y: number }>,
  cx: number,
  cy: number,
  radius = 260,
  bw = BUBBLE_W,
  bh = BUBBLE_H,
): { x: number; y: number; angle: number } {
  const count = occupied.length;
  return ringPosition(count, count + 1, cx, cy, radius, bw, bh);
}

/** Soft spring toward target — call from rAF with dt in seconds */
export function springToward(
  current: number,
  target: number,
  velocity: number,
  dt: number,
  stiffness = 120,
  damping = 14,
): { value: number; velocity: number } {
  const force = -stiffness * (current - target) - damping * velocity;
  const v = velocity + force * dt;
  const value = current + v * dt;
  return { value, velocity: v };
}

export function spokePath(
  cx: number,
  cy: number,
  bx: number,
  by: number,
  bw = BUBBLE_W,
  bh = BUBBLE_H,
): string {
  const mx = bx + bw / 2;
  const my = by + bh / 2;
  return `M ${cx} ${cy} L ${mx} ${my}`;
}
