import { describe, it, expect } from 'vitest';
import { scaleNote, chordInfo, chordMidis, bassMidi, leadMidi } from './theory';

describe('theory', () => {
  it('builds scales from the key root', () => {
    expect(scaleNote(0, 'major', 0)).toBe(60);
    expect(scaleNote(0, 'major', 7)).toBe(72);
    expect(scaleNote(0, 'minor', 2)).toBe(63);
    expect(scaleNote(9, 'minor', -1)).toBe(67); // A minor, one below the root is G
  });

  it('names diatonic chords', () => {
    expect(chordInfo(0, 'major', 0)).toMatchObject({ name: 'C', numeral: 'I', quality: 'maj' });
    expect(chordInfo(0, 'major', 5)).toMatchObject({ name: 'Am', numeral: 'vi' });
    expect(chordInfo(0, 'major', 6)).toMatchObject({ numeral: 'vii°', quality: 'dim' });
    expect(chordInfo(9, 'minor', 0).name).toBe('Am');
  });

  it('voices chords with a bass root and mods', () => {
    const c = chordMidis(0, 'major', 0, 0);
    expect(c[0] % 12).toBe(0);
    expect(c.slice(1).map((n) => n % 12).sort()).toEqual([0, 4, 7]);
    expect(chordMidis(0, 'major', 0, 0, { seventh: true })).toHaveLength(5);
    const sus = chordMidis(0, 'major', 0, 0, { sus: true }).slice(1).map((n) => n % 12);
    expect(sus).toContain(5);
    expect(sus).not.toContain(4);
  });

  it('keeps bass low and follows chord tones', () => {
    for (let key = 0; key < 12; key++) expect(bassMidi(key, 'major', 0, 0)).toBeLessThanOrEqual(45);
    expect(bassMidi(0, 'major', 0, 4) - bassMidi(0, 'major', 0, 0)).toBe(12);
    expect(leadMidi(0, 'major', 4)).toBe(67);
  });
});
