// Note positions are whole ticks: 480 per quarter note, 120 per 1/16 step.
// Snapping, triplets, swing and bar changes then stay exact.

export const PPQ = 480;
/** Ticks per 1/16 step. */
export const TPS = PPQ / 4;
export const TICKS_PER_BAR = PPQ * 4;

/** Common grids, in ticks. */
export const GRID = {
  '1/4': PPQ,
  '1/8': PPQ / 2,
  '1/16': PPQ / 4,
  '1/8T': PPQ / 3,
  '1/16T': PPQ / 6,
} as const;

export const stepsToTicks = (steps: number): number => Math.round(steps * TPS);
export const ticksToSteps = (ticks: number): number => ticks / TPS;

/** Positive modulo. */
export const wrap = (x: number, L: number): number => ((x % L) + L) % L;

/** Nearest grid point. */
export function snap(tick: number, grid: number): number {
  return Math.round(tick / grid) * grid;
}

/**
 * Swing delay in ticks for a note: notes on the off-beat of each pair of
 * `grid`s are pushed late by up to half a grid. `amount` is 0..1.
 */
export function swingTicks(tick: number, amount: number, grid: number = TPS): number {
  if (!amount) return 0;
  return wrap(tick, grid * 2) === grid ? Math.round(amount * grid * 0.5) : 0;
}

/**
 * Does the note interval [t, t+len) overlap the span [a, b) on a loop of
 * length L? a and b may lie outside the loop (spans may cross its end);
 * a span as long as the loop covers everything.
 */
export function overlapsSpan(t: number, len: number, a: number, b: number, L: number): boolean {
  if (b - a >= L) return true;
  if (b <= a) return false;
  const a0 = wrap(a, L);
  const b0 = a0 + (b - a);
  const l = Math.max(1, len);
  for (const k of [-1, 0, 1]) {
    const s = t + k * L;
    if (s < b0 && s + l > a0) return true;
  }
  return false;
}
