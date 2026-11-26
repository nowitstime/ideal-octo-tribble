import { describe, it, expect } from 'vitest';
import { rule, ruleSteps, ruleHits, describe as say, defaultRules } from './drumRules';
import { TPS } from './ticks';

describe('drum rules', () => {
  it('quarter notes, every other beat, and the backbeat', () => {
    expect(ruleSteps(rule(0, [1, 2, 3, 4]))).toEqual([0, 4, 8, 12]);
    expect(ruleSteps(rule(0, [1, 3]))).toEqual([0, 8]);
    expect(ruleSteps(rule(1, [2, 4]))).toEqual([4, 12]);
    expect(ruleSteps(rule(1, [3, 4]))).toEqual([8, 12]);
  });

  it('places hits inside the beat: eighths, offbeats, sixteenths', () => {
    expect(ruleSteps(rule(4, [1, 2, 3, 4], [0, 2]))).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(ruleSteps(rule(5, [1, 2, 3, 4], [2]))).toEqual([2, 6, 10, 14]);
    expect(ruleSteps(rule(4, [1], [0, 1, 2, 3]))).toEqual([0, 1, 2, 3]);
  });

  it('repeats every bar of the loop', () => {
    const hits = ruleHits([rule(0, [1, 3])], 2, 0);
    expect(hits.map((x) => x.tick / TPS)).toEqual([0, 8, 16, 24]);
  });

  it('without vary, every pass is the same', () => {
    const r = defaultRules();
    expect(ruleHits(r, 2, 0)).toEqual(ruleHits(r, 2, 7));
  });

  it('vary changes passes but is repeatable, and keeps the downbeat', () => {
    const r = [rule(0, [1, 2, 3, 4], [0, 2], 2)];
    const passes = Array.from({ length: 12 }, (_, k) => JSON.stringify(ruleHits(r, 1, k)));
    expect(new Set(passes).size).toBeGreaterThan(1);
    expect(ruleHits(r, 1, 3)).toEqual(ruleHits(r, 1, 3));
    for (let k = 0; k < 50; k++) expect(ruleHits(r, 1, k).some((x) => x.tick === 0)).toBe(true);
  });

  it('a rule with no beats or no subs is silent', () => {
    expect(ruleHits([rule(0, [])], 1, 0)).toEqual([]);
    expect(ruleHits([rule(0, [1, 2], [])], 1, 0)).toEqual([]);
  });

  it('describes rules in plain words', () => {
    expect(say(rule(0, [1, 3]))).toBe('beats 1 3');
    expect(say(rule(0, [1, 2, 3, 4], [0, 2]))).toBe('every beat · 8ths');
    expect(say(rule(0, [1, 2, 3, 4], [2]))).toBe('every beat · on &');
    expect(say(rule(0, []))).toBe('silent');
  });
});
