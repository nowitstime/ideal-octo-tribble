import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { engine } from './audio/engine';
import { mapScreen } from './screens/map';
import { drumsScreen } from './screens/drums';
import { chordsScreen } from './screens/chords';
import { progressionScreen } from './screens/progression';
import { bassScreen } from './screens/bass';
import { leadScreen } from './screens/lead';

registerSW({ immediate: true });

const root = document.getElementById('app')!;
let cleanup: (() => void) | null = null;

// Audio may only start from a user gesture: create it on the very first touch.
window.addEventListener('pointerdown', () => engine.ensure(), { capture: true });
document.addEventListener('contextmenu', (e) => e.preventDefault());

// Android treats a held finger as a long-press (vibration, link previews,
// text selection). Holding is how you play here, so take over touches:
// cancel the browser's default and turn short taps back into clicks.
// Pointer events (used by every instrument) are unaffected. Scrollable
// panels keep native touch so they still scroll, except over controls you hold.
const taps = new Map<number, { x: number; y: number; el: Element }>();
const HOLD_SURFACES = '.knob-body, .bend, .mod, .pad, .pad-mini, .chord-grid, .string-stage, .field, .strum, .bpm';
document.addEventListener('touchstart', (e) => {
  const target = e.target as Element;
  if (target.closest('.scroll') && !target.closest(HOLD_SURFACES)) return;
  e.preventDefault();
  for (const t of Array.from(e.changedTouches)) taps.set(t.identifier, { x: t.clientX, y: t.clientY, el: target });
}, { passive: false });
document.addEventListener('touchend', (e) => {
  for (const t of Array.from(e.changedTouches)) {
    const start = taps.get(t.identifier);
    taps.delete(t.identifier);
    if (!start || Math.hypot(t.clientX - start.x, t.clientY - start.y) > 12) continue;
    const el = start.el.closest('button, a, .note-lane') as HTMLElement | null;
    if (!el || el.closest(HOLD_SURFACES)) continue;
    // The note lane needs the tap position to know which note was hit.
    if (el.matches('.note-lane')) el.dispatchEvent(new MouseEvent('click', { clientX: t.clientX, clientY: t.clientY, bubbles: true }));
    else el.click();
  }
}, { passive: false });
document.addEventListener('touchcancel', (e) => { for (const t of Array.from(e.changedTouches)) taps.delete(t.identifier); });

function route() {
  cleanup?.();
  root.replaceChildren();
  const path = location.hash.replace(/^#\/?/, '');
  switch (path) {
    case 'drums': cleanup = drumsScreen(root, 'play'); break;
    case 'drums/set': cleanup = drumsScreen(root, 'set'); break;
    case 'chords': cleanup = chordsScreen(root, 'play'); break;
    case 'chords/set': cleanup = chordsScreen(root, 'set'); break;
    case 'bass': cleanup = bassScreen(root, 'play'); break;
    case 'bass/set': cleanup = bassScreen(root, 'set'); break;
    case 'lead': cleanup = leadScreen(root, 'play'); break;
    case 'lead/set': cleanup = leadScreen(root, 'set'); break;
    case 'progression': cleanup = progressionScreen(root); break;
    default: cleanup = mapScreen(root);
  }
}

window.addEventListener('hashchange', route);
route();
