// All sound is synthesized: 16 drum voices and a soft chord pad.
import type { PadParams } from '../state';
import { midiToFreq } from '../theory';

export const PAD_NAMES = [
  'kick', 'snare', 'clap', 'rim',
  'hat', 'open', 'shake', 'ride',
  'tom l', 'tom m', 'tom h', 'crash',
  'blip', 'zap', 'noise', 'cow',
];

/** Inharmonic ratios for metallic cymbal / cowbell tones (808-style). */
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];

export interface ChordVoice {
  release(t: number): void;
}

class Engine {
  ctx: AudioContext | null = null;
  private out!: GainNode;
  private noise!: AudioBuffer;
  private openHat: GainNode | null = null;

  /** Create/resume the audio context. Call from a user gesture. */
  ensure(): AudioContext {
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      this.out = ctx.createGain();
      this.out.gain.value = 0.8;
      this.out.connect(ctx.destination);
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      this.ctx = ctx;
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

  private metal(t: number, dur: number, ratio: number, dest: AudioNode) {
    for (const f of METAL) this.osc('square', f * ratio * 1.5, t, dur, dest);
  }

  // ---------- drums ----------

  drum(pad: number, t: number, vel: number, p: PadParams) {
    if (!this.ctx) return;
    const r = Math.pow(2, p.tune / 12);
    const d = p.decay;
    const v = vel * p.level;
    const out = this.out;
    switch (pad) {
      case 0: { // kick
        const g = this.env(t, v, 0.45 * d);
        const o = this.osc('sine', 160 * r, t, 0.5 * d, g);
        o.frequency.exponentialRampToValueAtTime(45 * r, t + 0.12);
        g.connect(out);
        break;
      }
      case 1: { // snare
        const ng = this.env(t, v * 0.7, 0.18 * d);
        const hp = this.filter('highpass', 1200 * r);
        this.noiseSrc(t, 0.2 * d, hp);
        hp.connect(ng).connect(out);
        const tg = this.env(t, v * 0.5, 0.1 * d);
        const o = this.osc('triangle', 200 * r, t, 0.12 * d, tg);
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
        if (this.openHat) { // closed hat (or new open hat) chokes a ringing open hat
          this.openHat.gain.cancelScheduledValues(t);
          this.openHat.gain.setTargetAtTime(0, t, 0.01);
          this.openHat = null;
        }
        const open = pad === 5;
        const g = this.env(t, v * 0.35, (open ? 0.35 : 0.045) * d);
        const hp = this.filter('highpass', 7000 * r);
        this.metal(t, open ? 0.5 * d : 0.08, r * 1.4, hp);
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
        if (crash) this.noiseSrc(t, 1.5 * d, hp);
        hp.connect(g).connect(out);
        break;
      }
      case 8: case 9: case 10: { // toms
        const base = [95, 140, 200][pad - 8] * r;
        const g = this.env(t, v * 0.9, 0.35 * d);
        const o = this.osc('sine', base * 1.4, t, 0.4 * d, g);
        o.frequency.exponentialRampToValueAtTime(base, t + 0.08);
        g.connect(out);
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

  // ---------- chord pad ----------

  /** Start a chord at time t. Call release() on the result to end it. */
  chord(midis: number[], t: number, vel: number, cutoff: number, releaseSec: number, level: number): ChordVoice {
    const ctx = this.ctx!;
    const lp = this.filter('lowpass', 300 + cutoff * cutoff * 6000, 0.8);
    const g = ctx.createGain();
    const peak = (vel * level * 0.5) / Math.sqrt(midis.length);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.02);
    g.gain.setTargetAtTime(peak * 0.75, t + 0.02, 0.3);
    lp.connect(g).connect(this.out);
    const oscs: OscillatorNode[] = [];
    for (const m of midis) {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midiToFreq(m);
        o.detune.value = det;
        o.connect(lp);
        o.start(t);
        oscs.push(o);
      }
    }
    let released = false;
    return {
      release: (rt: number) => {
        if (released) return;
        released = true;
        const at = Math.max(rt, t + 0.03);
        g.gain.cancelScheduledValues(at);
        g.gain.setTargetAtTime(0, at, releaseSec / 4);
        for (const o of oscs) o.stop(at + releaseSec * 1.5 + 0.1);
      },
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
