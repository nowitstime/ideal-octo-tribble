// Loop clock: a lookahead scheduler that queues notes slightly ahead on the
// audio clock (sample-accurate playback), plus helpers for recording live input.
import { engine, type ChordVoice } from './engine';
import { project, loopSteps, update, type ChordNote } from '../state';
import { chordMidis, type Mods } from '../theory';

const LOOKAHEAD = 0.12; // seconds of audio queued ahead
const TICK_MS = 25;

export type TrackId = 'drums' | 'chords';
/** Fired for every scheduled note so the UI can pulse in time with it. */
export type HitListener = (track: TrackId, audioTime: number, detail: number) => void;

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

  private absAt(t: number): number {
    return (t - this.startTime) / this.stepDur;
  }

  private timeOf(abs: number): number {
    return this.startTime + abs * this.stepDur;
  }

  /** Loop position (in steps) of what is being heard right now. */
  heardStep(): number {
    if (!this.playing || !engine.ctx) return 0;
    const L = loopSteps(project);
    const abs = this.absAt(engine.ctx.currentTime - engine.outputDelay);
    return ((abs % L) + L) % L;
  }

  private swing(step: number): number {
    const r = Math.round(step);
    if (Math.abs(step - r) > 0.01 || r % 2 === 0) return 0;
    return project.drums.swing * this.stepDur * 0.5;
  }

  private tick() {
    const ctx = engine.ctx;
    if (!ctx) return;
    const a = this.scheduledUntil;
    const b = this.absAt(ctx.currentTime + LOOKAHEAD);
    if (b <= a) return;
    const L = loopSteps(project);
    const { drums, chords } = project;

    for (let k = Math.floor(a / L); k <= Math.floor((b - 1e-9) / L); k++) {
      const base = k * L;
      const inRange = (abs: number) => abs >= a && abs < b;

      if (!drums.muted) {
        for (const n of drums.notes) {
          if (n.step >= L) continue;
          const abs = base + n.step;
          if (!inRange(abs)) continue;
          if (n.skipAbs === abs) { n.skipAbs = undefined; continue; }
          const t = this.timeOf(abs) + this.swing(n.step);
          engine.drum(n.pad, t, n.vel, drums.pads[n.pad]);
          this.hitListeners.forEach((f) => f('drums', t, n.pad));
        }
      }
      if (!chords.muted) {
        for (const n of chords.notes) {
          if (n.step >= L) continue;
          const abs = base + n.step;
          if (!inRange(abs)) continue;
          if (n.skipAbs === abs) { n.skipAbs = undefined; continue; }
          const t = this.timeOf(abs);
          const v = playChordNote(n, t);
          v.release(t + Math.min(n.len, L) * this.stepDur);
          this.hitListeners.forEach((f) => f('chords', t, n.degree));
        }
      }
      if (project.click) {
        for (let s = 0; s < L; s += 4) {
          const abs = base + s;
          if (inRange(abs)) engine.click(this.timeOf(abs), s % 16 === 0);
        }
      }
    }
    this.scheduledUntil = b;
  }

  /**
   * Where a live touch lands in the loop. Corrects for the event's own delay
   * and for output latency (you tapped along to sound that was already late).
   */
  private eventAbs(e: { timeStamp: number }): number {
    const ctx = engine.ctx!;
    const eventDelay = Math.max(0, (performance.now() - e.timeStamp) / 1000);
    return this.absAt(ctx.currentTime - eventDelay - engine.outputDelay);
  }

  /** Record a drum hit (call when a pad is played live). */
  recordDrum(e: { timeStamp: number }, pad: number, vel: number) {
    if (!this.recording || !this.playing) return;
    const L = loopSteps(project);
    let abs = this.eventAbs(e);
    if (project.quantize) abs = Math.round(abs);
    const step = ((abs % L) + L) % L;
    // If the note lands in audio not yet queued, it would sound twice
    // (live + scheduled), so skip that one scheduled copy.
    const skipAbs = abs >= this.scheduledUntil ? abs : undefined;
    update((p) => {
      if (project.quantize) {
        const same = p.drums.notes.find((n) => n.pad === pad && Math.abs(n.step - step) < 0.01);
        if (same) { same.vel = vel; same.skipAbs = skipAbs; return; }
      }
      p.drums.notes.push({ step, pad, vel, skipAbs });
    });
  }

  /** Begin a live chord recording; returns a function to call on release. */
  beginChordRecord(e: { timeStamp: number }, degree: number, inv: number, mods: Mods, vel: number) {
    if (!this.recording || !this.playing) return null;
    const startAbs = this.eventAbs(e);
    return (endEvent: { timeStamp: number }) => {
      if (!this.playing) return;
      const L = loopSteps(project);
      let s = startAbs;
      let len = Math.max(0.5, this.eventAbs(endEvent) - startAbs);
      if (project.quantize) {
        s = Math.round(s);
        len = Math.max(1, Math.round(len));
      }
      const step = ((s % L) + L) % L;
      update((p) => {
        p.chords.notes = p.chords.notes.filter((n) => n.step + n.len <= step || n.step >= step + len);
        p.chords.notes.push({ step, len: Math.min(len, L), degree, inv, mods: { ...mods }, vel });
      });
    };
  }
}

export function playChordNote(n: Pick<ChordNote, 'degree' | 'inv' | 'mods' | 'vel'>, t: number): ChordVoice {
  const c = project.chords;
  return engine.chord(chordMidis(project.key, project.mode, n.degree, n.inv, n.mods), t, n.vel, c.cutoff, c.release, c.level);
}

export const transport = new Transport();
