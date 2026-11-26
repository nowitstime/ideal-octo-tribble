// Loop clock: a lookahead scheduler that queues notes slightly ahead on the
// audio clock (sample-accurate playback), plus helpers for recording live input.
import { engine, type Voice } from './engine';
import { project, loopSteps, loopTicks, update, chordDegreeAt, type ChordNote, type BendPoint, type TrackId } from '../state';
import { TPS, stepsToTicks, swingTicks, snap, wrap } from '../ticks';
import { chordMidis, bassMidi, leadMidi, type Mods } from '../theory';
import { CHORD_PRESETS, BASS_PRESETS, LEAD_PRESETS, presetByName } from './presets';

const LOOKAHEAD = 0.12; // seconds of audio queued ahead
const TICK_MS = 25;

export type { TrackId };
/** Fired for every scheduled note so the UI can pulse in time with it. */
export type HitListener = (track: TrackId, audioTime: number, detail: number) => void;

/** A bend captured while recording: absolute step and semitone offset. */
export interface LiveBend {
  abs: number;
  v: number;
}

const mod = (x: number, L: number) => ((x % L) + L) % L;

class Transport {
  playing = false;
  recording = false;
  private startTime = 0;
  /** Absolute step (since play started) up to which notes are queued. */
  private scheduledUntil = 0;
  private timer = 0;
  private hitListeners = new Set<HitListener>();
  private stateListeners = new Set<() => void>();

  get stepDur(): number {
    return 60 / project.bpm / 4;
  }

  onHit(fn: HitListener): () => void {
    this.hitListeners.add(fn);
    return () => this.hitListeners.delete(fn);
  }

