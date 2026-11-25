// Minimal synth drum engine. Everything is synthesized, no samples.
// Sounds are started at the time passed in. Use ctx.currentTime for
// "right now" (live play) or a future time for sequenced events.

export type LatencyHint = AudioContextLatencyCategory | number;
export type Sound = 'kick' | 'snare' | 'hat' | 'pluck';

export class Engine {
  ctx: AudioContext | null = null;
  private out!: GainNode;
  private noise!: AudioBuffer;

  async start(hint: LatencyHint): Promise<AudioContext> {
    if (this.ctx) await this.ctx.close();
    const ctx = new AudioContext({ latencyHint: hint });
    await ctx.resume();
    // Plain gain, no compressor: Chrome's compressor adds lookahead delay.
    this.out = ctx.createGain();
    this.out.gain.value = 0.7;
    this.out.connect(ctx.destination);
    this.noise = makeNoise(ctx);
    this.ctx = ctx;
    return ctx;
  }

  get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  play(sound: Sound, t: number, vel: number) {
    switch (sound) {
      case 'kick': return this.kick(t, vel);
      case 'snare': return this.snare(t, vel);
      case 'hat': return this.hat(t, vel);
      case 'pluck': return this.pluck(t, vel, 523.25);
    }
  }

  kick(t: number, v: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.5);
  }

  snare(t: number, v: number) {
    const ctx = this.ctx!;
    const n = this.noiseSource();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(v * 0.7, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    n.connect(hp).connect(ng).connect(this.out);
    n.start(t);
    n.stop(t + 0.2);

    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.1);
    const og = ctx.createGain();
    og.gain.setValueAtTime(v * 0.5, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(og).connect(this.out);
    o.start(t);
    o.stop(t + 0.12);
  }

  hat(t: number, v: number) {
    const ctx = this.ctx!;
    const n = this.noiseSource();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v * 0.45, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.connect(hp).connect(g).connect(this.out);
    n.start(t);
    n.stop(t + 0.06);
  }

  pluck(t: number, v: number, freq: number) {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(4500, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(v * 0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    lp.connect(g).connect(this.out);
    for (const detune of [-8, 8]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = detune;
      o.connect(lp);
      o.start(t);
      o.stop(t + 0.75);
    }
  }

  /** Metronome click. */
  click(t: number, accent: boolean) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.value = accent ? 1600 : 1000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.04);
  }

  /** Loud, sharp burst for the mic loopback test. */
  ping(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 2000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(1, t);
    g.gain.setValueAtTime(0, t + 0.015);
    // Bypass the master gain so the ping is as loud as possible.
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.02);
  }

  private noiseSource(): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    return s;
  }
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
