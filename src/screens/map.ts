// Home: the loop as a ring, instruments hanging off it on strings,
// the chord progression threaded in from above.
import { h, svg, everyFrame } from '../ui/dom';
import { project, update, subscribe, loopSteps, setBars } from '../state';
import { transport } from '../audio/transport';
import { TRACKS, type TrackId } from '../state';
import { engine } from '../audio/engine';
import { chordInfo, keyName } from '../theory';
import { degreeColor, TRACK_COLOR } from '../ui/colors';
import { transportBar } from '../ui/transportBar';

interface Slot {
  id: string;
  name: string;
  route?: string;
  corner: 'tl' | 'tr' | 'bl' | 'br';
}

const SLOTS: Slot[] = [
  { id: 'drums', name: 'Drums', route: 'drums', corner: 'tl' },
  { id: 'chords', name: 'Chords', route: 'chords', corner: 'tr' },
  { id: 'bass', name: 'Bass', route: 'bass', corner: 'bl' },
  { id: 'lead', name: 'Lead', route: 'lead', corner: 'br' },
];

export function mapScreen(root: HTMLElement): () => void {
  const cleanups: (() => void)[] = [];

  // ---------- header ----------
  const bpmNum = h('span', { class: 'bpm-num' });
  const bpm = h('div', { class: 'bpm', role: 'slider', 'aria-label': 'Tempo, drag up or down' }, bpmNum, h('span', { class: 'mono muted small', text: 'bpm ↕' }));
  let dragY = 0, dragBpm = 0;
  bpm.addEventListener('pointerdown', (e) => { bpm.setPointerCapture(e.pointerId); dragY = e.clientY; dragBpm = project.bpm; });
  bpm.addEventListener('pointermove', (e) => {
    if (!bpm.hasPointerCapture(e.pointerId)) return;
    const v = Math.round(Math.min(200, Math.max(50, dragBpm + (dragY - e.clientY) / 4)));
    if (v !== project.bpm) transport.setBpm(v);
  });

  const keyLink = h('a', { href: '#/progression', class: 'mono muted' });
  const header = h('header', { class: 'map-head' },
    h('div', { class: 'map-title' }, h('h1', { text: project.name }), keyLink),
    bpm,
  );

  // ---------- progression ----------
  const prog = h('a', { class: 'prog', href: '#/progression', 'aria-label': 'Chord progression, tap to change' });

  // ---------- map area ----------
  const area = h('div', { class: 'map-area' });
  const strings = svg('svg', { class: 'map-svg', 'aria-hidden': 'true' });
  area.append(strings);
  const center = h('div', { class: 'ring-center' }, h('span', { class: 'ring-pos' }), h('span', { class: 'mono muted small', text: 'bar · beat' }));
  area.append(center);

  const squares = new Map<string, HTMLElement>();
  const stringPaths = new Map<string, SVGPathElement>();
  for (const s of SLOTS) {
    const active = !!s.route;
    const sq = h(active ? 'a' : 'div', {
      class: `track-sq ${active ? '' : 'soon'}`,
      href: active ? `#/${s.route}` : null,
      style: { background: TRACK_COLOR[s.id as keyof typeof TRACK_COLOR] },
    },
      h('span', { class: 'track-name', text: s.name }),
      h('span', { class: 'track-cells' }),
    );
    if (active) {
      const mute = h('button', { class: 'mute', 'aria-label': `Mute ${s.name}` });
      mute.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        update((p) => { const t = p[s.id as TrackId]; t.muted = !t.muted; });
      });
      sq.append(mute);
    } else {
      sq.append(h('span', { class: 'mono small', text: 'soon' }));
    }
    squares.set(s.id, sq);
    area.append(sq);
  }

  // ---------- controls ----------
  const barsBtns = ([1, 2, 4] as const).map((b) =>
    h('button', { class: 'seg', text: String(b), onClick: () => update((p) => setBars(p, b)) }));
  const quant = h('button', { class: 'chip', onClick: () => update((p) => { p.quantize = !p.quantize; }) });
  const click = h('button', { class: 'chip', onClick: () => update((p) => { p.click = !p.click; }) });
  const controls = h('div', { class: 'map-controls' },
    h('div', { class: 'segs' }, h('span', { class: 'mono muted small', text: 'bars' }), ...barsBtns),
    h('div', { class: 'chips' }, quant, click),
  );

  const tb = transportBar(true);
  cleanups.push(tb.destroy);

  const screen = h('div', { class: 'screen map' }, header, prog, area, controls, tb.el);
  root.append(screen);

  // ---------- geometry ----------
  let geo = { cx: 0, cy: 0, r: 80 };
  const ringBg = svg('circle', { class: 'ring-bg' });
  const ringArc = svg('path', { class: 'ring-arc' });
  const ringDot = svg('circle', { r: 6, class: 'ring-dot' });
  const drop = svg('path', { class: 'string' });
  const dropDot = svg('circle', { r: 3.5, class: 'node' });

  function layout() {
    const W = area.clientWidth, H = area.clientHeight;
    const s = Math.min(112, W * 0.27, H * 0.24);
    const r = Math.max(48, Math.min(92, W * 0.21, H * 0.19));
    const cx = W / 2, cy = H / 2 + 6;
    geo = { cx, cy, r };
    strings.setAttribute('viewBox', `0 0 ${W} ${H}`);
    strings.replaceChildren();
    ringBg.setAttribute('cx', String(cx)); ringBg.setAttribute('cy', String(cy)); ringBg.setAttribute('r', String(r));
    drop.setAttribute('d', `M${cx} 0 L ${cx} ${cy - r}`);
    dropDot.setAttribute('cx', String(cx)); dropDot.setAttribute('cy', String(cy - r));
    strings.append(drop, ringBg, ringArc);

    const gapY = Math.max(14, Math.min(r * 0.7, H / 2 - s - 8));
    for (const slot of SLOTS) {
      const sq = squares.get(slot.id)!;
      const left = slot.corner.endsWith('l');
      const top = slot.corner.startsWith('t');
      const x = left ? 0 : W - s;
      const y = top ? cy - s - gapY : cy + gapY;
      Object.assign(sq.style, { left: `${x}px`, top: `${y}px`, width: `${s}px`, height: `${s}px` });
      // String from the square's inner edge to the ring.
      const x0 = left ? x + s : x;
      const y0 = top ? y + s * 0.8 : y + s * 0.2;
      // Meet the ring at the point facing the string's start.
      const a = Math.atan2(y0 - cy, x0 - cx);
      const x1 = cx + r * Math.cos(a), y1 = cy + r * Math.sin(a);
      const dir = left ? 1 : -1;
      const p = svg('path', {
        class: `string ${slot.route ? '' : 'faint'}`,
        d: `M${x0} ${y0} C ${x0 + 14 * dir} ${y0}, ${x1 + 14 * Math.cos(a)} ${y1 + 14 * Math.sin(a)}, ${x1} ${y1}`,
      });
      stringPaths.set(slot.id, p);
      strings.append(p);
      if (slot.route) {
        strings.append(svg('circle', { class: 'node', r: 3.5, cx: x0, cy: y0 }), svg('circle', { class: 'node', r: 3.5, cx: x1, cy: y1 }));
      }
    }
    strings.append(dropDot, ringDot);
    Object.assign(center.style, { left: `${cx}px`, top: `${cy}px` });
  }
  const ro = new ResizeObserver(layout);
  ro.observe(area);
  cleanups.push(() => ro.disconnect());

  // ---------- state → view ----------
  let progCells: HTMLElement[] = [];
  function render() {
    bpmNum.textContent = String(project.bpm);
    keyLink.textContent = keyName(project.key, project.mode);
    progCells = project.progression.map((d) => {
      const info = chordInfo(project.key, project.mode, d);
      return h('span', { class: 'prog-cell', style: { background: degreeColor(d) } },
        h('span', { class: 'prog-name', text: info.name }),
        h('span', { class: 'mono small', text: info.numeral }));
    });
    prog.replaceChildren(...progCells);
    prog.classList.toggle('many', project.progression.length > 4);
    barsBtns.forEach((b, i) => b.classList.toggle('on', [1, 2, 4][i] === project.bars));
    quant.textContent = project.quantize ? 'quantize 1/16' : 'quantize off';
    quant.classList.toggle('on', project.quantize);
    click.textContent = project.click ? 'click on' : 'click off';
    click.classList.toggle('on', project.click);
    for (const id of TRACKS) {
      const sq = squares.get(id)!;
      sq.classList.toggle('is-muted', project[id].muted);
      const cells = sq.querySelector('.track-cells')!;
      const on = new Array(8).fill(false);
      const notes = project[id].notes as { step: number }[];
      for (const n of notes) if (n.step < 16) on[Math.floor(n.step / 2)] = true;
      cells.replaceChildren(...on.map((v) => h('span', { class: v ? 'on' : '' })));
      stringPaths.get(id)?.classList.toggle('faint', project[id].muted);
    }
  }
  render();
  cleanups.push(subscribe(render));

  // ---------- animation ----------
  let curIdx = -1;
  cleanups.push(everyFrame(() => {
    const L = loopSteps(project);
    const s = transport.heardStep();
    const f = transport.playing ? s / L : 0;
    const { cx, cy, r } = geo;
    const a = -Math.PI / 2 + f * 2 * Math.PI;
    const ex = cx + r * Math.cos(a), ey = cy + r * Math.sin(a);
    ringArc.setAttribute('d', f > 0.001 ? `M${cx} ${cy - r} A ${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${ex} ${ey}` : '');
    ringDot.setAttribute('cx', String(ex));
    ringDot.setAttribute('cy', String(ey));
    (center.firstChild as HTMLElement).textContent = transport.playing ? `${Math.floor(s / 16) + 1}.${Math.floor((s % 16) / 4) + 1}` : '–';
    const idx = transport.playing ? Math.floor(s / (L / project.progression.length)) : -1;
    if (idx !== curIdx) {
      curIdx = idx;
      progCells.forEach((c, i) => {
        c.style.background = degreeColor(project.progression[i], i === idx);
        c.classList.toggle('now', i === idx);
      });
    }
  }));

  // Pulse squares and strings in time with what you hear.
  cleanups.push(transport.onHit((track, t, detail) => {
    if (track === 'drums' && ![0, 1, 2, 8, 9, 10].includes(detail)) return;
    const delay = Math.max(0, (t - engine.now + engine.outputDelay) * 1000);
    setTimeout(() => {
      squares.get(track)?.animate([{ transform: 'scale(0.96)' }, { transform: 'scale(1)' }], { duration: 160, easing: 'ease-out' });
      stringPaths.get(track)?.animate([{ strokeWidth: 3.5 }, { strokeWidth: 1.5 }], { duration: 220, easing: 'ease-out' });
    }, delay);
  }));

  return () => cleanups.forEach((c) => c());
}