  onState(fn: () => void): () => void {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  private emitState() {
    this.stateListeners.forEach((f) => f());
  }

  private hit(track: TrackId, t: number, detail: number) {
    this.hitListeners.forEach((f) => f(track, t, detail));
  }

  start() {
    const ctx = engine.ensure();
    if (this.playing) return;
    this.startTime = ctx.currentTime + 0.06;
    this.scheduledUntil = 0;
    this.playing = true;
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.tick();
    this.emitState();
  }

  stop() {
    this.playing = false;
    this.recording = false;
    clearInterval(this.timer);
    this.emitState();
  }

  toggle() {
    if (this.playing) this.stop();
    else this.start();
  }

  /** Record button: arms recording and starts playback if needed. */
  toggleRecord() {
    if (this.recording) {
      this.recording = false;
    } else {
      this.recording = true;
      if (!this.playing) this.start();
    }
    this.emitState();
  }

  /** Keep the playhead continuous when the tempo changes mid-loop. */
  setBpm(bpm: number) {
    const ctx = engine.ctx;
    if (this.playing && ctx) {
      const abs = (ctx.currentTime - this.startTime) / this.stepDur;
      update((p) => { p.bpm = bpm; });
      this.startTime = ctx.currentTime - abs * this.stepDur;
    } else {
      update((p) => { p.bpm = bpm; });
    }
  }

  absAt(t: number): number {
    return (t - this.startTime) / this.stepDur;
  }

  timeOf(abs: number): number {
    return this.startTime + abs * this.stepDur;
  }

  /** Loop position (in steps) of what is being heard right now. */
  heardStep(): number {
    if (!this.playing || !engine.ctx) return 0;
    return mod(this.absAt(engine.ctx.currentTime - engine.outputDelay), loopSteps(project));
  }

  /** Chord degree being heard now; when stopped, the progression's first chord. */
  heardChord(): number {
    return this.playing ? chordDegreeAt(project, this.heardStep() * TPS) : project.progression[0];
  }

  /** Next grid point (multiple of `rate` steps) after `t`, for synced arps. */
  nextGrid(rate: number, t: number): { abs: number; time: number } {
    const abs = Math.ceil(this.absAt(t) / rate - 1e-6) * rate;
    return { abs, time: this.timeOf(abs) };
  }

  /** Seconds per tick. */
  get tickDur(): number {
    return this.stepDur / TPS;
  }

  /** Swing delay in seconds for a note at `tick`. */
  private swing(tick: number): number {
    return swingTicks(tick, project.drums.swing) * this.tickDur;
  }

  private applyBend(v: Voice, bend: BendPoint[] | undefined, t: number) {
    if (!bend) return;
    for (const b of bend) v.setPitch(b.v, t + b.t * this.tickDur, 0.008);
  }

  private tick() {
    const ctx = engine.ctx;
    if (!ctx) return;
    const a = this.scheduledUntil;
    const b = this.absAt(ctx.currentTime + LOOKAHEAD);
    if (b <= a) return;
    const L = loopSteps(project);
    const LT = loopTicks(project);
    const aT = a * TPS, bT = b * TPS;
    const { drums, chords, bass, lead } = project;

    for (let k = Math.floor(a / L); k <= Math.floor((b - 1e-9) / L); k++) {
      const base = k * LT;
      // Returns the absolute tick if this note starts inside the window.
      const due = (n: { tick: number; skipAbs?: number }): number | null => {
        if (n.tick >= LT) return null;
        const abs = base + n.tick;
        if (abs < aT || abs >= bT) return null;
        if (n.skipAbs === abs) { n.skipAbs = undefined; return null; }
        return abs;
      };
      const at = (absTick: number) => this.timeOf(absTick / TPS);

      if (!drums.muted) {
        for (const n of drums.notes) {
          const abs = due(n);
          if (abs === null) continue;
          const t = at(abs) + this.swing(n.tick);
          engine.drum(n.pad, t, n.vel, drums.pads[n.pad], drums.kit);
          this.hit('drums', t, n.pad);
        }
      }
      if (!chords.muted) {
        for (const n of chords.notes) {
          const abs = due(n);
          if (abs === null) continue;
          const t = at(abs);
          playChordNote(n, t).release(t + Math.min(n.len, LT) * this.tickDur);
          this.hit('chords', t, n.degree);
        }
      }
      if (!bass.muted) {
        for (const n of bass.notes) {
          const abs = due(n);
          if (abs === null) continue;
          const t = at(abs) + this.swing(n.tick);
          const v = playBass(chordDegreeAt(project, n.tick), n.tone, t, n.vel);
          this.applyBend(v, n.bend, t);
          v.release(t + Math.min(n.len, LT) * this.tickDur);
          this.hit('bass', t, n.tone);
        }
      }
      if (!lead.muted) {
        for (const n of lead.notes) {
          const abs = due(n);
          if (abs === null) continue;
          const t = at(abs) + this.swing(n.tick);
          const v = playLead(n.degree, t, n.vel);
          this.applyBend(v, n.bend, t);
          v.release(t + Math.min(n.len, LT) * this.tickDur);
          this.hit('lead', t, n.degree);
        }
      }
      if (project.click) {
        const kS = k * L;
        for (let s = 0; s < L; s += 4) {
          const abs = kS + s;
          if (abs >= a && abs < b) engine.click(this.timeOf(abs), s % 16 === 0);
        }
      }
    }
    this.scheduledUntil = b;
  }

  /**
   * Where a live touch lands in the loop (absolute steps). Corrects for the
   * event's own delay and for output latency (you played along to sound that
   * was already late).
   */
  absForEvent(e: { timeStamp: number }): number {
    const ctx = engine.ctx!;
    const eventDelay = Math.max(0, (performance.now() - e.timeStamp) / 1000);
    return this.absAt(ctx.currentTime - eventDelay - engine.outputDelay);
  }

  get canRecord(): boolean {
    return this.recording && this.playing && !!engine.ctx;
  }

  /**
   * If a recorded note lands in audio not yet queued it would sound twice;
   * mark that copy (by absolute tick) to be skipped once.
   */
  private skipFor(absTick: number): number | undefined {
    return absTick >= this.scheduledUntil * TPS ? absTick : undefined;
  }

  /** Record a drum hit (call when a pad is played live). */
  recordDrum(e: { timeStamp: number }, pad: number, vel: number) {
    if (!this.canRecord) return;
    const LT = loopTicks(project);
    let abs = stepsToTicks(this.absForEvent(e));
    if (project.quantize) abs = snap(abs, TPS);
    const tick = wrap(abs, LT);
    const skipAbs = this.skipFor(abs);
    update((p) => {
      if (project.quantize) {
        const same = p.drums.notes.find((n) => n.pad === pad && n.tick === tick);
        if (same) { same.vel = vel; same.skipAbs = skipAbs; return; }
      }
      p.drums.notes.push({ tick, pad, vel, skipAbs });
    });
  }

  /** Snap a recorded note's start/length (given in steps) to ticks, and to the grid when quantize is on. */
  private place(startAbs: number, endAbs: number) {
    const LT = loopTicks(project);
    let s = stepsToTicks(startAbs);
    let len = Math.max(TPS / 4, stepsToTicks(endAbs) - s);
    if (project.quantize) {
      s = snap(s, TPS);
      len = Math.max(TPS, snap(len, TPS));
    }
    return { abs: s, tick: wrap(s, LT), len: Math.min(len, LT) };
  }

  /** Begin a live chord recording; returns a function to call on release. */
  beginChordRecord(e: { timeStamp: number }, degree: number, inv: number, mods: Mods, vel: number) {
    if (!this.canRecord) return null;
    const startAbs = this.absForEvent(e);
    return (endEvent: { timeStamp: number }) => {
      if (!this.playing) return;
      const { tick, len } = this.place(startAbs, this.absForEvent(endEvent));
      update((p) => {
        p.chords.notes = p.chords.notes.filter((n) => n.tick + n.len <= tick || n.tick >= tick + len);
        p.chords.notes.push({ tick, len, degree, inv, mods: { ...mods }, vel });
      });
    };
  }

  /** Store a finished bass or lead note with its bend curve. */
  recordMelodic(track: 'bass' | 'lead', startAbs: number, endAbs: number, pitch: number, vel: number, bends: LiveBend[]) {
    if (!this.playing) return;
    const { abs, tick, len } = this.place(startAbs, endAbs);
    // Keep bends relative to when the note actually started; thin them out.
    const bend: BendPoint[] = [];
    for (const b of bends) {
      const t = Math.max(0, stepsToTicks(b.abs - startAbs));
      const last = bend[bend.length - 1];
      if (!last || Math.abs(last.v - b.v) > 0.04 || t - last.t > TPS / 2) bend.push({ t, v: +b.v.toFixed(3) });
    }
    const hasBend = bend.some((b) => Math.abs(b.v) > 0.05);
    const skipAbs = this.skipFor(abs);
    update((p) => {
      if (track === 'bass') {
        // The bass is monophonic: a new note replaces whatever it overlaps.
        p.bass.notes = p.bass.notes.filter((n) => n.tick + n.len <= tick || n.tick >= tick + len);
        p.bass.notes.push({ tick, len, tone: pitch, vel, bend: hasBend ? bend : undefined, skipAbs });
      } else {
        p.lead.notes.push({ tick, len, degree: pitch, vel, bend: hasBend ? bend : undefined, skipAbs });
      }
    });
  }

  /** Store an arpeggiator note that was scheduled exactly on the grid (abs and len in steps). */
  recordArpNote(abs: number, len: number, degree: number, vel: number) {
    if (!this.canRecord) return;
    const absTick = stepsToTicks(abs);
    const tick = wrap(absTick, loopTicks(project));
    const skipAbs = this.skipFor(absTick);
    update((p) => {
      const same = p.lead.notes.find((n) => n.degree === degree && n.tick === tick);
      if (same) { same.skipAbs = skipAbs; return; }
      p.lead.notes.push({ tick, len: Math.max(1, stepsToTicks(len)), degree, vel, skipAbs });
    });
  }
}

export function playChordNote(n: Pick<ChordNote, 'degree' | 'inv' | 'mods' | 'vel'>, t: number): Voice {
  const c = project.chords;
  return engine.chord(presetByName(CHORD_PRESETS, c.preset), chordMidis(project.key, project.mode, n.degree, n.inv, n.mods), t, n.vel,
    { brightness: c.cutoff, release: c.release, level: c.level });
}

export function playBass(chordDegree: number, tone: number, t: number, vel: number): Voice {
  const b = project.bass;
  return engine.voice(presetByName(BASS_PRESETS, b.preset), bassMidi(project.key, project.mode, chordDegree, tone), t, vel,
    { brightness: b.tone, level: b.level });
}

export function playLead(degree: number, t: number, vel: number, brightness = 0.55): Voice {
  const l = project.lead;
  return engine.voice(presetByName(LEAD_PRESETS, l.preset), leadMidi(project.key, project.mode, degree), t, vel,
    { brightness, level: l.level });
}

export const transport = new Transport();
