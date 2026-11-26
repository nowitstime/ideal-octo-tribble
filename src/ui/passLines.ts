// Pass lines: one thin line per recorded take under a track, newest at the
// bottom. Tap a line to select it, then mute it to compare or ✕ to delete it.
import { h } from './dom';
import { project, update, subscribe, loopTicks, type TrackId } from '../state';
import { takesIn } from '../takes';

/** Selected take per track, kept while moving between pages. */
const selected: Partial<Record<TrackId, number>> = {};

export function passLines(track: TrackId): { el: HTMLElement; destroy: () => void } {
  const title = h('span');
  const muteBtn = h('button', { class: 'text-btn' });
  const delBtn = h('button', { class: 'text-btn', text: '✕ delete' });
  const actions = h('span', { class: 'pass-actions' }, muteBtn, delBtn);
  const list = h('div', { class: 'pass-list scroll', role: 'list' });
  const el = h('div', { class: 'passes' }, h('div', { class: 'lane-labels mono muted small' }, title, actions), list);

  muteBtn.addEventListener('click', () => {
    const take = selected[track];
    if (take === undefined) return;
    update((p) => {
      const m = p[track].mutedTakes;
      p[track].mutedTakes = m.includes(take) ? m.filter((t) => t !== take) : [...m, take];
    });
  });
  delBtn.addEventListener('click', () => {
    const take = selected[track];
    if (take === undefined) return;
    selected[track] = undefined;
    update((p) => {
      const t = p[track] as { notes: { take?: number }[] };
      t.notes = t.notes.filter((n) => n.take !== take);
      p[track].mutedTakes = p[track].mutedTakes.filter((t) => t !== take);
    });
  });

  let shown = 0;
  function render() {
    const notes: { tick: number; take?: number }[] = project[track].notes;
    const takes = takesIn(notes);
    const muted = project[track].mutedTakes;
    if (selected[track] !== undefined && !takes.includes(selected[track]!)) selected[track] = undefined;
    const sel = selected[track];

    title.textContent = takes.length === 0
      ? 'passes · each recorded pass shows here'
      : sel !== undefined ? `pass ${takes.indexOf(sel) + 1} of ${takes.length}` : `${takes.length} pass${takes.length === 1 ? '' : 'es'} · tap one`;
    actions.style.visibility = sel !== undefined ? 'visible' : 'hidden';
    muteBtn.textContent = sel !== undefined && muted.includes(sel) ? 'unmute' : 'mute';

    const L = loopTicks(project);
    list.replaceChildren(...takes.map((take, i) => {
      const row = h('button', {
        class: `pass ${take === sel ? 'on' : ''} ${muted.includes(take) ? 'muted' : ''}`,
        role: 'listitem',
        'aria-label': `Pass ${i + 1}${muted.includes(take) ? ', muted' : ''}`,
      }, h('span', { class: 'pass-num mono', text: String(i + 1) }));
      const line = h('span', { class: 'pass-line' });
      for (const n of notes) {
        if (n.take === take && n.tick < L) line.append(h('span', { class: 'pass-dot', style: { left: `${(n.tick / L) * 100}%` } }));
      }
      row.append(line);
      row.addEventListener('click', () => { selected[track] = take === selected[track] ? undefined : take; render(); });
      return row;
    }));
    // Keep the newest pass in view as passes are added.
    if (takes.length > shown) list.scrollTop = list.scrollHeight;
    shown = takes.length;
  }

  render();
  const off = subscribe(render);
  return { el, destroy: off };
}

