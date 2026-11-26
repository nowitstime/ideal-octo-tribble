// Drum rules: drums written as simple rules instead of played on pads.
// A rule says which beats of the bar a sound plays on (1 2 3 4) and where
// inside each of those beats (1 e & a). "Vary" adds seeded ghost notes,
// drop-outs and small fills, different on every loop pass.
// Pure functions, no DOM or audio, so they can be tested on their own.
import { TPS } from './ticks';

export type Vary = 0 | 1 | 2;
export const VARY_NAMES = ['off', 'light', 'wild'] as const;

export interface DrumRule {
  pad: number;
  /** Which beats of each bar: 1 2 3 4. */
  beats: boolean[];
  /** Where inside each chosen beat: 1 e & a (the four 1/16ths). */
  subs: boolean[];
  vary: Vary;
}

export const SUB_NAMES = ['1', 'e', '&', 'a'];

export const rule = (pad: number, beats: number[], subs: number[] = [0], vary: Vary = 0): DrumRule => ({
  pad,
  beats: [0, 1, 2, 3].map((b) => beats.includes(b + 1)),
  subs: [0, 1, 2, 3].map((s) => subs.includes(s)),
  vary,
});

/** Kick on 1 and 3, snare on 2 and 4, hats on the eighths. */
export function defaultRules(): DrumRule[] {
  return [rule(0, [1, 3]), rule(1, [2, 4]), rule(4, [1, 2, 3, 4], [0, 2]), rule(5, [4], [2])];
}

/** Steps (0–15) inside one bar where the rule plays. */
export function ruleSteps(r: DrumRule): number[] {
  const out: number[] = [];
  for (let b = 0; b < 4; b++) if (r.beats[b]) for (let s = 0; s < 4; s++) if (r.subs[s]) out.push(b * 4 + s);
  return out;
}

/** On the beat is loudest, the "&" next, the "e" and "a" softest. */
const SUB_VEL = [0.9, 0.55, 0.72, 0.55];

/** Small deterministic hash → 0..1, so a pass sounds the same if heard again. */
export function chance(...xs: number[]): number {
  let h = 2166136261;
  for (const x of xs) {
    h ^= x + 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}

const DROP = [0, 0.07, 0.14];
const GHOST = [0, 0.1, 0.22];
const FILL = [0, 0.25, 0.5];

export interface RuleHit {
  tick: number;
  pad: number;
  vel: number;
}

/**
 * Every hit the rules make in one pass of a loop `bars` long. `pass` is the
 * loop pass number; it only matters when a rule varies.
 */
export function ruleHits(rules: readonly DrumRule[], bars: number, pass: number): RuleHit[] {
  const out: RuleHit[] = [];
  const steps = bars * 16;
  for (const [ri, r] of rules.entries()) {
    const own = new Set(ruleSteps(r));
    if (!own.size) continue;
    const v = r.vary;
    // A fill on the last beat of the loop, now and then.
    const fill = v > 0 && chance(pass, ri, 999) < FILL[v];
    for (let step = 0; step < steps; step++) {
      const inBar = step % 16;
      const rnd = chance(pass, ri, step);
      if (own.has(inBar)) {
        // Never drop the downbeat of the loop: it holds everything together.
        if (step !== 0 && rnd < DROP[v]) continue;
        out.push({ tick: step * TPS, pad: r.pad, vel: SUB_VEL[inBar % 4] });
        continue;
      }
      if (!v) continue;
      const lastBeat = step >= steps - 4;
      if (fill && lastBeat && (inBar % 2 === 0 || v === 2)) {
        out.push({ tick: step * TPS, pad: r.pad, vel: 0.45 + 0.1 * (step - (steps - 4)) });
        continue;
      }
      // Ghost notes only next to the rule's own hits, so they stay in its feel.
      const near = own.has((inBar + 15) % 16) || own.has((inBar + 1) % 16);
      if (near && rnd > 1 - GHOST[v]) out.push({ tick: step * TPS, pad: r.pad, vel: 0.32 });
    }
  }
  return out;
}

/** Plain-words summary of a rule, e.g. "beats 2 4" or "every & ". */
export function describe(r: DrumRule): string {
  const beats = [0, 1, 2, 3].filter((b) => r.beats[b]);
  const subs = [0, 1, 2, 3].filter((s) => r.subs[s]);
  if (!beats.length || !subs.length) return 'silent';
  const where = beats.length === 4 ? 'every beat' : `beat${beats.length > 1 ? 's' : ''} ${beats.map((b) => b + 1).join(' ')}`;
  const sub = subs.length === 1 && subs[0] === 0 ? '' : subs.length === 4 ? ' · 16ths' : subs.length === 2 && subs[0] === 0 && subs[1] === 2 ? ' · 8ths' : ` · on ${subs.map((s) => SUB_NAMES[s]).join(' ')}`;
  return where + sub;
}
