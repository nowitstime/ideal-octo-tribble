// Play / record / undo / redo and a loop progress line, shared by every screen.
import { h, everyFrame } from './dom';
import { transport } from '../audio/transport';
import { project, loopSteps, undo, redo, canUndo, canRedo, subscribe } from '../state';

const playIcon = '<svg width="18" height="20" viewBox="0 0 18 20" aria-hidden="true"><path d="M3 2 L16 10 L3 18 Z" fill="currentColor"/></svg>';
const stopIcon = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect width="16" height="16" fill="currentColor"/></svg>';
const undoIcon = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 5L3 9l4 4"/><path d="M3 9h9a5 5 0 0 1 0 10h-2"/></svg>';
const redoIcon = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 5l4 4-4 4"/><path d="M17 9H8a5 5 0 0 0 0 10h2"/></svg>';

/** After undo/redo the project object is replaced, so rebuild the current screen. */
const remount = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

export function transportBar(big = false): { el: HTMLElement; destroy: () => void } {
  const play = h('button', { class: 'tb-play', 'aria-label': 'Play', onClick: () => transport.toggle() });
  const rec = h('button', { class: 'tb-rec', 'aria-label': 'Record', onClick: () => transport.toggleRecord() });
  const undoBtn = h('button', { class: 'tb-edit', 'aria-label': 'Undo', onClick: () => { if (canUndo()) { undo(); remount(); } } });
  const redoBtn = h('button', { class: 'tb-edit', 'aria-label': 'Redo', onClick: () => { if (canRedo()) { redo(); remount(); } } });
  undoBtn.innerHTML = undoIcon;
  redoBtn.innerHTML = redoIcon;
  const fill = h('span', { class: 'tb-fill' });
  const dot = h('span', { class: 'tb-dot' });
  const pos = h('span', { class: 'tb-pos' });
  const mode = h('span', { class: 'tb-mode' });

  const buttons = big ? [undoBtn, play, rec, redoBtn] : [play, rec, undoBtn, redoBtn];
  const el = h('div', { class: `transport ${big ? 'big' : ''}` },
    h('div', { class: 'tb-buttons' }, ...buttons),
    h('div', { class: 'tb-track' }, h('span', { class: 'tb-line' }), fill, dot),
    h('div', { class: 'tb-labels' }, mode, pos),
  );

  const sync = () => {
    play.innerHTML = transport.playing ? stopIcon : playIcon;
    play.setAttribute('aria-label', transport.playing ? 'Stop' : 'Play');
    rec.classList.toggle('on', transport.recording);
    mode.textContent = big
      ? (transport.recording ? (project.quantize ? 'recording · quantized' : 'recording') : transport.playing ? 'playing' : 'stopped')
      : (transport.recording ? (project.quantize ? 'rec · q' : 'rec') : transport.playing ? 'play' : 'stop');
    undoBtn.classList.toggle('off', !canUndo());
    redoBtn.classList.toggle('off', !canRedo());
  };
  const offState = transport.onState(sync);
  const offProject = subscribe(sync);
  sync();

  const stopFrame = everyFrame(() => {
    const L = loopSteps(project);
    const s = transport.heardStep();
    const f = transport.playing ? s / L : 0;
    fill.style.width = `${f * 100}%`;
    dot.style.left = `${f * 100}%`;
    const bars = `${project.bars} bar${project.bars > 1 ? 's' : ''}`;
    const at = `${Math.floor(s / 16) + 1}.${Math.floor((s % 16) / 4) + 1}`;
    pos.textContent = transport.playing ? (big ? `${at}  ·  ${bars}` : at) : bars;
  });

  return { el, destroy: () => { offState(); offProject(); stopFrame(); } };
}
