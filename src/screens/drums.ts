// Drums: 16 pads + a bead lane for the selected pad (play), per-pad sound (settings).
import { h, everyFrame } from '../ui/dom';
import { project, update, subscribe, loopSteps } from '../state';
import { transport } from '../audio/transport';
import { engine, PAD_NAMES } from '../audio/engine';
import { padColor } from '../ui/colors';
import { instrumentHeader, setSubtitle } from '../ui/header';
import { transportBar } from '../ui/transportBar';
import { knob } from '../ui/knob';
import { presetSwitch } from '../ui/presetSwitch';
import { KITS } from '../audio/presets';
import { TPS } from '../ticks';
import { confirmButton } from '../ui/confirm';
import { passLines } from '../ui/passLines';

let selectedPad = 0;

export function drumsScreen(root: HTMLElement, tab: 'play' | 'set'): () => void {
  const cleanups: (() => void)[] = [];
  const tb = transportBar();
  cleanups.push(tb.destroy);
  const body = h('div', { class: 'inst-body' });
  root.append(h('div', { class: 'screen' }, instrumentHeader('drums', 'Drums', `${project.drums.kit} kit`, tab), body, tb.el));
  (tab === 'play' ? playTab : setTab)(body, cleanups);
  return () => cleanups.forEach((c) => c());
}

function playTab(body: HTMLElement, cleanups: (() => void)[]) {
  // ---------- bead lane ----------
  const laneLabel = h('span');
  const lane = h('div', { class: 'lane' });
  const head = h('span', { class: 'lane-head' });
  const clearLane = confirmButton('clear pad', () => update((p) => { p.drums.notes = p.drums.notes.filter((n) => n.pad !== selectedPad); }), 'text-btn');
  const passes = passLines('drums');
  cleanups.push(passes.destroy);
  body.append(h('div', { class: 'lane-labels mono muted small' }, laneLabel, clearLane), lane, passes.el);

  function renderLane() {
    laneLabel.textContent = `${PAD_NAMES[selectedPad]} · tap a bead to toggle`;
    const L = loopSteps(project);
    const rows: HTMLElement[] = [];
    for (let bar = 0; bar < L / 16; bar++) {
      const row = h('div', { class: 'lane-row' });
      for (let i = 0; i < 16; i++) {
        const step = bar * 16 + i;
        const tick = step * TPS;
        // A bead covers its whole 1/16 (unquantized hits round to the nearest).
        const near = (n: { tick: number }) => Math.abs(n.tick - tick) < TPS / 2;
        const on = project.drums.notes.some((n) => n.pad === selectedPad && near(n));
        const bead = h('button', { class: `bead ${on ? 'on' : ''} ${i % 4 === 0 ? 'beat' : ''}`, 'aria-label': `Step ${step + 1}`, style: { left: `${(i + 0.5) * 6.25}%` } });
        bead.addEventListener('click', () => update((p) => {
          const pad = selectedPad;
          const hit = p.drums.notes.findIndex((n) => n.pad === pad && near(n));
          if (hit >= 0) p.drums.notes.splice(hit, 1);
          else p.drums.notes.push({ tick, pad, vel: 0.8 });
        }));
        row.append(bead);
      }
      rows.push(row);
    }
    lane.replaceChildren(...rows, head);
  }

  // ---------- pads ----------
  const grid = h('div', { class: 'pads' });
  const pads: HTMLButtonElement[] = PAD_NAMES.map((name, i) => {
    const pad = h('button', { class: 'pad', style: { background: padColor(i) } }, h('span', { text: name }));
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      engine.ensure();
      const r = pad.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      let vel = 0.85;
      if (project.drums.velFromPosition) {
        const d = Math.hypot(x - r.width / 2, y - r.height / 2) / (Math.min(r.width, r.height) / 2);
        vel = Math.max(0.3, 1 - 0.6 * Math.min(1, d));
      }
      // Sound first, everything else after.
      engine.drum(i, engine.now, vel, project.drums.pads[i], project.drums.kit);
      transport.recordDrum(e, i, vel);
      if (selectedPad !== i) { selectedPad = i; renderLane(); }
      flash(pad, i);
      const ring = h('span', { class: 'touch-ring', style: { left: `${x}px`, top: `${y}px` } }, h('span', { class: 'touch-vel', text: vel.toFixed(2) }));
      pad.append(ring);
      ring.animate([{ opacity: 1, transform: 'translate(-50%,-50%) scale(0.6)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.25)' }], { duration: 450, easing: 'ease-out' }).onfinish = () => ring.remove();
    });
    return pad;
  });
  grid.append(...pads);
  body.append(grid, h('p', { class: 'hint', text: project.drums.velFromPosition ? 'centre is louder · press record to capture' : 'fixed velocity · press record to capture' }));

  function flash(pad: HTMLElement, i: number) {
    pad.animate([{ background: padColor(i, true) }, { background: padColor(i) }], { duration: 220, easing: 'ease-out' });
  }

  renderLane();
  cleanups.push(subscribe(renderLane));

  // Light up pads when the loop plays them.
  cleanups.push(transport.onHit((track, t, pad) => {
    if (track !== 'drums') return;
    setTimeout(() => flash(pads[pad], pad), Math.max(0, (t - engine.now + engine.outputDelay) * 1000));
  }));

  cleanups.push(everyFrame(() => {
    const L = loopSteps(project);
    const s = transport.heardStep();
    const bar = Math.floor(s / 16);
    head.style.display = transport.playing ? 'block' : 'none';
    head.style.left = `${((s % 16) / 16) * 100}%`;
    head.style.top = `${(bar / (L / 16)) * 100}%`;
    head.style.height = `${100 / (L / 16)}%`;
  }));
}

