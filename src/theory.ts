// Keys, scales and diatonic chords. Chords are stored as scale degrees
// (0 = I, 4 = V…) so changing key or mode re-voices everything for free.

export type Mode = 'major' | 'minor';

export const NOTE_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
/** Keys in circle-of-fifths order (pitch class numbers). */
export const FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

const SCALES: Record<Mode, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export interface Mods {
  seventh?: boolean;
  sus?: boolean;
  add9?: boolean;
}

/** MIDI note for a scale degree (degree may go past 6 into the next octave). C4 = 60. */
export function scaleNote(key: number, mode: Mode, degree: number, octave = 4): number {
  const s = SCALES[mode];
  const oct = Math.floor(degree / 7);
  const i = ((degree % 7) + 7) % 7;
  return 12 * (octave + 1) + key + s[i] + 12 * oct;
}

export type Quality = 'maj' | 'min' | 'dim' | 'aug';

export interface ChordInfo {
  name: string;
  numeral: string;
  quality: Quality;
}

export function chordInfo(key: number, mode: Mode, degree: number): ChordInfo {
  const root = scaleNote(key, mode, degree);
  const third = scaleNote(key, mode, degree + 2) - root;
  const fifth = scaleNote(key, mode, degree + 4) - root;
  const quality: Quality = third === 4 ? (fifth === 8 ? 'aug' : 'maj') : fifth === 6 ? 'dim' : 'min';
  const letter = NOTE_NAMES[root % 12];
  const r = ROMAN[((degree % 7) + 7) % 7];
  return {
    name: letter + (quality === 'min' ? 'm' : quality === 'dim' ? '°' : quality === 'aug' ? '+' : ''),
    numeral: quality === 'maj' || quality === 'aug' ? r : r.toLowerCase() + (quality === 'dim' ? '°' : ''),
    quality,
  };
}

/**
 * Notes for a chord. `inv` 0–2 picks the inversion (higher = brighter voicing).
 * A bass root is added an octave below.
 */
export function chordMidis(key: number, mode: Mode, degree: number, inv: number, mods: Mods = {}): number[] {
  const degs = [degree, mods.sus ? degree + 3 : degree + 2, degree + 4];
  if (mods.seventh) degs.push(degree + 6);
  if (mods.add9) degs.push(degree + 8);
  const notes = degs.map((d) => scaleNote(key, mode, d, 3));
  // Keep chords in a comfortable range regardless of key.
  if (notes[0] > 55) for (let i = 0; i < notes.length; i++) notes[i] -= 12;
  notes.sort((a, b) => a - b);
  for (let i = 0; i < inv; i++) {
    const low = notes.shift()!;
    notes.push(low + 12);
  }
  const bass = scaleNote(key, mode, degree, 2);
  return [bass > 47 ? bass - 12 : bass, ...notes];
}

/** Scale-degree offsets for bass chord tones: root, 3rd, 5th, 7th, octave. */
export const TONE_OFFSETS = [0, 2, 4, 6, 7];
export const TONE_NAMES = ['root', '3rd', '5th', '7th', 'oct'];

/** Bass pitch for a chord tone, kept in a low register. */
export function bassMidi(key: number, mode: Mode, degree: number, tone: number): number {
  const root = scaleNote(key, mode, degree, 2);
  const shift = root > 45 ? -12 : 0;
  return scaleNote(key, mode, degree + TONE_OFFSETS[tone], 2) + shift;
}

/** Lead pitch for a scale degree (0 = key root around middle C). */
export function leadMidi(key: number, mode: Mode, degree: number): number {
  return scaleNote(key, mode, degree, 4);
}

export function keyName(key: number, mode: Mode): string {
  return `${NOTE_NAMES[key]} ${mode}`;
}

export interface Preset {
  name: string;
  mood: string;
  degrees: number[];
}

export const PRESETS: Record<Mode, Preset[]> = {
  major: [
    { name: 'Pop anthem', mood: 'bright', degrees: [0, 4, 5, 3] },
    { name: 'Sad loop', mood: 'bittersweet', degrees: [5, 3, 0, 4] },
    { name: 'Doo-wop', mood: 'classic', degrees: [0, 5, 3, 4] },
    { name: 'Jazz turn', mood: 'smooth', degrees: [1, 4, 0, 0] },
    { name: 'Lift', mood: 'hopeful', degrees: [3, 4, 2, 5] },
    { name: 'Drift', mood: 'dreamy', degrees: [0, 3] },
    { name: 'Canon', mood: 'timeless', degrees: [0, 4, 5, 2, 3, 0, 3, 4] },
    { name: 'Twelve-bar-ish', mood: 'bluesy', degrees: [0, 0, 3, 0, 4, 3, 0, 4] },
  ],
  minor: [
    { name: 'Epic minor', mood: 'cinematic', degrees: [0, 5, 2, 6] },
    { name: 'Andalusian', mood: 'dramatic', degrees: [0, 6, 5, 4] },
    { name: 'Moody', mood: 'dark', degrees: [0, 3, 4, 0] },
    { name: 'Night drive', mood: 'restless', degrees: [0, 5, 6, 0] },
    { name: 'Lament', mood: 'tender', degrees: [0, 6, 5, 6] },
    { name: 'Two-chord pulse', mood: 'hypnotic', degrees: [0, 5] },
  ],
};

export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}
