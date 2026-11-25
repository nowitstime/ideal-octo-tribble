// All sound is synthesized: drum kits, and preset-driven voices that can bend.
import type { PadParams } from '../state';
import { midiToFreq } from '../theory';
import { KITS, type Kit, type SynthPreset } from './presets';

export const PAD_NAMES = [
  'kick', 'snare', 'clap', 'rim',
  'hat', 'open', 'shake', 'ride',
  'tom l', 'tom m', 'tom h', 'crash',
  'blip', 'zap', 'noise', 'cow',
];

/** Inharmonic ratios for metallic cymbal tones (808-style). */
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];

/** A playing note. Pitch offsets are in semitones from the note's own pitch. */
export interface Voice {
  setPitch(semis: number, at: number, glide?: number): void;
  setBrightness(b: number, at: number): void;
  release(at: number): void;
}

export interface VoiceOpts {
  brightness?: number; // 0..1
  level?: number; // 0..1
  release?: number; // override preset release (s)
}

class Engine {
  ctx: AudioContext | null = null;
  private out!: GainNode;
  private reverbIn!: GainNode;
  private noise!: AudioBuffer;
  private openHat: GainNode | null = null;
  private kitBuses = new Map<string, AudioNode>();

  /** Create/resume the audio context. Call from a user gesture. */
  ensure(): AudioContext {
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      this.ctx = ctx;
      this.out = ctx.createGain();
      this.out.gain.value = 0.8;
      this.out.connect(ctx.destination);

      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;

      // Shared reverb: a generated decaying-noise impulse response.
      const len = Math.floor(ctx.sampleRate * 2.2);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const ch = ir.getChannelData(c);
        for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      }
      const conv = ctx.createConvolver();
      conv.buffer = ir;
      this.reverbIn = ctx.createGain();
      const wet = ctx.createGain();
      wet.gain.value = 0.5;
      this.reverbIn.connect(conv).connect(wet).connect(this.out);
    }
    if (this.ctx.state !== 'running') void this.ctx.resume();
    return this.ctx;
  }

  get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** Seconds between scheduling and hearing a sound. */
  get outputDelay(): number {
    const c = this.ctx;
    return c ? (c.outputLatency || 0) + c.baseLatency : 0;
  }

  // ---------- building blocks ----------

  private env(t: number, peak: number, decay: number, attack = 0.001): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }

  private osc(type: OscillatorType, freq: number, t: number, dur: number, dest: AudioNode): OscillatorNode {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  private noiseSrc(t: number, dur: number, dest: AudioNode) {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.connect(dest);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
  }

  private filter(type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
    const f = this.ctx!.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  private shaper(amount: number, steps = 0): WaveShaperNode {
    const ws = this.ctx!.createWaveShaper();
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let x = (i / (n - 1)) * 2 - 1;
      if (amount > 0) x = Math.tanh(x * (1 + amount)) / Math.tanh(1 + amount);
      if (steps > 0) x = Math.round(x * steps) / steps;
      curve[i] = x;
    }
    ws.curve = curve;
    return ws;
  }

  private send(node: AudioNode, amount: number) {
    if (amount <= 0) return;
    const g = this.ctx!.createGain();
    g.gain.value = amount;
    node.connect(g).connect(this.reverbIn);
  }

  private metal(t: number, dur: number, ratio: number, dest: AudioNode) {
    for (const f of METAL) this.osc('square', f * ratio * 1.5, t, dur, dest);
  }

  // ---------- drums ----------

  /** Each kit has its own output chain (filter, crunch, drive, reverb). */
  private kitBus(kit: Kit): AudioNode {
    const cached = this.kitBuses.get(kit.name);
    if (cached) return cached;
    const ctx = this.ctx!;
    const input = ctx.createGain();
    let node: AudioNode = input;
    if (kit.drive || kit.crush) {
      const ws = this.shaper(kit.drive ?? 0, kit.crush ?? 0);
      node.connect(ws);
      node = ws;
    }
    if (kit.lowpass) {
      const lp = this.filter('lowpass', kit.lowpass, 0.6);
      node.connect(lp);
      node = lp;
    }
    const level = ctx.createGain();
    level.gain.value = kit.drive ? 0.75 : 1;
    node.connect(level).connect(this.out);
    if (kit.reverb) this.send(level, kit.reverb);
    this.kitBuses.set(kit.name, input);
    return input;
  }

  drum(pad: number, t: number, vel: number, p: PadParams, kitName = 'Pulse') {
    if (!this.ctx) return;
    const kit = KITS.find((k) => k.name === kitName) ?? KITS[0];
    const r = Math.pow(2, (p.tune + kit.tune) / 12);
    const d = p.decay * kit.decay;
    const v = vel * p.level;
    const out = this.kitBus(kit);
    const acoustic = kit.style === 'acoustic';
    const minimal = kit.style === 'minimal';

    if (minimal && pad !== 0 && pad !== 11 && pad !== 7) {
      // Minimal kit: everything becomes short tuned clicks and ticks.
      const f = [0, 1800, 2400, 3200, 6000, 5000, 7000, 0, 300, 420, 560, 0, 1100, 1500, 900, 760][pad] * r;
      const g = this.env(t, v * 0.5, 0.03 * d + (pad >= 8 && pad <= 10 ? 0.08 : 0));
      this.osc(pad >= 4 && pad <= 6 ? 'square' : 'sine', f, t, 0.15, g);
      if (pad === 1 || pad === 2 || pad === 4 || pad === 5 || pad === 6) {
        const hp = this.filter('highpass', 4000, 0.7);
        this.noiseSrc(t, 0.03, hp);
        hp.connect(g);
      }
      g.connect(out);
      return;
    }

    switch (pad) {
      case 0: { // kick
        const g = this.env(t, v, 0.45 * d);
        const o = this.osc('sine', (acoustic ? 120 : 160) * r, t, 0.5 * d, g);
        o.frequency.exponentialRampToValueAtTime((acoustic ? 52 : 45) * r, t + (acoustic ? 0.06 : 0.12));
        g.connect(out);
        if (acoustic) { // beater click
          const cg = this.env(t, v * 0.4, 0.012);
          const hp = this.filter('highpass', 2500);
          this.noiseSrc(t, 0.02, hp);
          hp.connect(cg).connect(out);
        }
        break;
      }
      case 1: { // snare
        const ng = this.env(t, v * (acoustic ? 0.8 : 0.7), (acoustic ? 0.26 : 0.18) * d);
        const nf = acoustic ? this.filter('bandpass', 2600 * r, 0.6) : this.filter('highpass', 1200 * r);
        this.noiseSrc(t, 0.3 * d, nf);
        nf.connect(ng).connect(out);
        const tg = this.env(t, v * 0.5, 0.1 * d);
        const o = this.osc('triangle', (acoustic ? 180 : 200) * r, t, 0.12 * d, tg);
        o.frequency.exponentialRampToValueAtTime(150 * r, t + 0.1);
        tg.connect(out);
        break;
      }
      case 2: { // clap: three quick bursts and a tail
        const bp = this.filter('bandpass', 1400 * r, 1.2);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, t);
        for (const o of [0, 0.011, 0.022]) {
          g.gain.setValueAtTime(v, t + o);
          g.gain.exponentialRampToValueAtTime(0.05, t + o + 0.009);
        }
        g.gain.setValueAtTime(v * 0.6, t + 0.031);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.031 + 0.16 * d);
        this.noiseSrc(t, 0.25 * d, bp);
        bp.connect(g).connect(out);
        break;
      }
      case 3: { // rim
        const g = this.env(t, v * 0.6, 0.035 * d);
        this.osc('triangle', 1700 * r, t, 0.05, g);
        const bp = this.filter('bandpass', 3000 * r, 2);
        this.noiseSrc(t, 0.02, bp);
        bp.connect(g);
        g.connect(out);
        break;
      }
      case 4: case 5: { // closed / open hat
        if (this.openHat) { // a new hat chokes a ringing open hat
          this.openHat.gain.cancelScheduledValues(t);
          this.openHat.gain.setTargetAtTime(0, t, 0.01);
          this.openHat = null;
        }
        const open = pad === 5;
        const g = this.env(t, v * 0.35, (open ? 0.35 : 0.045) * d);
        const hp = this.filter('highpass', (acoustic ? 8000 : 7000) * r);
        if (!acoustic) this.metal(t, open ? 0.5 * d : 0.08, r * 1.4, hp);
        this.noiseSrc(t, open ? 0.5 * d : 0.08, hp);
        hp.connect(g).connect(out);
        if (open) this.openHat = g;
        break;
      }
      case 6: { // shaker
        const g = this.env(t, v * 0.35, 0.07 * d, 0.012);
        const bp = this.filter('bandpass', 5500 * r, 1.2);
        this.noiseSrc(t, 0.12 * d, bp);
        bp.connect(g).connect(out);
        break;
      }
      case 7: case 11: { // ride / crash
        const crash = pad === 11;
        const g = this.env(t, v * (crash ? 0.3 : 0.18), (crash ? 1.4 : 0.8) * d);
        const hp = this.filter('highpass', crash ? 5000 : 7500);
        this.metal(t, (crash ? 1.5 : 0.9) * d, r * (crash ? 1.1 : 1.6), hp);
        if (crash || acoustic) this.noiseSrc(t, 1.5 * d, hp);
        hp.connect(g).connect(out);
        break;
      }
      case 8: case 9: case 10: { // toms
        const base = [95, 140, 200][pad - 8] * r;
        const g = this.env(t, v * 0.9, (acoustic ? 0.5 : 0.35) * d);
        const o = this.osc('sine', base * 1.4, t, 0.6 * d, g);
        o.frequency.exponentialRampToValueAtTime(base, t + 0.08);
        g.connect(out);
        if (acoustic) {
          const ng = this.env(t, v * 0.15, 0.08);
          const bp = this.filter('bandpass', base * 4, 1);
          this.noiseSrc(t, 0.1, bp);
          bp.connect(ng).connect(out);
        }
        break;
      }
      case 12: { // blip
        const g = this.env(t, v * 0.4, 0.12 * d);
        const o = this.osc('sine', 880 * r, t, 0.15 * d, g);
        o.frequency.exponentialRampToValueAtTime(1320 * r, t + 0.02);
        g.connect(out);
        break;
      }
      case 13: { // zap
        const g = this.env(t, v * 0.35, 0.16 * d);
        const lp = this.filter('lowpass', 3000, 4);
        const o = this.osc('sawtooth', 1400 * r, t, 0.2 * d, lp);
        o.frequency.exponentialRampToValueAtTime(70 * r, t + 0.15 * d);
        lp.connect(g).connect(out);
        break;
      }
      case 14: { // noise sweep
        const g = this.env(t, v * 0.5, 0.3 * d);
        const lp = this.filter('lowpass', 9000, 3);
        lp.frequency.exponentialRampToValueAtTime(400 * r, t + 0.3 * d);
        this.noiseSrc(t, 0.35 * d, lp);
        lp.connect(g).connect(out);
        break;
      }
      case 15: { // cowbell
        const g = this.env(t, v * 0.35, 0.25 * d);
        const bp = this.filter('bandpass', 800 * r, 1.5);
        this.osc('square', 540 * r, t, 0.3 * d, bp);
        this.osc('square', 800 * r, t, 0.3 * d, bp);
        bp.connect(g).connect(out);
        break;
      }
    }
  }

  // ---------- preset voices ----------

  /** Start one note of a preset at time t. */
  voice(p: SynthPreset, midi: number, t: number, vel: number, o: VoiceOpts = {}): Voice {
    const ctx = this.ctx!;
    const freq = midiToFreq(midi);
    const bright = o.brightness ?? 0.5;
    const relSec = o.release ?? p.amp.r;
    const cutoffFor = (b: number) => Math.min(16000, p.filter.base * (0.3 + 1.4 * b) * Math.sqrt(freq / 261.6));

    const amp = ctx.createGain();
    const peak = vel * (o.level ?? 0.8) * (p.gain ?? 0.3);
    const sus = Math.max(0.0001, peak * p.amp.s);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + p.amp.a);
    amp.gain.setTargetAtTime(sus, t + p.amp.a, Math.max(0.01, p.amp.d / 3));

    const filt = this.filter('lowpass', cutoffFor(bright), p.filter.q);
    const cut = cutoffFor(bright);
    if (p.filter.env) {
      filt.frequency.setValueAtTime(Math.min(18000, cut + p.filter.env), t);
      filt.frequency.setTargetAtTime(cut, t + 0.002, Math.max(0.01, p.filter.decay / 3));
    }
    let head: AudioNode = filt;
    if (p.drive) {
      const ws = this.shaper(p.drive);
      ws.connect(filt);
      head = ws;
    }
    filt.connect(amp).connect(this.out);
    if (p.reverb) this.send(amp, p.reverb);

    // Every oscillator, with its resting detune, so bends can move them together.
    const oscs: [OscillatorNode, number][] = [];
    for (const l of p.layers) {
      const osc = ctx.createOscillator();
      osc.type = l.type;
      osc.frequency.value = freq * (l.ratio ?? 1);
      osc.detune.value = l.detune ?? 0;
      const g = ctx.createGain();
      g.gain.value = l.gain ?? 1;
      osc.connect(g).connect(head);
      osc.start(t);
      oscs.push([osc, l.detune ?? 0]);
    }
    if (p.fm) {
      const car = ctx.createOscillator();
      car.frequency.value = freq;
      const mod = ctx.createOscillator();
      mod.frequency.value = freq * p.fm.ratio;
      const idx = ctx.createGain();
      idx.gain.setValueAtTime(freq * p.fm.index, t);
      idx.gain.setTargetAtTime(freq * p.fm.index * 0.15, t, p.fm.decay / 3);
      mod.connect(idx).connect(car.frequency);
      const cg = ctx.createGain();
      cg.gain.value = p.fm.gain ?? 1;
      car.connect(cg).connect(head);
      car.start(t);
      mod.start(t);
      oscs.push([car, 0], [mod, 0]);
    }
    let lfo: OscillatorNode | null = null;
    if (p.vibrato) {
      lfo = ctx.createOscillator();
      lfo.frequency.value = p.vibrato.rate;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(p.vibrato.depth, t + 0.4);
      lfo.connect(depth);
      for (const [osc] of oscs) depth.connect(osc.detune);
      lfo.start(t);
    }

    let released = false;
    return {
      setPitch: (semis, at, glide = 0.004) => {
        for (const [osc, base] of oscs) osc.detune.setTargetAtTime(base + semis * 100, at, glide);
      },
      setBrightness: (b, at) => filt.frequency.setTargetAtTime(cutoffFor(b), at, 0.02),
      release: (at) => {
        if (released) return;
        released = true;
        const rt = Math.max(at, t + 0.01);
        const g = amp.gain as AudioParam & { cancelAndHoldAtTime?: (t: number) => void };
        if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(rt);
        else g.cancelScheduledValues(rt);
        g.setTargetAtTime(0, rt, Math.max(0.01, relSec / 4));
        for (const [osc] of oscs) osc.stop(rt + relSec * 1.5 + 0.1);
        lfo?.stop(rt + relSec * 1.5 + 0.1);
      },
    };
  }

  /** Several voices started together, released together. */
  chord(p: SynthPreset, midis: number[], t: number, vel: number, o: VoiceOpts = {}): Voice {
    const scale = 1 / Math.sqrt(midis.length);
    const vs = midis.map((m) => this.voice(p, m, t, vel * scale * 1.6, o));
    return {
      setPitch: (s, at, g) => vs.forEach((v) => v.setPitch(s, at, g)),
      setBrightness: (b, at) => vs.forEach((v) => v.setBrightness(b, at)),
      release: (at) => vs.forEach((v) => v.release(at)),
    };
  }

  /** Short sine blip used as the metronome. */
  click(t: number, accent: boolean) {
    if (!this.ctx) return;
    const g = this.env(t, accent ? 0.35 : 0.2, 0.03);
    this.osc('sine', accent ? 1600 : 1100, t, 0.04, g);
    g.connect(this.out);
  }
}

export const engine = new Engine();
