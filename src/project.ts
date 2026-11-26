// The project model: types, defaults, save migration and pure edits.
// No DOM or storage here, so it can be tested on its own.
import type { Mode, Mods } from './theory';
import { TPS, TICKS_PER_BAR, stepsToTicks, wrap } from './ticks';

export const PROJECT_VERSION = 2;

/** Fields every recorded note has. Positions and lengths are whole ticks (see ticks.ts). */
export interface NoteBase {
  tick: number;
  /** The loop pass this note was recorded in (see Phase 1 takes). Absent for hand-placed notes. */
  take?: number;
  /** Transient: absolute step to skip once (just-recorded note already heard live). */
  skipAbs?: number;
}

export interface DrumNote extends NoteBase {
  pad: number;
  vel: number;
}

export interface ChordNote extends NoteBase {
  len: number;
  degree: number;
  inv: number;
  mods: Mods;
  vel: number;
}

/** A pitch-bend point: t in ticks from note start, v in semitones. */
export interface BendPoint {
  t: number;
  v: number;
}

export interface BassNote extends NoteBase {
  len: number;
  /** Chord tone: 0 root, 1 third, 2 fifth, 3 seventh, 4 octave (of whatever chord is playing). */
  tone: number;
  vel: number;
  bend?: BendPoint[];
}

export interface LeadNote extends NoteBase {
  len: number;
  /** Scale degree from the key's root around middle C (may span octaves). */
  degree: number;
  vel: number;
  bend?: BendPoint[];
}

export type ArpPattern = 'up' | 'down' | 'updown' | 'random';

export interface PadParams {
  tune: number; // semitones, -12..12
  decay: number; // multiplier, 0.25..2
  level: number; // 0..1
}

export type RecMode = 'add' | 'replace';

export interface Project {
  version: number;
  name: string;
  bpm: number;
  bars: 1 | 2 | 4;
  quantize: boolean;
  click: boolean;
  /** Recording: overdub (add) or replace what you play over. */
  recMode: RecMode;
  /** Record exactly one loop pass, then stop recording. */
  oneShot: boolean;
  /** One bar of clicks before recording from stopped. */
  countIn: boolean;
  /** Last take id handed out; take ids are unique within the project. */
  lastTake: number;
  key: number;
  mode: Mode;
  progression: number[];
  progressionName: string;
  drums: {
    muted: boolean;
    mutedTakes: number[];
    kit: string;
    notes: DrumNote[];
    pads: PadParams[];
    swing: number; // 0..0.6
    velFromPosition: boolean;
  };
  chords: {
    muted: boolean;
    mutedTakes: number[];
    preset: string;
    notes: ChordNote[];
    cutoff: number; // 0..1
    release: number; // seconds
    level: number; // 0..1
  };
  bass: {
    muted: boolean;
    mutedTakes: number[];
    preset: string;
    notes: BassNote[];
    tone: number; // 0..1 brightness
    level: number;
    bendRange: number; // semitones
  };
  lead: {
    muted: boolean;
    mutedTakes: number[];
    preset: string;
    notes: LeadNote[];
    level: number;
    bendRange: number;
    octave: number; // -1..1
    arp: { pattern: ArpPattern; octaves: 1 | 2; gate: number };
  };
}

export type TrackId = 'drums' | 'chords' | 'bass' | 'lead';
export const TRACKS: TrackId[] = ['drums', 'chords', 'bass', 'lead'];

export const loopTicks = (p: Pick<Project, 'bars'>): number => p.bars * TICKS_PER_BAR;
export const loopSteps = (p: Pick<Project, 'bars'>): number => p.bars * 16;

/** Fill the chords track with one held chord per progression slot. */
export function chordsFromProgression(p: Project): ChordNote[] {
  const L = loopTicks(p);
  const n = p.progression.length;
  return p.progression.map((degree, i) => {
    const tick = Math.round((i * L) / n);
    const end = Math.round(((i + 1) * L) / n);
    return { tick, len: end - tick, degree, inv: 0, mods: {}, vel: 0.7 };
  });
}

/** Scale degree of the progression chord at a loop tick. */
export function chordDegreeAt(p: Project, tick: number): number {
  const L = loopTicks(p);
  const n = p.progression.length;
  const idx = Math.min(n - 1, Math.max(0, Math.floor((wrap(tick, L) * n) / L)));
  return p.progression[idx];
}

/** A plain root-fifth-octave bass line over `bars` bars. */
export function rootLine(bars: number): BassNote[] {
  const out: BassNote[] = [];
  const S = TPS;
  for (let s = 0; s < bars * 16; s += 8) {
    out.push(
      { tick: s * S, len: 3 * S, tone: 0, vel: 0.9 },
      { tick: (s + 3) * S, len: S, tone: 0, vel: 0.6 },
      { tick: (s + 6) * S, len: 2 * S, tone: 4, vel: 0.75 },
    );
  }
  return out;
}

