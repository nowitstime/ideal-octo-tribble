import { describe, it, expect } from 'vitest';
import { PPQ, TPS, GRID, snap, swingTicks, stepsToTicks, ticksToSteps, wrap, overlapsSpan } from './ticks';

describe('ticks', () => {
  it('uses 480 per quarter and 120 per 1/16', () => {
    expect(PPQ).toBe(480);
    expect(TPS).toBe(120);
    expect(GRID['1/8T']).toBe(160);
    expect(GRID['1/16T']).toBe(80);
  });

  it('converts steps and ticks', () => {
    expect(stepsToTicks(3)).toBe(360);
    expect(stepsToTicks(2.5)).toBe(300);
    expect(stepsToTicks(1 / 3)).toBe(40);
    expect(ticksToSteps(360)).toBe(3);
  });

  it('snaps to straight and triplet grids exactly', () => {
    expect(snap(170, TPS)).toBe(120);
    expect(snap(181, TPS)).toBe(240);
    expect(snap(170, GRID['1/8T'])).toBe(160);
    expect(snap(250, GRID['1/8T'])).toBe(320);
    // Many triplets in a row never drift.
    for (let i = 0; i < 48; i++) expect(snap(i * 160 + 30, GRID['1/8T'])).toBe(i * 160);
  });

  it('wraps negatives into the loop', () => {
    expect(wrap(-120, 3840)).toBe(3720);
    expect(wrap(3840, 3840)).toBe(0);
  });

  it('swings only off-beat 16ths', () => {
    expect(swingTicks(0, 0.5)).toBe(0);
    expect(swingTicks(120, 0.5)).toBe(30);
    expect(swingTicks(240, 0.5)).toBe(0);
    expect(swingTicks(360, 0.6)).toBe(36);
    expect(swingTicks(130, 0.5)).toBe(0); // unquantized notes are left alone
    expect(swingTicks(120, 0)).toBe(0);
    // Swing on an 1/8 grid.
    expect(swingTicks(240, 0.5, GRID['1/8'])).toBe(60);
  });

  it('finds notes inside a span, across the loop end', () => {
    const L = 3840;
    expect(overlapsSpan(500, 1, 400, 600, L)).toBe(true);
    expect(overlapsSpan(700, 1, 400, 600, L)).toBe(false);
    expect(overlapsSpan(300, 200, 400, 600, L)).toBe(true); // a long note reaching in
    expect(overlapsSpan(100, 1, 3700, 4000, L)).toBe(true); // span crosses the end
    expect(overlapsSpan(3750, 1, -200, 50, L)).toBe(true); // negative start
    expect(overlapsSpan(1000, 1, 3700, 4000, L)).toBe(false);
    expect(overlapsSpan(1000, 1, 0, L, L)).toBe(true);
    expect(overlapsSpan(1000, 1, 500, 500, L)).toBe(false);
  });
});
