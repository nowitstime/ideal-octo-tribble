// Chords: one column per chord in the key. Height picks the voicing,
// a second finger holds modifiers, the strum strip plucks the current chord.
import { h, everyFrame } from '../ui/dom';
import { project, update, loopSteps, chordsFromProgression } from '../state';
import { transport, playChordNote } from '../audio/transport';
import { engine, type Voice } from '../audio/engine';
import { chordInfo, chordMidis, keyName, type Mods } from '../theory';
import { degreeColor } from '../ui/colors';
import { instrumentHeader, setSubtitle } from '../ui/header';
import { transportBar } from '../ui/transportBar';
import { knob } from '../ui/knob';
import { presetSwitch } from '../ui/presetSwitch';
import { CHORD_PRESETS, presetByName } from '../audio/presets';
import { confirmButton } from './drums';
import { noteLane } from '../ui/noteLane';
import { onMove } from '../ui/dom';

let lastDegree = 0;

export function chordsScreen(root: HTMLElement, tab: 'play' | 'set'): () => void {
  const cleanups: (() => void)[] = [];
  const tb = transportBar();
  cleanups.push(tb.destroy);
  const body = h('div', { class: 'inst-body' });
  root.append(h('div', { class: 'screen' }, instrumentHeader('chords', 'Chords', `${project.chords.preset} · ${keyName(project.key, project.mode)}`, tab), body, tb.el));
  (tab === 'play' ? playTab : setTab)(body, cleanups);
  return () => cleanups.forEach((c) => c());
}

/** Degree of the progression chord being heard now (or null when stopped). */
function currentProgDegree(): number | null {
  if (!transport.playing) return null;
  const L = loopSteps(project);
  const idx = Math.floor(transport.heardStep() / (L / project.progression.length));
  return project.progression[idx] ?? null;
}

function playTab(body: HTMLElement, cleanups: (() => void)[]) {
  const mods: Mods = {};

  // ---------- progression strip ----------
  const strip = h('a', { class: 'mini-prog', href: '#/progression' });
  const stripCells = project.progression.map((d) =>
    h('span', { style: { background: degreeColor(d) }, text: chordInfo(project.key, project.mode, d).name }));
  strip.append(...stripCells);
  body.append(strip);
  const lane = noteLane('chords');
  cleanups.push(lane.destroy);
  body.append(lane.el);

  // ---------- columns ----------
  const grid = h('div', { class: 'chord-grid' });
  const cols = Array.from({ length: 7 }, (_, d) => {
    const info = chordInfo(project.key, project.mode, d);
    return h('div', { class: 'chord-col', style: { background: degreeColor(d) } },
      h('span', { class: 'mono small', text: info.numeral }),
      h('span', { class: 'chord-name', text: info.name }),
      h('span', { class: 'now-dot' }),
      h('span', { class: 'zones' }, h('span'), h('span'), h('span')),
    );
  });
  grid.append(...cols);
  body.append(grid);

  interface Touch { col: number; inv: number; voice: Voice; finish: ((e: PointerEvent) => void) | null; ring: HTMLElement }
  const touches = new Map<number, Touch>();
  const held = new Array(7).fill(0);

  const locate = (e: PointerEvent) => {
    const r = grid.getBoundingClientRect();
    const col = Math.min(6, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * 7)));
    const f = (e.clientY - r.top) / r.height;
    const inv = f < 0.4 ? 2 : f < 0.7 ? 1 : 0;
    return { col, inv, x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const setHeld = (col: number, delta: number) => {
    held[col] += delta;
    cols[col].style.background = degreeColor(col, held[col] > 0);
  };

  const begin = (e: PointerEvent, col: number, inv: number, x: number, y: number) => {
    const n = { degree: col, inv, mods: { ...mods }, vel: 0.75 };
    const voice = playChordNote(n, engine.now);
    const finish = transport.beginChordRecord(e, col, inv, mods, n.vel);
    const ring = h('span', { class: 'touch-ring' });
    grid.append(ring);
    Object.assign(ring.style, { left: `${x}px`, top: `${y}px` });
    setHeld(col, 1);
    lastDegree = col;
    touches.set(e.pointerId, { col, inv, voice, finish, ring });
  };

  const end = (e: PointerEvent) => {
    const t = touches.get(e.pointerId);
    if (!t) return;
    t.voice.release(engine.now);
    t.finish?.(e);
    t.ring.remove();
    setHeld(t.col, -1);
    touches.delete(e.pointerId);
  };

  grid.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    engine.ensure();
    grid.setPointerCapture(e.pointerId);
    const { col, inv, x, y } = locate(e);
    begin(e, col, inv, x, y);
  });
  onMove(grid, (e) => {
    const t = touches.get(e.pointerId);
    if (!t) return;
    const { col, inv, x, y } = locate(e);
    Object.assign(t.ring.style, { left: `${x}px`, top: `${y}px` });
    if (col !== t.col || inv !== t.inv) { end(e); begin(e, col, inv, x, y); }
  });
  grid.addEventListener('pointerup', end);
  grid.addEventListener('pointercancel', end);

  // ---------- modifiers ----------
  const modDefs: [keyof Mods, string][] = [['seventh', '7'], ['sus', 'sus'], ['add9', 'add9']];
  const modRow = h('div', { class: 'mods' }, ...modDefs.map(([k, label]) => {
    const b = h('button', { class: 'mod', text: label });
    const on = (e: PointerEvent) => { e.preventDefault(); mods[k] = true; b.classList.add('on'); };
    const off = () => { mods[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('pointerleave', off);
    return b;
  }));
  body.append(modRow);

  // ---------- strum strip ----------
  const strum = h('div', { class: 'strum', 'aria-label': 'Strum strip' }, ...Array.from({ length: 6 }, () => h('span')));
  let lastString = -1;
  const pluck = (e: PointerEvent) => {
    const r = strum.getBoundingClientRect();
    const i = Math.min(5, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * 6)));
    if (i === lastString) return;
    lastString = i;
    const deg = currentProgDegree() ?? lastDegree;
    const notes = chordMidis(project.key, project.mode, deg, 1, mods).slice(1);
    while (notes.length < 6) notes.push(notes[notes.length - 3] + 12);
    engine.voice(presetByName(CHORD_PRESETS, 'Pluck'), notes[i], engine.now, 0.9, { brightness: 0.7, level: project.chords.level, release: 0.6 }).release(engine.now + 0.25);
    const line = strum.children[i] as HTMLElement;
    line.animate([{ transform: 'scaleX(3)' }, { transform: 'scaleX(1)' }], { duration: 300, easing: 'ease-out' });
  };
  strum.addEventListener('pointerdown', (e) => { e.preventDefault(); engine.ensure(); strum.setPointerCapture(e.pointerId); lastString = -1; pluck(e); });
  strum.addEventListener('pointermove', (e) => { if (strum.hasPointerCapture(e.pointerId)) pluck(e); });
  body.append(strum, h('p', { class: 'hint', text: 'slide up for brighter voicings · hold 7 / sus / add9 · drag across the strings' }));

  // ---------- follow the progression ----------
  let cur = -2;
  cleanups.push(everyFrame(() => {
    const d = currentProgDegree();
    const L = loopSteps(project);
    const idx = transport.playing ? Math.floor(transport.heardStep() / (L / project.progression.length)) : -1;
    if (idx === cur) return;
    cur = idx;
    stripCells.forEach((c, i) => { c.classList.toggle('now', i === idx); c.style.background = degreeColor(project.progression[i], i === idx); });
    cols.forEach((c, i) => c.classList.toggle('now', i === d));
  }));
}