export function defaultProject(): Project {
  const S = TPS;
  const drums: DrumNote[] = [];
  for (let bar = 0; bar < 2; bar++) {
    const o = bar * 16;
    drums.push({ tick: o * S, pad: 0, vel: 1 }, { tick: (o + 8) * S, pad: 0, vel: 0.9 }, { tick: (o + 10) * S, pad: 0, vel: 0.6 });
    drums.push({ tick: (o + 4) * S, pad: 1, vel: 0.9 }, { tick: (o + 12) * S, pad: 1, vel: 0.9 });
    for (let s = 0; s < 16; s += 2) drums.push({ tick: (o + s) * S, pad: 4, vel: s % 4 === 0 ? 0.7 : 0.45 });
  }
  const p: Project = {
    version: PROJECT_VERSION,
    name: 'Loop 1',
    bpm: 96,
    bars: 2,
    quantize: true,
    click: false,
    recMode: 'add',
    oneShot: false,
    countIn: false,
    lastTake: 0,
    key: 0,
    mode: 'major',
    progression: [0, 4, 5, 3],
    progressionName: 'Pop anthem',
    drums: {
      muted: false,
      mutedTakes: [],
      kit: 'Pulse',
      notes: drums,
      pads: Array.from({ length: 16 }, () => ({ tune: 0, decay: 1, level: 0.85 })),
      swing: 0,
      velFromPosition: true,
    },
    chords: { muted: false, mutedTakes: [], preset: 'Soft pad', notes: [], cutoff: 0.55, release: 0.5, level: 0.7 },
    bass: { muted: false, mutedTakes: [], preset: 'Round', notes: rootLine(2), tone: 0.5, level: 0.8, bendRange: 2 },
    lead: { muted: false, mutedTakes: [], preset: 'Glass', notes: [], level: 0.7, bendRange: 2, octave: 0, arp: { pattern: 'up', octaves: 2, gate: 0.6 } },
  };
  p.chords.notes = chordsFromProgression(p);
  return p;
}

// ---------- save migration ----------

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);

/** v1 stored positions as (possibly fractional) 16th steps: step × 120 = tick. */
function noteV1toV2(n: Raw): Raw {
  const { step, len, bend, ...rest } = n;
  const out: Raw = { ...rest, tick: stepsToTicks(Number(step) || 0) };
  if (len !== undefined) out.len = Math.max(1, stepsToTicks(Number(len) || 0));
  if (Array.isArray(bend)) out.bend = (bend as Raw[]).map((b) => ({ t: stepsToTicks(Number(b.t) || 0), v: Number(b.v) || 0 }));
  return out;
}

/**
 * Turn whatever was saved into a current project. Older saves are converted
 * and gain any fields added since; unknown data falls back to the defaults.
 */
export function migrate(saved: unknown): Project {
  const base = defaultProject() as unknown as Raw;
  if (!isObj(saved)) return base as unknown as Project;
  const data: Raw = { ...saved };
  const version = typeof data.version === 'number' ? data.version : 1;
  if (version < 2) {
    for (const t of TRACKS) {
      const track = data[t];
      if (isObj(track) && Array.isArray(track.notes)) {
        data[t] = { ...track, notes: (track.notes as Raw[]).filter(isObj).map(noteV1toV2) };
      }
    }
  }
  // Merge one level deep so older saves gain new fields.
  for (const [k, v] of Object.entries(data)) {
    const d = base[k];
    base[k] = isObj(d) && isObj(v) ? { ...d, ...v } : v;
  }
  base.version = PROJECT_VERSION;
  return base as unknown as Project;
}

// ---------- pure edits ----------

/** Change loop length; growing duplicates the existing pattern into the new bars. */
export function setBars(p: Project, bars: 1 | 2 | 4) {
  const oldL = loopTicks(p);
  const newL = bars * TICKS_PER_BAR;
  if (newL > oldL) {
    const copies = newL / oldL;
    const grow = <T extends NoteBase>(notes: T[]) => {
      const base = notes.filter((n) => n.tick < oldL);
      const out: T[] = [...base];
      for (let c = 1; c < copies; c++) for (const n of base) out.push({ ...n, tick: n.tick + c * oldL });
      return out;
    };
    p.drums.notes = grow(p.drums.notes);
    p.chords.notes = grow(p.chords.notes);
    p.bass.notes = grow(p.bass.notes);
    p.lead.notes = grow(p.lead.notes);
  }
  p.bars = bars;
}
