import { describe, it, expect } from 'vitest';
import { takesIn, audible, replaceSpan, passIndex } from './takes';

const L = 3840; // two bars

describe('takes', () => {
  it('lists recorded takes in order, skipping hand-placed notes', () => {
    expect(takesIn([{ tick: 0 }, { tick: 1, take: 3 }, { tick: 2, take: 1 }, { tick: 3, take: 3 }])).toEqual([1, 3]);
    expect(takesIn([])).toEqual([]);
  });

  it('silences muted takes only', () => {
    expect(audible({ tick: 0 }, [1])).toBe(true);
    expect(audible({ tick: 0, take: 1 }, [1])).toBe(false);
    expect(audible({ tick: 0, take: 2 }, [1])).toBe(true);
  });

  it('counts passes from where recording started', () => {
    expect(passIndex(0, 0, 32)).toBe(0);
    expect(passIndex(31.9, 0, 32)).toBe(0);
    expect(passIndex(32, 0, 32)).toBe(1);
    expect(passIndex(40, 10, 32)).toBe(0);
    expect(passIndex(42, 10, 32)).toBe(1);
    expect(passIndex(-0.3, 0, 32)).toBe(0); // count-in slop belongs to the first pass
  });
});

describe('replace', () => {
  const drums = [
    { tick: 0, pad: 0 },
    { tick: 480, pad: 0, take: 1 },
    { tick: 960, pad: 0, take: 1 },
    { tick: 960, pad: 4, take: 1 },
    { tick: 1440, pad: 0, take: 2 },
    { tick: 2400, pad: 0 },
  ];

  it('drops other takes inside the swept span', () => {
    const out = replaceSpan(drums, 2, 400, 1500, L, (n) => n.pad === 0);
    expect(out.map((n) => `${n.tick}:${n.pad}`)).toEqual(['0:0', '960:4', '1440:0', '2400:0']);
  });

  it('keeps everything outside the span', () => {
    expect(replaceSpan(drums, 2, 3000, 3500, L)).toHaveLength(drums.length);
  });

  it('works across the loop end', () => {
    const out = replaceSpan(drums, 9, 3600, 3840 + 500, L);
    expect(out.map((n) => n.tick)).toEqual([960, 960, 1440, 2400]);
  });

  it('removes long notes that reach into the span', () => {
    const bass = [{ tick: 0, len: 960, take: 1 }, { tick: 1920, len: 240, take: 1 }];
    expect(replaceSpan(bass, 2, 480, 600, L)).toEqual([{ tick: 1920, len: 240, take: 1 }]);
  });
});