function setTab(body: HTMLElement, cleanups: (() => void)[]) {
  body.classList.add('scroll');
  const c = project.chords;
  const set = (k: 'cutoff' | 'release' | 'level') => (v: number) => update((p) => { p.chords[k] = v; });
  const audition = () => {
    engine.ensure();
    playChordNote({ degree: lastDegree, inv: 1, mods: {}, vel: 0.75 }, engine.now).release(engine.now + 0.6);
  };
  body.append(
    h('div', { class: 'section' },
      h('div', { class: 'section-title' }, h('h2', { text: 'Sound' })),
      presetSwitch(CHORD_PRESETS.map((p) => p.name), c.preset, (name) => {
        update((p) => { p.chords.preset = name; p.chords.release = presetByName(CHORD_PRESETS, name).amp.r; });
        setSubtitle(`${name} · ${keyName(project.key, project.mode)}`);
        audition();
      }),
      h('div', { class: 'knobs' },
        knob({ label: 'Tone', min: 0, max: 1, value: c.cutoff, reset: 0.55, color: '#C8BCE9', format: (v) => `${Math.round(v * 100)}`, onChange: set('cutoff') }),
        knob({ label: 'Release', min: 0.05, max: 3, value: c.release, reset: 0.5, color: '#C8BCE9', format: (v) => `${v.toFixed(2)} s`, onChange: set('release') }),
        knob({ label: 'Level', min: 0, max: 1, value: c.level, reset: 0.7, color: '#C8BCE9', format: (v) => `${Math.round(v * 100)}`, onChange: set('level') }),
      ),
      h('div', { class: 'row-buttons' }, h('button', { class: 'chip', text: 'Audition', onClick: audition })),
    ),
    h('div', { class: 'section' },
      h('div', { class: 'section-title' }, h('h2', { text: 'Pattern' })),
      h('div', { class: 'row-buttons' },
        h('a', { class: 'chip', href: '#/progression', text: 'Key & progression' }),
        confirmButton('Refill from progression', () => update((p) => { p.chords.notes = chordsFromProgression(p); })),
        confirmButton('Clear chords', () => update((p) => { p.chords.notes = []; })),
      ),
    ),
  );
}
