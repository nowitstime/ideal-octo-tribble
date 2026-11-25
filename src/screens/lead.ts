// Lead: two rows of big note tiles (top row an octave above the bottom).
// Touch = exactly in tune. Slide sideways to glide to the next tile, push
// up/down to bend. "Chord notes" shows only notes of the chord playing now.
// In Arp mode, touching spawns an orb that arpeggiates the chord in time.
import { h, everyFrame, onMove } from '../ui/dom';
import { project, update, chordDegreeAt, loopSteps, type ArpPattern } from '../state';
import { transport, playLead, type LiveBend } from '../audio/transport';
import { engine, type Voice } from '../audio/engine';
import { LEAD_PRESETS } from '../audio/presets';
import { leadMidi, NOTE_NAMES } from '../theory';
import { degreeColor } from '../ui/colors';
import { instrumentHeader, setSubtitle } from '../ui/header';
import { transportBar } from '../ui/transportBar';
import { bendStrip } from '../ui/bendStrip';
import { presetSwitch } from '../ui/presetSwitch';
import { knob } from '../ui/knob';
import { noteLane } from '../ui/noteLane';
import { confirmButton } from './drums';

const PATTERNS: ArpPattern[] = ['up', 'down', 'updown', 'random'];
const PATTERN_LABEL: Record<ArpPattern, string> = { up: 'up', down: 'down', updown: 'up-down', random: 'random' };
/** Finger travel (px) for a full-range bend on a tile. */
const BEND_PX = 70;
const RATES = [2, 1, 0.5]; // left → right: 1/8, 1/16, 1/32
let arpMode = false;
let chordOnly = true;

export function leadScreen(root: HTMLElement, tab: 'play' | 'set'): () => void {
  const cleanups: (() => void)[] = [];
  const tb = transportBar();
  cleanups.push(tb.destroy);
  const body = h('div', { class: 'inst-body' });
  root.append(h('div', { class: 'screen' }, instrumentHeader('lead', 'Lead', project.lead.preset, tab), body, tb.el));
  (tab === 'play' ? playTab : setTab)(body, cleanups);
  return () => cleanups.forEach((c) => c());
}

