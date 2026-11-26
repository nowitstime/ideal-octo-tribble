// Bass: one string split into chord-tone zones (root, 3rd, 5th, 7th, octave)
// that retune to whatever chord is playing. Slide along it to glide,
// pull it off its line to bend, or use the bend strip on the edge.
import { h, svg, everyFrame, onMove } from '../ui/dom';
import { noteLane } from '../ui/noteLane';
import { project, update, rootLine } from '../state';
import { transport, playBass, type LiveBend } from '../audio/transport';
import { engine, type Voice } from '../audio/engine';
import { BASS_PRESETS } from '../audio/presets';
import { bassMidi, chordInfo, NOTE_NAMES, TONE_NAMES, TONE_OFFSETS } from '../theory';
import { degreeColor } from '../ui/colors';
import { instrumentHeader, setSubtitle } from '../ui/header';
import { transportBar } from '../ui/transportBar';
import { bendStrip } from '../ui/bendStrip';
import { presetSwitch } from '../ui/presetSwitch';
import { knob } from '../ui/knob';
import { confirmButton } from './drums';

/** Chord chosen by tapping a chip while stopped (index into the progression). */
let manualIdx = 0;

export function bassScreen(root: HTMLElement, tab: 'play' | 'set'): () => void {
  const cleanups: (() => void)[] = [];
  const tb = transportBar();
  cleanups.push(tb.destroy);
  const body = h('div', { class: 'inst-body' });
  root.append(h('div', { class: 'screen' }, instrumentHeader('bass', 'Bass', project.bass.preset, tab), body, tb.el));
  (tab === 'play' ? playTab : setTab)(body, cleanups);
  return () => cleanups.forEach((c) => c());
}

const ZONES = 5;
/** Finger travel (px) off the string for a full-range bend. */
const BEND_PX = 70;

function playTab(body: HTMLElement, cleanups: (() => void)[]) {
  const chordNow = () => (transport.playing ? transport.heardChord() : project.progression[manualIdx] ?? project.progression[0]);

  // ---------- chord chips ----------
  const chips = project.progression.map((d, i) => {
    const b = h('button', { class: 'chord-chip', text: chordInfo(project.key, project.mode, d).name, style: { background: degreeColor(d) } });
    b.addEventListener('click', () => { manualIdx = i; });
    return b;
  });
  body.append(h('div', { class: 'chip-row' }, h('div', { class: 'mini-prog' }, ...chips), h('span', { class: 'mono muted small', text: 'follows the chords' })));
  const lane = noteLane('bass');
  cleanups.push(lane.destroy);
  body.append(lane.el);

  // ---------- the string ----------
  const zones = Array.from({ length: ZONES }, (_, i) =>
    h('div', { class: 'zone' }, h('span', { class: 'zone-note' }), h('span', { class: 'mono small zone-role', text: TONE_NAMES[i] })));
  const path = svg('path', { class: 'bass-string' });
  const art = svg('svg', { class: 'string-svg', 'aria-hidden': 'true' }, path);
  const stage = h('div', { class: 'string-stage' }, ...zones, art);

  let stripBend = 0;
  const strip = bendStrip(() => project.bass.bendRange, (s) => { stripBend = s; if (active) applyPitch(); });
  body.append(h('div', { class: 'play-row' }, stage, strip));
  body.append(h('p', { class: 'hint', text: 'tap a zone · slide along to glide · pull the string to bend' }));

  // ---------- geometry & drawing ----------
  let W = 0, H = 0;
  let pull = { x: 0, dy: 0 };
  let springAnim = 0;
  const draw = () => {
    const mid = H / 2;
    const cy = mid + 2 * pull.dy;
    path.setAttribute('d', `M0 ${mid} Q ${pull.x} ${cy} ${W} ${mid}`);
  };
  const resize = () => {
    W = stage.clientWidth; H = stage.clientHeight;
    art.setAttribute('viewBox', `0 0 ${W} ${H}`);
    pull.x = W / 2;
    draw();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  cleanups.push(() => ro.disconnect());

  const spring = (from: number) => {
    cancelAnimationFrame(springAnim);
    const t0 = performance.now();
    const step = () => {
      const t = (performance.now() - t0) / 1000;
      pull.dy = from * Math.exp(-t * 9) * Math.cos(t * 55);
      draw();
      if (t < 0.6) springAnim = requestAnimationFrame(step);
      else { pull.dy = 0; draw(); }
    };
    springAnim = requestAnimationFrame(step);
  };

  // ---------- playing ----------
  interface Active { id: number; voice: Voice; tone: number; baseMidi: number; chord: number; x: number; y0: number; semis: number; startAbs: number | null; bends: LiveBend[] }
  let active: Active | null = null;

  const midiAtX = (x: number, chord: number) => {
    // Continuous pitch between zone centres, so sliding glides like a fretless.
    const pos = Math.max(0, Math.min(ZONES - 1, (x / W) * ZONES - 0.5));
    const i = Math.min(ZONES - 2, Math.floor(pos));
    const f = pos - i;
    const a = bassMidi(project.key, project.mode, chord, i);
    const b = bassMidi(project.key, project.mode, chord, i + 1);
    return a + (b - a) * f;
  };

  let glideTime = 0.003;
  const applyPitch = () => {
    if (!active) return;
    const total = active.semis + stripBend;
    active.voice.setPitch(total, engine.now, glideTime);
    if (active.startAbs !== null) active.bends.push({ abs: transport.absAt(engine.now - engine.outputDelay), v: total });
  };

  const finish = (e: PointerEvent) => {
    if (!active || e.pointerId !== active.id) return;
    const a = active;
    active = null;
    a.voice.release(engine.now);
    if (a.startAbs !== null) transport.recordMelodic('bass', a.startAbs, transport.absForEvent(e), a.tone, 0.85, a.bends);
    spring(pull.dy);
    zones[a.tone].classList.remove('held');
  };

  stage.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    engine.ensure();
    if (active) finish({ pointerId: active.id, timeStamp: e.timeStamp } as PointerEvent);
    stage.setPointerCapture(e.pointerId);
    const r = stage.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const tone = Math.min(ZONES - 1, Math.floor((x / W) * ZONES));
    const chord = chordNow();
    const baseMidi = bassMidi(project.key, project.mode, chord, tone);
    const voice = playBass(chord, tone, engine.now, 0.85);
    active = { id: e.pointerId, voice, tone, baseMidi, chord, x, y0: y, semis: 0, startAbs: transport.canRecord ? transport.absForEvent(e) : null, bends: [] };
    if (stripBend) applyPitch();
    cancelAnimationFrame(springAnim);
    pull = { x, dy: 0 };
    draw();
    zones[tone].classList.add('held');
  });

  onMove(stage, (e) => {
    if (!active || e.pointerId !== active.id) return;
    const r = stage.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const dy = y - active.y0;
    // Pulling the string either way tightens it: pitch goes up.
    const bend = Math.min(1, Math.abs(dy) / BEND_PX) * project.bass.bendRange;
    const slide = Math.abs(x - active.x) > 6 ? midiAtX(x, active.chord) - active.baseMidi : 0;
    active.semis = slide + bend;
    applyPitch();
    pull = { x, dy: Math.max(-H / 4, Math.min(H / 4, dy / 2)) };
    draw();
  });
  stage.addEventListener('pointerup', finish);
  stage.addEventListener('pointercancel', finish);

  // ---------- follow the chord ----------
  let shown = -1;
  const paintZones = (chord: number) => {
    zones.forEach((z, i) => {
      z.style.background = degreeColor(chord + TONE_OFFSETS[i]);
      (z.firstChild as HTMLElement).textContent = NOTE_NAMES[bassMidi(project.key, project.mode, chord, i) % 12];
    });
  };
  cleanups.push(everyFrame(() => {
    const c = chordNow();
    const idx = transport.playing ? project.progression.indexOf(c) : manualIdx;
    if (c !== shown) { shown = c; paintZones(c); }
    chips.forEach((b, i) => b.classList.toggle('now', i === idx));
  }));

  cleanups.push(transport.onHit((track, t, tone) => {
    if (track !== 'bass') return;
    setTimeout(() => {
      zones[tone]?.animate([{ filter: 'brightness(0.88)' }, { filter: 'none' }], { duration: 200, easing: 'ease-out' });
      if (!active) { pull = { x: ((tone + 0.5) / ZONES) * W, dy: 0 }; spring(6); }
    }, Math.max(0, (t - engine.now + engine.outputDelay) * 1000));
  }));
}

