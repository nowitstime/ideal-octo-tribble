// Drums: the beat written as rules, one row per sound (play); per-pad sound (settings).
import { h, everyFrame } from '../ui/dom';
import { project, update, subscribe } from '../state';
import { rule, describe, SUB_NAMES, VARY_NAMES, type Vary } from '../drumRules';
import { transport } from '../audio/transport';
import { engine, PAD_NAMES } from '../audio/engine';
import { padColor } from '../ui/colors';
import { instrumentHeader, setSubtitle } from '../ui/header';
import { transportBar } from '../ui/transportBar';
import { knob } from '../ui/knob';
import { presetSwitch } from '../ui/presetSwitch';
import { KITS } from '../audio/presets';
import { confirmButton } from '../ui/confirm';

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
  // Write the beat as rules: per sound, which beats (1 2  3 4) and where in the beat (1 e & a).
  body.classList.add('scroll');
  const list = h('div', { class: 'rules' });
  const adder = h('div', { class: 'rule-add' });
  const played = h('div', { class: 'lane-labels mono muted small' });
  body.append(list, adder, played);
  let picking = false;
  const swatches = new Map<number, HTMLElement>();
  const beatCells: HTMLElement[][] = [];

  const audition = (pad: number) => {
    engine.ensure();
    engine.drum(pad, engine.now, 0.85, project.drums.pads[pad], project.drums.kit);
  };

  function render() {
    swatches.clear();
    beatCells.length = 0;
    list.replaceChildren(...project.drums.rules.map((r, ri) => {
      const color = padColor(r.pad);
      const swatch = h('button', { class: 'rule-swatch', 'aria-label': `Play ${PAD_NAMES[r.pad]}`, style: { background: color } });
      swatch.addEventListener('pointerdown', (e) => { e.preventDefault(); audition(r.pad); flash(r.pad); });
      swatches.set(r.pad, swatch);
      const vary = h('button', { class: `text-btn ${r.vary ? '' : 'muted'}`, text: `vary ${VARY_NAMES[r.vary]}` });
      vary.addEventListener('click', () => update((p) => { const x = p.drums.rules[ri]; x.vary = ((x.vary + 1) % 3) as Vary; }));
      const remove = h('button', { class: 'rule-x', 'aria-label': `Remove ${PAD_NAMES[r.pad]}`, text: '×' });
      remove.addEventListener('click', () => update((p) => { p.drums.rules.splice(ri, 1); }));

      // Beat squares. Each shows its four 1/16ths as dots, filled where it plays.
      const cells = [0, 1, 2, 3].map((b) => {
        const on = r.beats[b];
        const dots = [0, 1, 2, 3].map((s) => h('i', { class: on && r.subs[s] ? 'on' : '' }));
        const cell = h('button', { class: `beat-cell ${on ? 'on' : ''}`, 'aria-label': `Beat ${b + 1}`, 'aria-pressed': String(on), style: on ? { background: color } : {} },
          h('span', { class: 'beat-num', text: b + 1 }), h('span', { class: 'beat-dots' }, ...dots));
        cell.addEventListener('click', () => {
          update((p) => {
            const x = p.drums.rules[ri];
            x.beats[b] = !x.beats[b];
            if (x.beats[b] && !x.subs.some(Boolean)) x.subs[0] = true;
          });
          if (r.beats[b]) audition(r.pad);
        });
        return cell;
      });
      beatCells.push(cells);
      const subs = SUB_NAMES.map((name, si) => {
        const b = h('button', { class: `sub ${r.subs[si] ? 'on' : ''}`, 'aria-label': `On the ${name}`, 'aria-pressed': String(r.subs[si]), text: name });
        b.addEventListener('click', () => update((p) => { const x = p.drums.rules[ri]; x.subs[si] = !x.subs[si]; }));
        return b;
      });
      return h('div', { class: 'rule' },
        h('div', { class: 'rule-head' }, swatch, h('span', { class: 'rule-name', text: PAD_NAMES[r.pad] }), h('span', { class: 'mono muted small rule-say', text: describe(r) }), vary, remove),
        h('div', { class: 'rule-body' }, h('div', { class: 'beat-cells' }, ...cells), h('div', { class: 'subs' }, ...subs)),
      );
    }));

    // Add a sound: tap "+ sound", then pick one of the sounds not yet used.
    const used = new Set(project.drums.rules.map((r) => r.pad));
    const free = PAD_NAMES.map((_, i) => i).filter((i) => !used.has(i));
    if (picking && free.length) {
      adder.replaceChildren(h('div', { class: 'pick' }, ...free.map((i) => {
        const b = h('button', { class: 'pick-pad', style: { background: padColor(i) } }, h('span', { text: PAD_NAMES[i] }));
        b.addEventListener('click', () => { audition(i); picking = false; update((p) => { p.drums.rules.push(rule(i, [])); }); });
        return b;
      })), h('button', { class: 'text-btn', text: 'cancel', onClick: () => { picking = false; render(); } }));
    } else {
      adder.replaceChildren(free.length ? h('button', { class: 'chip', text: '+ sound', onClick: () => { picking = true; render(); } }) : '');
    }

    // Hits played in on the old pads still play; show them so they can be cleared.
    const n = project.drums.notes.length;
    played.replaceChildren(...(n ? [h('span', { text: `${n} played hit${n > 1 ? 's' : ''} also in the loop` }), confirmButton('clear them', () => update((p) => { p.drums.notes = []; }), 'text-btn')] : []));
  }

  function flash(pad: number) {
    swatches.get(pad)?.animate([{ background: padColor(pad, true), transform: 'scale(1.18)' }, { background: padColor(pad), transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
  }

  render();
  cleanups.push(subscribe(render));

  cleanups.push(transport.onHit((track, t, pad) => {
    if (track !== 'drums') return;
    setTimeout(() => flash(pad), Math.max(0, (t - engine.now + engine.outputDelay) * 1000));
  }));

  // Mark the beat being heard in every row.
  let lastBeat = -1;
  cleanups.push(everyFrame(() => {
    const beat = transport.playing ? Math.floor(transport.heardStep() / 4) % 4 : -1;
    if (beat === lastBeat) return;
    lastBeat = beat;
    for (const cells of beatCells) cells.forEach((c, i) => c.classList.toggle('now', i === beat));
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
              ),
    );
  }

  function renderKit() {
    kit.replaceChildren(
      h('div', { class: 'section-title' }, h('h2', { text: 'Whole kit' })),
      h('div', { class: 'knobs' },
        knob({ label: 'Swing', min: 0, max: 0.6, value: project.drums.swing, reset: 0, color: '#ECE9E2', format: (v) => `${Math.round(v * 100)}%`, onChange: (v) => update((p) => { p.drums.swing = v; }) }),
      ),
      h('div', { class: 'row-buttons' }, confirmButton('Clear all drums', () => update((p) => { p.drums.notes = []; for (const r of p.drums.rules) r.beats = [false, false, false, false]; }))),
    );
  }

  renderSelector();
  renderVoice();
  renderKit();
}