function playTab(body: HTMLElement, cleanups: (() => void)[]) {
  const offset = () => project.lead.octave * 7;
  const midiOf = (deg: number) => leadMidi(project.key, project.mode, deg);

  // ---------- top controls ----------
  const modeTabs = h('div', { class: 'tabs left' });
  const notesToggle = h('button', { class: 'chip' });
  notesToggle.addEventListener('click', () => { chordOnly = !chordOnly; renderTop(); renderTiles(true); });
  const octLabel = h('span', { class: 'mono small' });
  const setOct = (d: number) => { update((p) => { p.lead.octave = Math.max(-1, Math.min(1, p.lead.octave + d)); }); renderTop(); renderTiles(true); };
  const oct = h('div', { class: 'oct' },
    h('button', { class: 'icon-btn', 'aria-label': 'Octave down', text: '−', onClick: () => setOct(-1) }),
    octLabel,
    h('button', { class: 'icon-btn', 'aria-label': 'Octave up', text: '+', onClick: () => setOct(1) }));
  const patternRow = h('div', { class: 'pattern-row' });
  body.append(h('div', { class: 'lead-top' }, modeTabs, h('div', { class: 'lead-top-right' }, notesToggle, oct)));

  const lane = noteLane('lead');
  cleanups.push(lane.destroy);
  body.append(lane.el, patternRow);

  // ---------- tiles ----------
  const rowEls = [h('div', { class: 'tile-row' }), h('div', { class: 'tile-row' })];
  const guides = h('div', { class: 'rate-guides' }, h('span', { text: '1/8' }), h('span', { text: '1/16' }), h('span', { text: '1/32' }));
  const field = h('div', { class: 'field' }, ...rowEls, guides);
  let stripBend = 0;
  const strip = bendStrip(() => project.lead.bendRange, (s) => { stripBend = s; onStripBend(); });
  body.append(h('div', { class: 'play-row' }, field, strip));
  const hint = h('p', { class: 'hint' });
  body.append(hint);

  function renderTop() {
    modeTabs.replaceChildren(
      h('button', { class: arpMode ? '' : 'on', text: 'Play', onClick: () => { arpMode = false; renderTop(); } }),
      h('button', { class: arpMode ? 'on' : '', text: 'Arp', onClick: () => { arpMode = true; renderTop(); } }));
    notesToggle.textContent = chordOnly ? 'chord notes' : 'all notes';
    notesToggle.classList.toggle('on', chordOnly);
    octLabel.textContent = `oct ${project.lead.octave > 0 ? '+' : ''}${project.lead.octave}`;
    patternRow.style.display = arpMode ? 'flex' : 'none';
    patternRow.replaceChildren(...PATTERNS.map((p) => h('button', {
      class: `chip ${project.lead.arp.pattern === p ? 'on' : ''}`, text: PATTERN_LABEL[p],
      onClick: () => { update((pr) => { pr.lead.arp.pattern = p; }); renderTop(); },
    })));
    field.classList.toggle('arp', arpMode);
    hint.textContent = arpMode
      ? 'hold to arpeggiate · further right = faster · circle a second finger to change pattern'
      : 'tap a tile · slide sideways to glide · push up or down to bend';
  }

  /** Degrees shown in a row: top row (0) is an octave above the bottom row (1). */
  const rowDegrees: number[][] = [[], []];
  const tileEls: HTMLElement[][] = [[], []];
  let chordShown = -99;

  function renderTiles(force = false) {
    const chord = transport.heardChord();
    if (!force && chord === chordShown) return;
    chordShown = chord;
    const isTone = (d: number) => [0, 2, 4].includes((((d - chord) % 7) + 7) % 7);
    for (const row of [0, 1]) {
      const lo = offset() + (row === 0 ? 7 : 0);
      const all = Array.from({ length: 8 }, (_, i) => lo + i);
      const degs = chordOnly ? all.filter(isTone) : all;
      rowDegrees[row] = degs;
      tileEls[row] = degs.map((d) => h('div', {
        class: 'tile',
        style: { background: degreeColor(d), opacity: chordOnly || isTone(d) ? '1' : '0.45' },
      }, h('span', { class: 'tile-note', text: NOTE_NAMES[midiOf(d) % 12] })));
      rowEls[row].replaceChildren(...tileEls[row]);
    }
  }
  renderTop();
  renderTiles(true);
  cleanups.push(everyFrame(() => renderTiles()));

  const locate = (e: PointerEvent, fixedRow?: number) => {
    const r = field.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const row = fixedRow ?? (y < r.height / 2 ? 0 : 1);
    const degs = rowDegrees[row];
    const idx = Math.max(0, Math.min(degs.length - 1, Math.floor((x / r.width) * degs.length)));
    return { x, y, row, idx, deg: degs[idx], w: r.width };
  };

  // ---------- play mode ----------
  interface Held { voice: Voice; row: number; base: number; cur: number; tile: HTMLElement; y0: number; glide: number; bend: number; startAbs: number | null; bends: LiveBend[] }
  const held = new Map<number, Held>();

  const pitch = (n: Held, glideTime: number) => {
    const total = n.glide + n.bend + stripBend;
    n.voice.setPitch(total, engine.now, glideTime);
    if (n.startAbs !== null) n.bends.push({ abs: transport.absAt(engine.now - engine.outputDelay), v: total });
  };

  function onStripBend() {
    held.forEach((n) => pitch(n, 0.003));
    arpVoices.forEach((v) => v.setPitch(stripBend, engine.now, 0.003));
  }

  const rings = new Map<number, HTMLElement>();
  const placeRing = (id: number, x: number, y: number, cls = 'touch-ring') => {
    let r = rings.get(id);
    if (!r) { r = h('span', { class: cls }); field.append(r); rings.set(id, r); }
    Object.assign(r.style, { left: `${x}px`, top: `${y}px` });
    return r;
  };
  const dropRing = (id: number) => { rings.get(id)?.remove(); rings.delete(id); };

  // ---------- arp mode ----------
  interface Arp { id: number; row: number; deg: number; x: number; w: number; k: number; nextTime: number; nextAbs: number | null; timer: number }
  let arp: Arp | null = null;
  let twistId = -1;
  const arpVoices = new Set<Voice>();
  const rateFor = (x: number, w: number) => RATES[Math.min(2, Math.floor((x / w) * 3))];

  const arpStep = () => {
    if (!arp) return;
    const rate = rateFor(arp.x, arp.w);
    const L = loopSteps(project);
    const chord = arp.nextAbs !== null ? chordDegreeAt(project, ((arp.nextAbs % L) + L) % L) : transport.heardChord();
    // Chord tones starting at or just below the finger's note.
    const base = chord + 7 * Math.floor((arp.deg - chord) / 7);
    const list: number[] = [];
    for (let o = 0; o < project.lead.arp.octaves; o++) list.push(base + 7 * o, base + 2 + 7 * o, base + 4 + 7 * o);
    list.push(base + 7 * project.lead.arp.octaves);
    const pat = project.lead.arp.pattern;
    const seq = pat === 'down' ? [...list].reverse() : pat === 'updown' ? [...list, ...list.slice(1, -1).reverse()] : list;
    const deg = pat === 'random' ? list[Math.floor(Math.random() * list.length)] : seq[arp.k % seq.length];
    arp.k++;

    const t = arp.nextTime;
    const gateSteps = rate * project.lead.arp.gate;
    const v = playLead(deg, t, 0.8, 0.6);
    if (stripBend) v.setPitch(stripBend, t, 0.003);
    arpVoices.add(v);
    const end = t + gateSteps * transport.stepDur;
    v.release(end);
    setTimeout(() => arpVoices.delete(v), Math.max(0, (end - engine.now) * 1000 + 50));
    if (arp.nextAbs !== null) transport.recordArpNote(arp.nextAbs, gateSteps, deg, 0.8);

    const orb = rings.get(arp.id);
    if (orb) setTimeout(() => orb.animate([{ transform: 'translate(-50%,-50%) scale(1.2)' }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 120 }), Math.max(0, (t - engine.now + engine.outputDelay) * 1000));

    arp.nextTime += rate * transport.stepDur;
    if (arp.nextAbs !== null) arp.nextAbs += rate;
  };

  const startArp = (e: PointerEvent) => {
    const { x, y, row, deg, w } = locate(e);
    const rate = rateFor(x, w);
    let nextTime = engine.now + 0.005;
    let nextAbs: number | null = null;
    if (transport.playing) {
      const g = transport.nextGrid(rate, engine.now + 0.01);
      nextTime = g.time;
      nextAbs = g.abs;
    }
    arp = { id: e.pointerId, row, deg, x, w, k: 0, nextTime, nextAbs, timer: 0 };
    const tickArp = () => { while (arp && arp.nextTime < engine.now + 0.08) arpStep(); };
    arp.timer = window.setInterval(tickArp, 20);
    tickArp();
    placeRing(e.pointerId, x, y, 'orb').textContent = PATTERN_LABEL[project.lead.arp.pattern];
  };

  const stopArp = () => {
    if (!arp) return;
    clearInterval(arp.timer);
    dropRing(arp.id);
    arp = null;
  };
  cleanups.push(stopArp);

  // ---------- pointer handling ----------
  field.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    engine.ensure();
    field.setPointerCapture(e.pointerId);
    if (arpMode) {
      if (!arp) startArp(e);
      else if (twistId === -1) twistId = e.pointerId;
      return;
    }
    const { x, y, row, idx, deg } = locate(e);
    const voice = playLead(deg, engine.now, 0.85, 0.6);
    const tile = tileEls[row][idx];
    tile?.classList.add('held');
    const n: Held = { voice, row, base: deg, cur: deg, tile, y0: y, glide: 0, bend: 0, startAbs: transport.canRecord ? transport.absForEvent(e) : null, bends: [] };
    held.set(e.pointerId, n);
    if (stripBend) pitch(n, 0.003);
    placeRing(e.pointerId, x, y);
  });

  onMove(field, (e) => {
    if (arpMode) {
      if (arp && e.pointerId === arp.id) {
        const { x, y, deg, w } = locate(e, arp.row);
        arp.x = x; arp.w = w; arp.deg = deg;
        placeRing(arp.id, x, y);
      } else if (arp && e.pointerId === twistId) {
        // Second finger: its angle around the orb picks the pattern.
        const orb = rings.get(arp.id);
        if (!orb) return;
        const r = field.getBoundingClientRect();
        const ang = Math.atan2(e.clientY - r.top - parseFloat(orb.style.top), e.clientX - r.left - arp.x);
        const p = PATTERNS[Math.floor(((ang + Math.PI) / (2 * Math.PI)) * 4) % 4];
        if (p !== project.lead.arp.pattern) {
          update((pr) => { pr.lead.arp.pattern = p; });
          orb.textContent = PATTERN_LABEL[p];
          renderTop();
        }
      }
      return;
    }
    const n = held.get(e.pointerId);
    if (!n) return;
    const { x, y, idx, deg } = locate(e, n.row);
    let glideTime = 0.003;
    if (deg !== undefined && deg !== n.cur) {
      // Glide (quick portamento) to the new tile.
      n.cur = deg;
      n.glide = midiOf(deg) - midiOf(n.base);
      n.tile?.classList.remove('held');
      n.tile = tileEls[n.row][idx];
      n.tile?.classList.add('held');
      glideTime = 0.025;
    }
    n.bend = Math.max(-1, Math.min(1, (n.y0 - y) / BEND_PX)) * project.lead.bendRange;
    pitch(n, glideTime);
    placeRing(e.pointerId, x, y);
  });

  const up = (e: PointerEvent) => {
    if (arp && e.pointerId === arp.id) { stopArp(); twistId = -1; return; }
    if (e.pointerId === twistId) { twistId = -1; return; }
    const n = held.get(e.pointerId);
    if (!n) return;
    held.delete(e.pointerId);
    n.voice.release(engine.now);
    n.tile?.classList.remove('held');
    if (n.startAbs !== null) transport.recordMelodic('lead', n.startAbs, transport.absForEvent(e), n.base, 0.85, n.bends);
    dropRing(e.pointerId);
  };
  field.addEventListener('pointerup', up);
  field.addEventListener('pointercancel', up);

  // Light up tiles as the loop plays the lead.
  cleanups.push(transport.onHit((track, t, degree) => {
    if (track !== 'lead') return;
    setTimeout(() => {
      for (const row of [0, 1]) {
        const i = rowDegrees[row].indexOf(degree);
        if (i >= 0) tileEls[row][i]?.animate([{ filter: 'brightness(0.85)' }, { filter: 'none' }], { duration: 220 });
      }
    }, Math.max(0, (t - engine.now + engine.outputDelay) * 1000));
  }));
}