function setTab(body: HTMLElement) {
  body.classList.add('scroll');
  const b = project.bass;
  const audition = () => {
    engine.ensure();
    playBass(transport.heardChord(), 0, engine.now, 0.85).release(engine.now + 0.4);
  };
  body.append(
    h('div', { class: 'section' },
      h('div', { class: 'section-title' }, h('h2', { text: 'Sound' })),
      presetSwitch(BASS_PRESETS.map((p) => p.name), b.preset, (name) => { update((p) => { p.bass.preset = name; }); setSubtitle(name); audition(); }),
      h('div', { class: 'knobs' },
        knob({ label: 'Tone', min: 0, max: 1, value: b.tone, reset: 0.5, color: '#AFC9EA', format: (v) => `${Math.round(v * 100)}`, onChange: (v) => update((p) => { p.bass.tone = v; }) }),
        knob({ label: 'Level', min: 0, max: 1, value: b.level, reset: 0.8, color: '#AFC9EA', format: (v) => `${Math.round(v * 100)}`, onChange: (v) => update((p) => { p.bass.level = v; }) }),
        knob({ label: 'Bend', min: 1, max: 12, value: b.bendRange, reset: 2, color: '#AFC9EA', format: (v) => `±${Math.round(v)} st`, onChange: (v) => update((p) => { p.bass.bendRange = Math.round(v); }) }),
      ),
      h('div', { class: 'row-buttons' }, h('button', { class: 'chip', text: 'Audition', onClick: audition })),
    ),
    h('div', { class: 'section' },
      h('div', { class: 'section-title' }, h('h2', { text: 'Pattern' })),
      h('div', { class: 'row-buttons' },
        confirmButton('Simple root line', () => update((p) => { p.bass.notes = rootLine(p.bars); })),
        confirmButton('Clear bass', () => update((p) => { p.bass.notes = []; })),
      ),
    ),
  );
}
