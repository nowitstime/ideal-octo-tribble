// Takes: every loop pass recorded is its own take, so a bad pass can be
// muted, deleted or undone without touching the rest.
import { overlapsSpan } from './ticks';

interface Taken {
  tick: number;
  len?: number;
  take?: number;
}

/** Recorded takes present in a track, oldest first. Hand-placed notes (no take) aren't listed. */
export function takesIn(notes: readonly Taken[]): number[] {
  const set = new Set<number>();
  for (const n of notes) if (n.take) set.add(n.take);
  return [...set].sort((a, b) => a - b);
}

/** Should this note be heard? */
export const audible = (n: Taken, mutedTakes: readonly number[]): boolean => !n.take || !mutedTakes.includes(n.take);

/**
 * Replace recording: drop notes from other takes that overlap the span
 * [a, b) (absolute ticks, may cross the loop end) on a loop of `L` ticks.
 * `match` narrows what gets replaced (e.g. only the drum pad being played).
 */
export function replaceSpan<T extends Taken>(notes: T[], take: number, a: number, b: number, L: number, match: (n: T) => boolean = () => true): T[] {
  return notes.filter((n) => n.take === take || !match(n) || !overlapsSpan(n.tick, n.len ?? 1, a, b, L));
}

/** Which pass of a recording an absolute position falls in (0 = first). */
export function passIndex(abs: number, armAbs: number, loopLen: number): number {
  return Math.max(0, Math.floor((abs - armAbs) / loopLen + 1e-9));
}
