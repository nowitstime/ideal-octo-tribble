// Play / record controls and a loop progress line, shared by every screen.
import { h, everyFrame } from './dom';
import { transport } from '../audio/transport';
import { project, loopSteps } from '../state';

export function transportBar(big = false): { el: HTMLElement; destroy: () => void } {
  const playIcon = '<svg width="18" height="20" viewBox="0 0 18 20" aria-hidden="true"><path d="M3 2 L16 10 L3 18 Z" fill="currentColor"/></svg>';
  const stopIcon = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect width="16" height="16" fill="currentColor"/></svg>';

  const play = h('button', { class: 'tb-play', 'aria-label': 'Play', onClick: () => transport.toggle() });
  const rec = h('button', { class: 'tb-rec', 'aria-label': 'Record', onClick: () => transport.toggleRecord() });
  const fill = h('span', { class: 'tb-fill' });
  const dot = h('span', { class: 'tb-dot' });
  const pos = h('span', { class: 'tb-pos' });
  const mode = h('span', { class: 'tb-mode' });

  const el = h('div', { class: `transport ${big ? 'big' : ''}` },
    h('div', { class: 'tb-buttons' }, play, rec),
    h('div', { class: 'tb-track' }, h('span', { class: 'tb-line' }), fill, dot),
    h('div', { class: 'tb-labels' }, mode, pos),
  );

  const sync = () => {
    play.innerHTML = transport.playing ? stopIcon : playIcon;
    play.setAttribute('aria-label', transport.playing ? 'Stop' : 'Play');
    rec.classList.toggle('on', transport.recording);
    mode.textContent = transport.recording ? (project.quantize ? 'recording · quantized' : 'recording') : transport.playing ? 'playing' : 'stopped';
  };
  const offState = transport.onState(sync);
  sync();

  const stopFrame = everyFrame(() => {
    const L = loopSteps(project);
    const s = transport.heardStep();
    const f = transport.playing ? s / L : 0;
    fill.style.width = `${f * 100}%`;
    dot.style.left = `${f * 100}%`;
    const bar = Math.floor(s / 16) + 1;
    const beat = Math.floor((s % 16) / 4) + 1;
    pos.textContent = transport.playing ? `${bar}.${beat}  ·  ${project.bars} bar${project.bars > 1 ? 's' : ''}` : `${project.bars} bar${project.bars > 1 ? 's' : ''}`;
  });

  return { el, destroy: () => { offState(); stopFrame(); } };
}
