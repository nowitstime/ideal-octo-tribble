// A thin vertical pitch wheel on the screen edge. Drag up/down to bend, it springs back on release.
import { h, onMove } from './dom';

/** Finger travel (px) for a full-range bend. Short, so bends feel immediate. */
const FULL_BEND_PX = 110;

export function bendStrip(range: () => number, onBend: (semis: number) => void): HTMLElement {
  const dot = h('span', { class: 'bend-dot' });
  const el = h('div', { class: 'bend', role: 'slider', 'aria-label': 'Pitch bend' }, h('span', { class: 'bend-line' }), h('span', { class: 'bend-mid' }), dot);
  let startY = 0;
  let active = -1;

  const show = (f: number) => { dot.style.transform = `translate(-50%, calc(-50% + ${-f * FULL_BEND_PX}px))`; };

  el.addEventListener('pointerdown', (e) => {
    if (active !== -1) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    active = e.pointerId;
    startY = e.clientY;
    el.classList.add('dragging');
  });
  onMove(el, (e) => {
    if (e.pointerId !== active) return;
    const f = Math.max(-1, Math.min(1, (startY - e.clientY) / FULL_BEND_PX));
    show(f);
    onBend(f * range());
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== active) return;
    active = -1;
    el.classList.remove('dragging');
    onBend(0);
    show(0);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  return el;
}
