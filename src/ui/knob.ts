// Knob: a pastel circle with a single line. Drag up/down to turn, double-tap to reset.
import { h } from './dom';

export interface KnobOpts {
  label: string;
  min: number;
  max: number;
  value: number;
  reset?: number;
  color?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}

export function knob(o: KnobOpts): HTMLElement {
  let value = o.value;
  const line = h('span', { class: 'knob-line' });
  const body = h('div', { class: 'knob-body', style: { background: o.color ?? '#ABD8CC' } }, line);
  const valueEl = h('span', { class: 'knob-value' });
  const el = h('div', { class: 'knob', role: 'slider', 'aria-label': o.label, tabindex: 0 }, body, h('span', { class: 'knob-label', text: o.label }), valueEl);

  const render = () => {
    const f = (value - o.min) / (o.max - o.min);
    line.style.transform = `rotate(${-135 + f * 270}deg)`;
    valueEl.textContent = o.format ? o.format(value) : value.toFixed(2);
    el.setAttribute('aria-valuenow', String(value));
  };
  const set = (v: number) => {
    value = Math.min(o.max, Math.max(o.min, v));
    render();
    o.onChange(value);
  };

  let startY = 0;
  let startV = 0;
  let lastTap = 0;
  body.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    body.setPointerCapture(e.pointerId);
    startY = e.clientY;
    startV = value;
    const now = performance.now();
    if (now - lastTap < 300 && o.reset != null) set(o.reset);
    lastTap = now;
  });
  body.addEventListener('pointermove', (e) => {
    if (!body.hasPointerCapture(e.pointerId)) return;
    set(startV + ((startY - e.clientY) / 180) * (o.max - o.min));
  });
  render();
  return el;
}
