// Key & progression picker. The seven chords of the key sit on a circle and a
// progression is drawn as the shape that connects them.
import { h, svg } from '../ui/dom';
import { project, update, chordsFromProgression } from '../state';
import { engine } from '../audio/engine';
import { playChordNote } from '../audio/transport';
import { chordInfo, FIFTHS, NOTE_NAMES, PRESETS, type Mode } from '../theory';
import { degreeColor } from '../ui/colors';
import { backHeader } from '../ui/header';

export function progressionScreen(root: HTMLElement): () => void {
  let key = project.key;
  let mode: Mode = project.mode;
  let degrees = [...project.progression];
  let name = project.progressionName;
  let previewTimers: number[] = [];

  const use = h('button', { class: 'pill', text: 'Use' });
  use.addEventListener('click', () => {
    update((p) => {
      p.key = key;
      p.mode = mode;
      p.progression = [...degrees];
      p.progressionName = name;
      p.chords.notes = chordsFromProgression(p);
    });
    location.hash = '#/';
  });

  const keysRow = h('div', { class: 'keys' });
  const modeTabs = h('div', { class: 'tabs left' });
  const stage = h('div', { class: 'constellation' });
  const list = h('div', { class: 'preset-list' });
  const body = h('div', { class: 'inst-body scroll' }, keysRow, modeTabs, stage, list);
  root.append(h('div', { class: 'screen' }, backHeader('Progression', use), body));

  const audition = (deg: number, t = engine.now, len = 0.55) => {
    engine.ensure();
    playChordNote({ degree: deg, inv: 1, mods: {}, vel: 0.7 }, t).release(t + len);
  };

  // Uses the draft key/mode, so temporarily swap them in while scheduling.
  const withDraft = (fn: () => void) => {
    const saved = { key: project.key, mode: project.mode };
    project.key = key; project.mode = mode;
    try { fn(); } finally { project.key = saved.key; project.mode = saved.mode; }
  };

  const preview = (degs: number[]) => {
    previewTimers.forEach(clearTimeout);
    previewTimers = [];
    engine.ensure();
    withDraft(() => degs.forEach((d, i) => audition(d, engine.now + 0.05 + i * 0.5, 0.45)));
  };

  function render() {
    // Keys in circle-of-fifths order.
    keysRow.replaceChildren(...FIFTHS.map((k) => h('button', {
      class: `key ${k === key ? 'on' : ''}`, text: NOTE_NAMES[k],
      onClick: () => { key = k; render(); withDraft(() => audition(degrees[0])); },
    })));
    modeTabs.replaceChildren(...(['major', 'minor'] as Mode[]).map((m) => h('button', {
      class: m === mode ? 'on' : '', text: m[0].toUpperCase() + m.slice(1),
      onClick: () => {
        if (m === mode) return;
        mode = m;
        const first = PRESETS[m][0];
        degrees = [...first.degrees];
        name = first.name;
        render();
      },
    })));

    // Constellation.
    const size = Math.min(stage.clientWidth || 340, 330);
    const R = size * 0.37, c = size / 2, sq = Math.round(size * 0.14);
    const pt = (i: number, r = R) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 7;
      return [c + r * Math.cos(a), c + r * Math.sin(a)];
    };
    const pts = [...degrees, degrees[0]].map((d) => pt(d));
    const art = svg('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, 'aria-hidden': 'true' },
      svg('circle', { cx: c, cy: c, r: R, class: 'ring-bg' }),
      svg('path', { d: 'M' + pts.map((p) => p.join(' ')).join(' L '), class: 'shape' }),
    );
    const nodes = Array.from({ length: 7 }, (_, d) => {
      const [x, y] = pt(d);
      const on = degrees.includes(d);
      const info = chordInfo(key, mode, d);
      const b = h('button', {
        class: 'node-sq', text: info.name, 'aria-label': `${info.name}, ${info.numeral}`,
        style: { left: `${x - sq / 2}px`, top: `${y - sq / 2}px`, width: `${sq}px`, height: `${sq}px`, background: degreeColor(d), opacity: on ? '1' : '0.4' },
      });
      b.addEventListener('pointerdown', () => withDraft(() => audition(d)));
      return b;
    });
    const order = degrees.map((d, i) => {
      const [x, y] = pt(d, R + sq * 0.95);
      return h('span', { class: 'order mono small', text: String(i + 1), style: { left: `${x}px`, top: `${y}px` } });
    });
    const label = h('div', { class: 'const-label' },
      h('span', { class: 'const-name', text: name }),
      h('span', { class: 'mono muted small', text: degrees.map((d) => chordInfo(key, mode, d).numeral).join('  ') }));
    const inner = h('div', { class: 'const-inner', style: { width: `${size}px`, height: `${size}px` } }, art, ...nodes, ...order);
    stage.replaceChildren(inner, label);

    // Presets with tiny shape thumbnails.
    list.replaceChildren(...PRESETS[mode].map((p) => {
      const tp = (i: number) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 7;
        return `${(22 + 17 * Math.cos(a)).toFixed(1)},${(22 + 17 * Math.sin(a)).toFixed(1)}`;
      };
      const thumb = svg('svg', { width: 44, height: 44, viewBox: '0 0 44 44', 'aria-hidden': 'true' },
        svg('circle', { cx: 22, cy: 22, r: 17, class: 'ring-bg' }),
        svg('polyline', { points: [...p.degrees, p.degrees[0]].map(tp).join(' '), class: 'shape thin' }));
      const selected = p.name === name;
      return h('button', {
        class: `preset ${selected ? 'on' : ''}`,
        onClick: () => { degrees = [...p.degrees]; name = p.name; render(); preview(degrees); },
      },
        thumb,
        h('span', { class: 'preset-text' },
          h('span', { class: 'preset-name', text: p.name }),
          h('span', { class: 'mono muted small', text: p.degrees.map((d) => chordInfo(key, mode, d).numeral).join(' · ') })),
        h('span', { class: 'mono muted small', text: p.mood }));
    }));
  }

  requestAnimationFrame(render);
  const onResize = () => render();
  window.addEventListener('resize', onResize);
  return () => {
    window.removeEventListener('resize', onResize);
    previewTimers.forEach(clearTimeout);
  };
}
