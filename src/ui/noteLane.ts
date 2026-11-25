// A compact view of what's recorded on a track: one row per bar, notes as
// pastel blocks. Tap a note to delete it; "Clear" (tap twice) empties the track.
import { h, everyFrame } from './dom';
import { project, update, subscribe, loopSteps, chordDegreeAt } from '../state';
import { transport } from '../audio/transport';
import { TONE_OFFSETS } from '../theory';
import { degreeColor } from './colors';

type Melodic = 'chords' | 'bass' | 'lead';

interface Block { i: number; step: number; len: number; color: string; y: number }

export function noteLane(track: Melodic): { el: HTMLElement; destroy: () => void } {
  const lane = h('div', { class: 'note-lane', 'aria-label': 'Recorded notes, tap one to delete it' });
  const head = h('span', { class: 'lane-head' });
  const clear = h('button', { class: 'text-btn', text: 'clear' });
  let armed = 0;
  clear.addEventListener('click', () => {
    if (armed) {
      clearTimeout(armed); armed = 0;
      clear.textContent = 'clear'; clear.classList.remove('warn');
      update((p) => { p[track].notes = []; });
    } else {
      clear.textContent = 'tap again to clear'; clear.classList.add('warn');
      armed = window.setTimeout(() => { armed = 0; clear.textContent = 'clear'; clear.classList.remove('warn'); }, 2500);
    }
  });
  const count = h('span');
  const el = h('div', { class: 'lane-wrap' },
    h('div', { class: 'lane-labels mono muted small' }, count, clear),
    lane);

  let blocks: Block[] = [];

  function blocksFor(): Block[] {
    const notes = project[track].notes as { step: number; len: number; degree?: number; tone?: number }[];
    // Vertical position by pitch for bass/lead so melodies read as shapes.
    const pitch = (n: (typeof notes)[number]) => (track === 'lead' ? n.degree ?? 0 : track === 'bass' ? n.tone ?? 0 : 0);
    const ps = notes.map(pitch);
    const lo = Math.min(...ps, 0), hi = Math.max(...ps, 1);
    return notes.map((n, i) => {
      const deg = track === 'bass' ? chordDegreeAt(project, n.step) + TONE_OFFSETS[n.tone ?? 0] : n.degree ?? 0;
      return { i, step: n.step, len: n.len, color: degreeColor(deg), y: track === 'chords' ? 0.5 : 1 - (pitch(n) - lo) / (hi - lo || 1) };
    });
  }

  function render() {
    const L = loopSteps(project);
    const bars = L / 16;
    blocks = blocksFor().filter((b) => b.step < L);
    count.textContent = `${blocks.length} note${blocks.length === 1 ? '' : 's'} · tap one to delete`;
    const rows = Array.from({ length: bars }, () => h('div', { class: 'note-row' }));
    for (const b of blocks) {
      const bar = Math.floor(b.step / 16);
      const x = (b.step % 16) / 16;
      const w = Math.min(Math.max(b.len, 0.6) / 16, 1 - x);
      rows[bar].append(h('span', {
        class: 'note-block',
        style: { left: `${x * 100}%`, width: `calc(${w * 100}% - 2px)`, top: `${4 + b.y * 10}px`, background: b.color },
      }));
    }
    lane.replaceChildren(...rows, head);
  }

  // Tap: delete the note closest to the finger in that bar.
  lane.addEventListener('click', (e) => {
    const r = lane.getBoundingClientRect();
    const L = loopSteps(project);
    const bars = L / 16;
    const bar = Math.min(bars - 1, Math.floor(((e.clientY - r.top) / r.height) * bars));
    const step = bar * 16 + ((e.clientX - r.left) / r.width) * 16;
    let best: Block | null = null;
    let bestD = 1.2; // steps of tolerance
    for (const b of blocks) {
      if (Math.floor(b.step / 16) !== bar) continue;
      const d = step < b.step ? b.step - step : step > b.step + b.len ? step - b.step - b.len : 0;
      if (d < bestD) { bestD = d; best = b; }
    }
    if (best) {
      const idx = best.i;
      update((p) => { (p[track].notes as unknown[]).splice(idx, 1); });
    }
  });

  render();
  const off = subscribe(render);
  const stop = everyFrame(() => {
    const L = loopSteps(project);
    const s = transport.heardStep();
    head.style.display = transport.playing ? 'block' : 'none';
    head.style.left = `${((s % 16) / 16) * 100}%`;
    head.style.top = `${(Math.floor(s / 16) / (L / 16)) * 100}%`;
    head.style.height = `${100 / (L / 16)}%`;
  });
  return { el, destroy: () => { off(); stop(); } };
}
