// Synth presets for chords, bass and lead, and drum kit characters.
// Everything is synthesized from these descriptions.

export interface Layer {
  type: OscillatorType;
  ratio?: number; // frequency multiple (0.5 = octave down)
  detune?: number; // cents
  gain?: number;
}

export interface SynthPreset {
  name: string;
  layers: Layer[];
  /** Optional FM pair: a sine carrier modulated at ratio × freq. */
  fm?: { ratio: number; index: number; decay: number; gain?: number };
  filter: { base: number; env: number; q: number; decay: number };
  amp: { a: number; d: number; s: number; r: number };
  vibrato?: { rate: number; depth: number };
  drive?: number;
  reverb?: number;
  gain?: number;
}

export const CHORD_PRESETS: SynthPreset[] = [
  {
    name: 'Soft pad',
    layers: [{ type: 'sawtooth', detune: -7 }, { type: 'sawtooth', detune: 7 }],
    filter: { base: 1400, env: 400, q: 0.8, decay: 0.4 },
    amp: { a: 0.02, d: 0.4, s: 0.75, r: 0.5 },
    reverb: 0.25,
  },
  {
    name: 'Keys',
    layers: [{ type: 'sine', gain: 0.6 }],
    fm: { ratio: 1, index: 2.2, decay: 0.5, gain: 0.6 },
    filter: { base: 5000, env: 0, q: 0.5, decay: 0.3 },
    amp: { a: 0.004, d: 1.2, s: 0.25, r: 0.35 },
    reverb: 0.18,
    gain: 0.4,
  },
  {
    name: 'Pluck',
    layers: [{ type: 'sawtooth', detune: -4 }, { type: 'square', detune: 4, gain: 0.4 }],
    filter: { base: 500, env: 4500, q: 1.5, decay: 0.18 },
    amp: { a: 0.002, d: 0.5, s: 0.0, r: 0.25 },
    reverb: 0.2,
  },
  {
    name: 'Organ',
    layers: [{ type: 'sine' }, { type: 'sine', ratio: 2, gain: 0.5 }, { type: 'sine', ratio: 3, gain: 0.3 }, { type: 'sine', ratio: 4, gain: 0.2 }],
    filter: { base: 6000, env: 0, q: 0.5, decay: 0.1 },
    amp: { a: 0.01, d: 0.1, s: 1, r: 0.08 },
    vibrato: { rate: 6, depth: 6 },
    reverb: 0.15,
    gain: 0.25,
  },
  {
    name: 'Strings',
    layers: [{ type: 'sawtooth', detune: -12 }, { type: 'sawtooth', detune: 0 }, { type: 'sawtooth', detune: 12 }],
    filter: { base: 1800, env: 0, q: 0.6, decay: 0.5 },
    amp: { a: 0.35, d: 0.5, s: 0.85, r: 0.9 },
    vibrato: { rate: 5, depth: 8 },
    reverb: 0.35,
    gain: 0.22,
  },
  {
    name: 'Glass bells',
    layers: [{ type: 'sine', gain: 0.4 }],
    fm: { ratio: 3.5, index: 3, decay: 0.9, gain: 0.6 },
    filter: { base: 7000, env: 0, q: 0.5, decay: 0.3 },
    amp: { a: 0.002, d: 2, s: 0.0, r: 1.2 },
    reverb: 0.35,
    gain: 0.35,
  },
];

export const BASS_PRESETS: SynthPreset[] = [
  {
    name: 'Sub',
    layers: [{ type: 'sine' }, { type: 'triangle', ratio: 2, gain: 0.25 }],
    filter: { base: 900, env: 200, q: 0.5, decay: 0.2 },
    amp: { a: 0.005, d: 0.3, s: 0.85, r: 0.12 },
    gain: 0.6,
  },
  {
    name: 'Round',
    layers: [{ type: 'triangle' }, { type: 'sawtooth', gain: 0.35 }],
    filter: { base: 500, env: 900, q: 1, decay: 0.25 },
    amp: { a: 0.004, d: 0.4, s: 0.7, r: 0.12 },
    gain: 0.5,
  },
  {
    name: 'Acid',
    layers: [{ type: 'sawtooth' }],
    filter: { base: 300, env: 2600, q: 9, decay: 0.22 },
    amp: { a: 0.003, d: 0.3, s: 0.6, r: 0.08 },
    drive: 2,
    gain: 0.35,
  },
  {
    name: 'Fuzz',
    layers: [{ type: 'square' }, { type: 'square', ratio: 0.5, detune: 5, gain: 0.6 }],
    filter: { base: 1200, env: 600, q: 1.2, decay: 0.3 },
    amp: { a: 0.004, d: 0.3, s: 0.8, r: 0.1 },
    drive: 6,
    gain: 0.22,
  },
];

export const LEAD_PRESETS: SynthPreset[] = [
  {
    name: 'Glass',
    layers: [{ type: 'triangle', gain: 0.6 }],
    fm: { ratio: 2, index: 1.2, decay: 0.6, gain: 0.5 },
    filter: { base: 3200, env: 1200, q: 0.7, decay: 0.3 },
    amp: { a: 0.006, d: 0.4, s: 0.6, r: 0.35 },
    reverb: 0.3,
    gain: 0.35,
  },
  {
    name: 'Saw lead',
    layers: [{ type: 'sawtooth', detune: -6 }, { type: 'sawtooth', detune: 6 }],
    filter: { base: 1600, env: 1800, q: 2, decay: 0.25 },
    amp: { a: 0.005, d: 0.3, s: 0.7, r: 0.2 },
    reverb: 0.2,
    gain: 0.25,
  },
  {
    name: 'Square',
    layers: [{ type: 'square' }],
    filter: { base: 2200, env: 800, q: 1, decay: 0.2 },
    amp: { a: 0.004, d: 0.2, s: 0.7, r: 0.15 },
    reverb: 0.2,
    gain: 0.22,
  },
  {
    name: 'Flute',
    layers: [{ type: 'sine' }, { type: 'triangle', ratio: 2, gain: 0.12 }],
    filter: { base: 3000, env: 0, q: 0.5, decay: 0.2 },
    amp: { a: 0.06, d: 0.2, s: 0.85, r: 0.25 },
    vibrato: { rate: 5.5, depth: 14 },
    reverb: 0.3,
    gain: 0.45,
  },
];

export interface Kit {
  name: string;
  tune: number; // semitones added to every pad
  decay: number; // multiplier
  lowpass?: number; // bus filter, Hz
  crush?: number; // number of amplitude steps (lo-fi)
  drive?: number;
  reverb?: number;
  /** Selects alternate voice designs for some pads. */
  style: 'electronic' | 'acoustic' | 'minimal';
}

export const KITS: Kit[] = [
  { name: 'Pulse', tune: 0, decay: 1, style: 'electronic' },
  { name: 'Acoustic-ish', tune: -1, decay: 1.1, reverb: 0.18, style: 'acoustic' },
  { name: 'Lo-fi', tune: -2, decay: 0.9, lowpass: 3800, crush: 10, style: 'electronic' },
  { name: 'Minimal', tune: 3, decay: 0.45, style: 'minimal' },
  { name: 'Big room', tune: -1, decay: 1.5, drive: 2.5, reverb: 0.35, style: 'electronic' },
];

export const presetByName = (list: SynthPreset[], name: string) => list.find((p) => p.name === name) ?? list[0];
export const kitByName = (name: string) => KITS.find((k) => k.name === name) ?? KITS[0];
