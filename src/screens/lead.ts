// Lead: a field of scale-note bands. Left→right is pitch (magnetic: slow moves
// settle on notes, fast moves glide), up is brighter. In Arp mode, touching the
// field spawns an orb that arpeggiates the current chord in time with the loop.
import { h, everyFrame } from '../ui/dom';
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
import { confirmButton } from './drums';

const BANDS = 15; // two octaves + the top root
const PATTERNS: ArpPattern[] = ['up', 'down', 'updown', 'random'];
const PATTERN_LABEL: Record<ArpPattern, string> = { up: 'up', down: 'down', updown: 'up-down', random: 'random' };
let arpMode = false;

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
  const midiOf = (band: number) => leadMidi(project.key, project.mode, band + offset());

  // ---------- top controls ----------
  const modeTabs = h('div', { class: 'tabs left' });
  const octLabel = h('span', { class: 'mono small' });
  const oct = h('div', { class: 'oct' },
    h('button', { class: 'icon-btn', 'aria-label': 'Octave down', text: '−', onClick: () => setOct(-1) }),
    octLabel,
    h('button', { class: 'icon-btn', 'aria-label': 'Octave up', text: '+', onClick: () => setOct(1) }));
  const setOct = (d: number) => { update((p) => { p.lead.octave = Math.max(-1, Math.min(1, p.lead.octave + d)); }); paintBands(true); renderTop(); };
  const patternRow = h('div', { class: 'pattern-row' });
  body.append(h('div', { class: 'lead-top' }, modeTabs, oct), patternRow);

  function renderTop() {
    modeTabs.replaceChildren(
      h('button', { class: arpMode ? '' : 'on', text: 'Play', onClick: () => { arpMode = false; renderTop(); } }),
      h('button', { class: arpMode ? 'on' : '', text: 'Arp', onClick: () => { arpMode = true; renderTop(); } }));
    octLabel.textContent = `oct ${project.lead.octave > 0 ? '+' : ''}${project.lead.octave}`;
    patternRow.style.visibility = arpMode ? 'visible' : 'hidden';
    patternRow.replaceChildren(...PATTERNS.map((p) => h('button', {
      class: `chip ${project.lead.arp.pattern === p ? 'on' : ''}`, text: PATTERN_LABEL[p],
      onClick: () => { update((pr) => { pr.lead.arp.pattern = p; }); renderTop(); },
    })));
    field.classList.toggle('arp', arpMode);
  }

  // ---------- field ----------
  const bands = Array.from({ length: BANDS }, () => h('div', { class: 'band' }, h('span', { class: 'band-note mono small' })));
  const guides = h('div', { class: 'rate-guides' }, h('span', { text: '1/32' }), h('span', { text: '1/16' }), h('span', { text: '1/8' }));
  const field = h('div', { class: 'field' }, ...bands, guides);
  let stripBend = 0;
  const strip = bendStrip(() => project.lead.bendRange, (s) => { stripBend = s; onStripBend(); });
  body.append(h('div', { class: 'play-row' }, field, strip));
  const hint = h('p', { class: 'hint' });
  body.append(hint);
  renderTop();

  let chordShown = -99;
  function paintBands(force = false) {
    const chord = transport.heardChord();
    if (!force && chord === chordShown) return;
    chordShown = chord;
    const tones = new Set([chord % 7, (chord + 2) % 7, (chord + 4) % 7]);
    bands.forEach((b, i) => {
      const deg = (((i + offset()) % 7) + 7) % 7;
      const isTone = tones.has(deg);
      b.style.background = degreeColor(deg);
      b.style.opacity = isTone ? '1' : '0.38';
      (b.firstChild as HTMLElement).textContent = NOTE_NAMES[midiOf(i) % 12];
    });
  }
  paintBands(true);
  cleanups.push(everyFrame(() => {
    paintBands();
    hint.textContent = arpMode
      ? 'touch to arpeggiate · up = faster · second finger circles to change pattern'
      : 'slide to glide · rest to settle on a note · up is brighter · wiggle for vibrato';
  }));

  const rect = () => field.getBoundingClientRect();

  /** Magnetic pitch: smooth everywhere, but flat (in tune) near band centres. */
  const pitchAt = (x: number, w: number) => {
    const q = Math.max(0, Math.min(BANDS - 1, (x / w) * BANDS - 0.5));
    const qm = q - (0.85 * Math.sin(2 * Math.PI * q)) / (2 * Math.PI);
    const i = Math.min(BANDS - 2, Math.floor(qm));
    const f = qm - i;
    return { band: Math.round(q), midi: midiOf(i) + (midiOf(i + 1) - midiOf(i)) * f };
  };

  // ---------- play mode ----------
  interface Held { voice: Voice; band: number; glide: number; startAbs: number | null; bends: LiveBend[] }
  const held = new Map<number, Held>();

  const pushBend = (n: Held) => {
    const total = n.glide + stripBend;
    n.voice.setPitch(total, engine.now);
    if (n.startAbs !== null) n.bends.push({ abs: transport.absAt(engine.now - engine.outputDelay), v: total });
  };

  function onStripBend() {
    held.forEach(pushBend);
    arpVoices.forEach((v) => v.setPitch(stripBend, engine.now));
  }

  const ringFor = new Map<number, HTMLElement>();
  const placeRing = (id: number, x: number, y: number, cls = 'touch-ring') => {
    let r = ringFor.get(id);
    if (!r) { r = h('span', { class: cls }); field.append(r); ringFor.set(id, r); }
    Object.assign(r.style, { left: `${x}px`, top: `${y}px` });
    return r;
  };
  const dropRing = (id: number) => { ringFor.get(id)?.remove(); ringFor.delete(id); };

  // ---------- arp mode ----------
  interface Arp { id: number; x: number; y: number; k: number; nextTime: number; nextAbs: number | null; timer: number }
  let arp: Arp | null = null;
  let twistId = -1;
  const arpVoices = new Set<Voice>();

  const rateAt = (y: number, hgt: number) => (y < hgt / 3 ? 0.5 : y < (2 * hgt) / 3 ? 1 : 2);

  const arpStep = () => {
    if (!arp) return;
    const r = rect();
    const rate = rateAt(arp.y, r.height);
    const L = loopSteps(project);
    const chord = arp.nextAbs !== null ? chordDegreeAt(project, ((arp.nextAbs % L) + L) % L) : transport.heardChord();
    // Chord tones starting at or just below the finger.
    const finger = pitchAt(arp.x, r.width).band + offset();
    const base = chord + 7 * Math.floor((finger - chord) / 7);
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
    if (stripBend) v.setPitch(stripBend, t);
    arpVoices.add(v);
    const end = t + gateSteps * transport.stepDur;
    v.release(end);
    setTimeout(() => arpVoices.delete(v), Math.max(0, (end - engine.now) * 1000 + 50));
    if (arp.nextAbs !== null) transport.recordArpNote(arp.nextAbs, gateSteps, deg, 0.8);

    const orb = ringFor.get(arp.id);
    if (orb) setTimeout(() => orb.animate([{ transform: 'translate(-50%,-50%) scale(1.25)' }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 120 }), Math.max(0, (t - engine.now + engine.outputDelay) * 1000));

    arp.nextTime += rate * transport.stepDur;
    if (arp.nextAbs !== null) arp.nextAbs += rate;
  };

  const startArp = (e: PointerEvent, x: number, y: number) => {
    const r = rect();
    const rate = rateAt(y, r.height);
    let nextTime = engine.now + 0.005;
    let nextAbs: number | null = null;
    if (transport.playing) {
      const g = transport.nextGrid(rate, engine.now + 0.01);
      nextTime = g.time;
      nextAbs = g.abs;
    }
    arp = { id: e.pointerId, x, y, k: 0, nextTime, nextAbs, timer: 0 };
    const tickArp = () => { while (arp && arp.nextTime < engine.now + 0.08) arpStep(); };
    arp.timer = window.setInterval(tickArp, 20);
    tickArp();
    const orb = placeRing(e.pointerId, x, y, 'orb');
    orb.textContent = PATTERN_LABEL[project.lead.arp.pattern];
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
    const r = rect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (arpMode) {
      if (!arp) startArp(e, x, y);
      else if (twistId === -1) twistId = e.pointerId;
      return;
    }
    const { band, midi } = pitchAt(x, r.width);
    const voice = playLead(band + offset(), engine.now, 0.8, 1 - y / r.height);
    const n: Held = { voice, band, glide: midi - midiOf(band), startAbs: transport.canRecord ? transport.absForEvent(e) : null, bends: [] };
    held.set(e.pointerId, n);
    if (stripBend) pushBend(n);
    placeRing(e.pointerId, x, y);
  });

  field.addEventListener('pointermove', (e) => {
    const r = rect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (arpMode) {
      if (arp && e.pointerId === arp.id) {
        arp.x = x; arp.y = y;
        placeRing(arp.id, x, y);
      } else if (arp && e.pointerId === twistId) {
        // Second finger: its angle around the orb picks the pattern.
        const ang = Math.atan2(y - arp.y, x - arp.x);
        const p = PATTERNS[Math.floor(((ang + Math.PI) / (2 * Math.PI)) * 4) % 4];
        if (p !== project.lead.arp.pattern) {
          update((pr) => { pr.lead.arp.pattern = p; });
          const orb = ringFor.get(arp.id);
          if (orb) orb.textContent = PATTERN_LABEL[p];
          renderTop();
        }
      }
      return;
    }
    const n = held.get(e.pointerId);
    if (!n) return;
    n.glide = pitchAt(x, r.width).midi - midiOf(n.band);
    pushBend(n);
    n.voice.setBrightness(1 - y / r.height, engine.now);
    placeRing(e.pointerId, x, y);
  });

  const up = (e: PointerEvent) => {
    if (arp && e.pointerId === arp.id) { stopArp(); twistId = -1; return; }
    if (e.pointerId === twistId) { twistId = -1; return; }
    const n = held.get(e.pointerId);
    if (!n) return;
    held.delete(e.pointerId);
    n.voice.release(engine.now);
    if (n.startAbs !== null) transport.recordMelodic('lead', n.startAbs, transport.absForEvent(e), n.band + offset(), 0.8, n.bends);
    dropRing(e.pointerId);
  };
  field.addEventListener('pointerup', up);
  field.addEventListener('pointercancel', up);

  // Light up bands as the loop plays the lead.
  cleanups.push(transport.onHit((track, t, degree) => {
    if (track !== 'lead') return;
    const i = degree - offset();
    if (i < 0 || i >= BANDS) return;
    setTimeout(() => bands[i].animate([{ filter: 'brightness(0.85)' }, { filter: 'none' }], { duration: 220 }), Math.max(0, (t - engine.now + engine.outputDelay) * 1000));
  }));
}

function setTab(body: HTMLElement) {
  body.classList.add('scroll');
  const l = project.lead;
  const audition = () => {
    engine.ensure();
    playLead(transport.heardChord() + 7, engine.now, 0.8).release(engine.now + 0.5);
  };
  const octs = h('div', { class: 'segs' }, h('span', { class: 'mono muted small', text: 'octaves' }));
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