function setTab(body: HTMLElement, cleanups: (() => void)[]) {
  const kitSwitch = presetSwitch(KITS.map((k) => k.name), project.drums.kit, (name) => {
    update((p) => { p.drums.kit = name; });
    setSubtitle(`${name} kit`);
    engine.ensure();
    [0, 4, 1].forEach((pad, i) => engine.drum(pad, engine.now + i * 0.16, 0.85, project.drums.pads[pad], name));
  });
  const selector = h('div', { class: 'pad-select' });
  const voice = h('div', { class: 'section' });
  const kit = h('div', { class: 'section' });
  body.classList.add('scroll');
  body.append(h('div', { class: 'section' }, h('div', { class: 'section-title' }, h('h2', { text: 'Kit' })), kitSwitch), selector, voice, kit);

  function renderSelector() {
    selector.replaceChildren(...PAD_NAMES.map((name, i) => {
      const b = h('button', { class: `pad-mini ${i === selectedPad ? 'on' : ''}`, 'aria-label': name, style: { background: padColor(i, i === selectedPad) } });
      b.addEventListener('pointerdown', () => {
        engine.ensure();
        engine.drum(i, engine.now, 0.85, project.drums.pads[i], project.drums.kit);
        if (selectedPad !== i) { selectedPad = i; renderSelector(); renderVoice(); }
      });
      return b;
    }));
  }

  function renderVoice() {
    const p = project.drums.pads[selectedPad];
    const c = padColor(selectedPad);
    const set = (k: 'tune' | 'decay' | 'level') => (v: number) => update((pr) => { pr.drums.pads[selectedPad][k] = v; });
    voice.replaceChildren(
      h('div', { class: 'section-title' }, h('h2', { text: PAD_NAMES[selectedPad] }), h('span', { class: 'mono muted small', text: `pad ${String(selectedPad + 1).padStart(2, '0')}` })),
      h('div', { class: 'knobs' },
        knob({ label: 'Tune', min: -12, max: 12, value: p.tune, reset: 0, color: c, format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} st`, onChange: set('tune') }),
        knob({ label: 'Decay', min: 0.25, max: 2, value: p.decay, reset: 1, color: c, format: (v) => `${Math.round(v * 100)}%`, onChange: set('decay') }),
        knob({ label: 'Level', min: 0, max: 1, value: p.level, reset: 0.85, color: c, format: (v) => `${Math.round(v * 100)}`, onChange: set('level') }),
      ),
      h('div', { class: 'row-buttons' },
        h('button', { class: 'chip', text: 'Audition', onClick: () => engine.drum(selectedPad, engine.now, 0.9, project.drums.pads[selectedPad], project.drums.kit) }),
        confirmButton('Clear this lane', () => update((pr) => { pr.drums.notes = pr.drums.notes.filter((n) => n.pad !== selectedPad); })),
      ),
    );
  }

  function renderKit() {
    const velToggle = h('button', { class: `toggle ${project.drums.velFromPosition ? 'on' : ''}`, 'aria-label': 'Velocity from touch position' }, h('span'));
    velToggle.addEventListener('click', () => { update((p) => { p.drums.velFromPosition = !p.drums.velFromPosition; }); renderKit(); });
    kit.replaceChildren(
      h('div', { class: 'section-title' }, h('h2', { text: 'Whole kit' })),
      h('div', { class: 'knobs' },
        knob({ label: 'Swing', min: 0, max: 0.6, value: project.drums.swing, reset: 0, color: '#ECE9E2', format: (v) => `${Math.round(v * 100)}%`, onChange: (v) => update((p) => { p.drums.swing = v; }) }),
      ),
      h('div', { class: 'setting-row' }, h('span', { text: 'Touch position sets velocity' }), velToggle),
      h('div', { class: 'row-buttons' }, confirmButton('Clear all drums', () => update((p) => { p.drums.notes = []; }))),
    );
  }

  renderSelector();
  renderVoice();
  renderKit();
}