function setTab(body: HTMLElement) {
  body.classList.add('scroll');
  const l = project.lead;
  const audition = () => {
    engine.ensure();
    playLead(transport.heardChord() + 7, engine.now, 0.8).release(engine.now + 0.5);
  };
  const octs = h('div', { class: 'segs' });
  const renderOcts = () => octs.replaceChildren(h('span', { class: 'mono muted small', text: 'octaves' }), ...([1, 2] as const).map((o) =>
    h('button', { class: `seg ${project.lead.arp.octaves === o ? 'on' : ''}`, text: String(o), onClick: () => { update((p) => { p.lead.arp.octaves = o; }); renderOcts(); } })));
  renderOcts();
  body.append(
    h('div', { class: 'section' },
      h('div', { class: 'section-title' }, h('h2', { text: 'Sound' })),
      presetSwitch(LEAD_PRESETS.map((p) => p.name), l.preset, (name) => { update((p) => { p.lead.preset = name; }); setSubtitle(name); audition(); }),
      h('div', { class: 'knobs' },
        knob({ label: 'Level', min: 0, max: 1, value: l.level, reset: 0.7, color: '#ABD8CC', format: (v) => `${Math.round(v * 100)}`, onChange: (v) => update((p) => { p.lead.level = v; }) }),
        knob({ label: 'Bend', min: 1, max: 12, value: l.bendRange, reset: 2, color: '#ABD8CC', format: (v) => `±${Math.round(v)} st`, onChange: (v) => update((p) => { p.lead.bendRange = Math.round(v); }) }),
      ),
      h('div', { class: 'row-buttons' }, h('button', { class: 'chip', text: 'Audition', onClick: audition })),
    ),
    h('div', { class: 'section' },
      h('div', { class: 'section-title' }, h('h2', { text: 'Arpeggiator' })),
      h('div', { class: 'knobs' },
        knob({ label: 'Gate', min: 0.1, max: 1, value: l.arp.gate, reset: 0.6, color: '#ABD8CC', format: (v) => `${Math.round(v * 100)}%`, onChange: (v) => update((p) => { p.lead.arp.gate = v; }) }),
      ),
      octs,
    ),
    h('div', { class: 'section' },
      h('div', { class: 'section-title' }, h('h2', { text: 'Pattern' })),
      h('div', { class: 'row-buttons' }, confirmButton('Clear lead', () => update((p) => { p.lead.notes = []; }))),
    ),
  );
}
