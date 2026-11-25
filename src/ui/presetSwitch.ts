// ‹ Preset name ›: steps through a list of sound presets.
import { h } from './dom';

export function presetSwitch(names: string[], current: string, onChange: (name: string) => void): HTMLElement {
  let i = Math.max(0, names.indexOf(current));
  const label = h('span', { class: 'preset-label' });
  const count = h('span', { class: 'mono muted small' });
  const render = () => {
    label.textContent = names[i];
    count.textContent = `${i + 1} / ${names.length}`;
  };
  const step = (d: number) => {
    i = (i + d + names.length) % names.length;
    render();
    onChange(names[i]);
  };
  render();
  return h('div', { class: 'preset-switch' },
    h('button', { class: 'icon-btn', 'aria-label': 'Previous sound', text: '‹', onClick: () => step(-1) }),
    h('div', { class: 'preset-mid' }, label, count),
    h('button', { class: 'icon-btn', 'aria-label': 'Next sound', text: '›', onClick: () => step(1) }),
  );
}
