// The project: one loop with tracks. Saved to localStorage on every change.
import type { Mode, Mods } from './theory';

export interface DrumNote {
  /** Position in 16th-note steps from loop start (may be fractional if unquantized). */
  step: number;
  pad: number;
  vel: number;
  /** Transient: absolute step to skip once (just-recorded note already heard live). */
  skipAbs?: number;
}

export interface ChordNote {
  step: number;
  len: number;
  degree: number;
  inv: number;
  mods: Mods;
  vel: number;
  skipAbs?: number;
}

/** A pitch-bend point: t in steps from note start, v in semitones. */
export interface BendPoint {
  t: number;
  v: number;
}

export interface BassNote {
  step: number;
  len: number;
  /** Chord tone: 0 root, 1 third, 2 fifth, 3 seventh, 4 octave (of whatever chord is playing). */
  tone: number;
  vel: number;
  bend?: BendPoint[];
  skipAbs?: number;
}

export interface LeadNote {
  step: number;
  len: number;
  /** Scale degree from the key's root around middle C (may span octaves). */
  degree: number;
  vel: number;
  bend?: BendPoint[];
  skipAbs?: number;
}

export type ArpPattern = 'up' | 'down' | 'updown' | 'random';

export interface PadParams {
  tune: number; // semitones, -12..12
  decay: number; // multiplier, 0.25..2
  level: number; // 0..1
}

export interface Project {
  name: string;
  bpm: number;
  bars: 1 | 2 | 4;
  quantize: boolean;
  click: boolean;
  key: number;
  mode: Mode;
  progression: number[];
  progressionName: string;
  drums: {
    muted: boolean;
    kit: string;
    notes: DrumNote[];
    pads: PadParams[];
    swing: number; // 0..0.6
    velFromPosition: boolean;
  };
  chords: {
    muted: boolean;
    preset: string;
    notes: ChordNote[];
    cutoff: number; // 0..1
    release: number; // seconds
    level: number; // 0..1
  };
  bass: {
    muted: boolean;
    preset: string;
    notes: BassNote[];
    tone: number; // 0..1 brightness
    level: number;
    bendRange: number; // semitones
  };
  lead: {
    muted: boolean;
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

const STORAGE_KEY = 'octo.project.v1';

export function loopSteps(p: Project): number {
  return p.bars * 16;
}

/** Fill the chords track with one held chord per progression slot. */
export function chordsFromProgression(p: Project): ChordNote[] {
  const L = loopSteps(p);
  const seg = L / p.progression.length;
  return p.progression.map((degree, i) => ({ step: i * seg, len: seg, degree, inv: 0, mods: {}, vel: 0.7 }));
}

function defaultProject(): Project {
  const drums: DrumNote[] = [];
  for (let bar = 0; bar < 2; bar++) {
    const o = bar * 16;
    drums.push({ step: o, pad: 0, vel: 1 }, { step: o + 8, pad: 0, vel: 0.9 }, { step: o + 10, pad: 0, vel: 0.6 });
    drums.push({ step: o + 4, pad: 1, vel: 0.9 }, { step: o + 12, pad: 1, vel: 0.9 });
    for (let s = 0; s < 16; s += 2) drums.push({ step: o + s, pad: 4, vel: s % 4 === 0 ? 0.7 : 0.45 });
  }
  const p: Project = {
    name: 'Loop 1',
    bpm: 96,
    bars: 2,
    quantize: true,
    click: false,
    key: 0,
    mode: 'major',
    progression: [0, 4, 5, 3],
    progressionName: 'Pop anthem',
    drums: {
      muted: false,
      kit: 'Pulse',
      notes: drums,
      pads: Array.from({ length: 16 }, () => ({ tune: 0, decay: 1, level: 0.85 })),
      swing: 0,
      velFromPosition: true,
    },
    chords: { muted: false, preset: 'Soft pad', notes: [], cutoff: 0.55, release: 0.5, level: 0.7 },
    bass: { muted: false, preset: 'Round', notes: [], tone: 0.5, level: 0.8, bendRange: 2 },
    lead: { muted: false, preset: 'Glass', notes: [], level: 0.7, bendRange: 2, octave: 0, arp: { pattern: 'up', octaves: 2, gate: 0.6 } },
  };
  p.chords.notes = chordsFromProgression(p);
  for (let seg = 0; seg < 32; seg += 8) {
    p.bass.notes.push(
      { step: seg, len: 3, tone: 0, vel: 0.9 },
      { step: seg + 3, len: 1, tone: 0, vel: 0.6 },
      { step: seg + 6, len: 2, tone: 4, vel: 0.75 },
    );
  }
  return p;
}

/** Scale degree of the progression chord at a loop step. */
export function chordDegreeAt(p: Project, step: number): number {
  const L = loopSteps(p);
  const n = p.progression.length;
  const idx = Math.min(n - 1, Math.max(0, Math.floor((((step % L) + L) % L) / (L / n))));
  return p.progression[idx];
}

function load(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      // Merge one level deep so projects saved by older versions gain new fields.
      const saved = JSON.parse(raw) as Record<string, unknown>;
      const base = defaultProject() as unknown as Record<string, unknown>;
      for (const [k, v] of Object.entries(saved)) {
        const d = base[k];
        base[k] = d && typeof d === 'object' && !Array.isArray(d) && v && typeof v === 'object' ? { ...d, ...v } : v;
      }
      return base as unknown as Project;
    }
  } catch {
    /* fall through to default */
  }
  return defaultProject();
}

export const project: Project = load();

type Listener = () => void;
const listeners = new Set<Listener>();
let saveTimer = 0;

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Mutate the project, then notify and save. */
export function update(fn: (p: Project) => void) {
  fn(project);
  listeners.forEach((l) => l());
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(save, 300);
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project, (k, v) => (k === 'skipAbs' ? undefined : v)));
  } catch {
    /* storage unavailable: keep working in memory */
  }
}

/** Change loop length; growing duplicates the existing pattern into the new bars. */
export function setBars(p: Project, bars: 1 | 2 | 4) {
  const oldL = loopSteps(p);
  const newL = bars * 16;
  if (newL > oldL) {
    const copies = newL / oldL;
    const grow = <T extends { step: number }>(notes: T[]) => {
      const base = notes.filter((n) => n.step < oldL);
      const out: T[] = [...base];
      for (let c = 1; c < copies; c++) for (const n of base) out.push({ ...n, step: n.step + c * oldL });
      return out;
    };
    p.drums.notes = grow(p.drums.notes);
    p.chords.notes = grow(p.chords.notes);
    p.bass.notes = grow(p.bass.notes);
    p.lead.notes = grow(p.lead.notes);
  }
  p.bars = bars;
}
