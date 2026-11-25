// A thin vertical pitch wheel on the screen edge. Drag up/down to bend, it springs back on release.
import { h } from './dom';

export function bendStrip(range: () => number, onBend: (semis: number) => void): HTMLElement {
  const dot = h('span', { class: 'bend-dot' });
  const el = h('div', { class: 'bend', role: 'slider', 'aria-label': 'Pitch bend' }, h('span', { class: 'bend-line' }), h('span', { class: 'bend-mid' }), dot);
  let startY = 0;
  let active = -1;

  const show = (f: number) => { dot.style.transform = `translate(-50%, calc(-50% + ${-f * (el.clientHeight / 2 - 14)}px))`; };

  el.addEventListener('pointerdown', (e) => {
    if (active !== -1) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    active = e.pointerId;
    startY = e.clientY;
    dot.getAnimations().forEach((a) => a.cancel());
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId !== active) return;
    const f = Math.max(-1, Math.min(1, (startY - e.clientY) / (el.clientHeight / 2)));
    show(f);
    onBend(f * range());
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== active) return;
    active = -1;
    onBend(0);
    show(0);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  return el;
}
