import { describe, it, expect } from 'vitest';
import { migrate, defaultProject, setBars, chordDegreeAt, chordsFromProgression, loopTicks, PROJECT_VERSION } from './project';

/** A save as written by the step-based version (v1, no version field). */
function v1Save() {
  return {
    name: 'Old loop',
    bpm: 110,
    bars: 2,
    quantize: false,
    click: true,
    key: 2,
    mode: 'minor',
    progression: [0, 5],
    progressionName: 'Two-chord pulse',
    drums: { muted: false, kit: 'Lo-fi', notes: [{ step: 0, pad: 0, vel: 1 }, { step: 4.37, pad: 1, vel: 0.8 }], pads: [], swing: 0.2, velFromPosition: true },
    chords: { muted: true, preset: 'Keys', notes: [{ step: 0, len: 16, degree: 0, inv: 1, mods: { seventh: true }, vel: 0.7 }], cutoff: 0.5, release: 0.4, level: 0.6 },
    bass: { muted: false, preset: 'Sub', notes: [{ step: 2, len: 1.5, tone: 2, vel: 0.9, bend: [{ t: 0, v: 0 }, { t: 0.75, v: 1.5 }] }], tone: 0.4, level: 0.8, bendRange: 2 },
    lead: { muted: false, preset: 'Saw', notes: [{ step: 31.5, len: 0.25, degree: 9, vel: 0.85 }], level: 0.7, bendRange: 2, octave: 0, arp: { pattern: 'down', octaves: 1, gate: 0.5 } },
  };
}

describe('save migration', () => {
  it('converts v1 steps to ticks (step × 120)', () => {
    const p = migrate(v1Save());
    expect(p.version).toBe(PROJECT_VERSION);
    expect(p.drums.notes.map((n) => n.tick)).toEqual([0, 524]);
    expect(p.chords.notes[0]).toMatchObject({ tick: 0, len: 1920, degree: 0, inv: 1, mods: { seventh: true } });
    expect(p.bass.notes[0]).toMatchObject({ tick: 240, len: 180, tone: 2 });
    expect(p.bass.notes[0].bend).toEqual([{ t: 0, v: 0 }, { t: 90, v: 1.5 }]);
    expect(p.lead.notes[0]).toMatchObject({ tick: 3780, len: 30, degree: 9 });
    for (const n of [...p.drums.notes, ...p.chords.notes]) expect(n).not.toHaveProperty('step');
  });

  it('keeps everything else from the old save', () => {
    const p = migrate(v1Save());
    expect(p).toMatchObject({ name: 'Old loop', bpm: 110, bars: 2, quantize: false, click: true, key: 2, mode: 'minor', progression: [0, 5] });
    expect(p.drums).toMatchObject({ kit: 'Lo-fi', swing: 0.2 });
    expect(p.chords.muted).toBe(true);
    expect(p.lead.arp.pattern).toBe('down');
  });

  it('adds fields old saves lack', () => {
    const p = migrate(v1Save());
    expect(p.recMode).toBe('add');
    expect(p.lastTake).toBe(0);
    expect(p.drums.mutedTakes).toEqual([]);
    expect(p.lead.mutedTakes).toEqual([]);
  });

  it('gives old saves no drum rules, so their played beat is not doubled', () => {
    expect(migrate(v1Save()).drums.rules).toEqual([]);
    expect(defaultProject().drums.rules.length).toBeGreaterThan(0);
    const saved = JSON.parse(JSON.stringify(defaultProject()));
    saved.drums.rules[0].vary = 2;
    expect(migrate(saved).drums.rules[0].vary).toBe(2);
  });

  it('leaves v2 saves alone and survives a round trip', () => {
    const once = migrate(v1Save());
    const twice = migrate(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it('falls back to the default for junk', () => {
    expect(migrate(null)).toEqual(defaultProject());
    expect(migrate('nope')).toEqual(defaultProject());
  });
});

describe('project edits', () => {
  it('stores default notes on whole ticks', () => {
    const p = defaultProject();
    for (const n of [...p.drums.notes, ...p.chords.notes, ...p.bass.notes]) expect(Number.isInteger(n.tick)).toBe(true);
  });

  it('spreads the progression over the loop', () => {
    const p = defaultProject();
    const L = loopTicks(p);
    expect(chordDegreeAt(p, 0)).toBe(0);
    expect(chordDegreeAt(p, L / 4)).toBe(4);
    expect(chordDegreeAt(p, L - 1)).toBe(3);
    expect(chordDegreeAt(p, L + 1)).toBe(0);
    expect(chordDegreeAt(p, -1)).toBe(3);
    const c = chordsFromProgression(p);
    expect(c.reduce((s, n) => s + n.len, 0)).toBe(L);
  });

  it('keeps three-chord progressions on whole ticks', () => {
    const p = { ...defaultProject(), progression: [0, 3, 4], bars: 1 as const };
    const c = chordsFromProgression(p);
    expect(c.map((n) => n.tick)).toEqual([0, 640, 1280]);
    expect(c.reduce((s, n) => s + n.len, 0)).toBe(1920);
  });

  it('copies the pattern when the loop grows', () => {
    const p = defaultProject();
    p.drums.notes = [{ tick: 0, pad: 0, vel: 1 }, { tick: 480, pad: 1, vel: 1 }];
    const before = p.drums.notes.length;
    setBars(p, 4);
    expect(p.bars).toBe(4);
    expect(p.drums.notes.length).toBe(before * 2);
    expect(p.drums.notes.some((n) => n.tick === 2 * 1920)).toBe(true);
  });
});
