// Destructive controls ask for a second tap on the same spot (never a hold).
import { h } from './dom';
import { update, type TrackId } from '../state';

const ARM_MS = 2500;

/** A button that asks for a second tap before doing something destructive. */
export function confirmButton(label: string, action: () => void, cls = 'chip'): HTMLButtonElement {
  const b = h('button', { class: cls, text: label });
  let armed = 0;
  b.addEventListener('click', () => {
    if (armed) {
      clearTimeout(armed);
      armed = 0;
      b.textContent = label;
      b.classList.remove('warn');
      action();
    } else {
      b.textContent = 'Tap again to confirm';
      b.classList.add('warn');
      armed = window.setTimeout(() => { armed = 0; b.textContent = label; b.classList.remove('warn'); }, ARM_MS);
    }
  });
  return b;
}

/** Empty a track: every note and every pass. Undoable. */
export function clearTrack(track: TrackId) {
  update((p) => {
    p[track].notes = [];
    p[track].mutedTakes = [];
  });
}

/**
 * The one clear control used everywhere (instrument pages and the map's
 * strings): a small ✕. Tap once and it says "clear?"; tap the ✕ again within
 * a moment to clear. The ✕ stays put so the second tap lands on the same spot.
 */
export function clearControl(track: TrackId, name: string, extra = ''): HTMLButtonElement {
  const label = h('span', { class: 'clear-label', text: `clear ${name}?` });
  const b = h('button', { class: `clear-btn ${extra}`, 'aria-label': `Clear ${name}` }, label, h('span', { class: 'clear-x' }));
  let armed = 0;
  const disarm = () => { armed = 0; b.classList.remove('armed'); };
  b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (armed) {
      clearTimeout(armed);
      disarm();
      clearTrack(track);
    } else {
      b.classList.add('armed');
      armed = window.setTimeout(disarm, ARM_MS);
    }
  });
  return b;
}
