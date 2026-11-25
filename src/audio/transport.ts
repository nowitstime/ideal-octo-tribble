// Loop clock: a lookahead scheduler that queues notes slightly ahead on the
// audio clock (sample-accurate playback), plus helpers for recording live input.
import { engine, type Voice } from './engine';
import { project, loopSteps, update, chordDegreeAt, type ChordNote, type BendPoint, type TrackId } from '../state';
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
    return this.playing ? chordDegreeAt(project, this.heardStep()) : project.progression[0];
  }

  /** Next grid point (multiple of `rate` steps) after `t`, for synced arps. */
  nextGrid(rate: number, t: number): { abs: number; time: number } {
    const abs = Math.ceil(this.absAt(t) / rate - 1e-6) * rate;
    return { abs, time: this.timeOf(abs) };
  }

  private swing(step: number): number {
    const r = Math.round(step);
    if (Math.abs(step - r) > 0.01 || r % 2 === 0) return 0;
    return project.drums.swing * this.stepDur * 0.5;
  }

  private applyBend(v: Voice, bend: BendPoint[] | undefined, t: number) {
    if (!bend) return;
    for (const b of bend) v.setPitch(b.v, t + b.t * this.stepDur, 0.008);
  }

  private tick() {
    const ctx = engine.ctx;
    if (!ctx) return;
    const a = this.scheduledUntil;
    const b = this.absAt(ctx.currentTime + LOOKAHEAD);
    if (b <= a) return;
    const L = loopSteps(project);
    const { drums, chords, bass, lead } = project;

    for (let k = Math.floor(a / L); k <= Math.floor((b - 1e-9) / L); k++) {
      const base = k * L;
      // Returns the absolute step if this note starts inside the window.
      const due = (n: { step: number; skipAbs?: number }): number | null => {
        if (n.step >= L) return null;
        const abs = base + n.step;
        if (abs < a || abs >= b) return null;
        if (n.skipAbs === abs) { n.skipAbs = undefined; return null; }
        return abs;
      };

      if (!drums.muted) {
        for (const n of drums.notes) {
          const abs = due(n);
          if (abs === null) continue;
          const t = this.timeOf(abs) + this.swing(n.step);
          engine.drum(n.pad, t, n.vel, drums.pads[n.pad], drums.kit);
          this.hit('drums', t, n.pad);
        }
      }
      if (!chords.muted) {
        for (const n of chords.notes) {
          const abs = due(n);
          if (abs === null) continue;
          const t = this.timeOf(abs);
          playChordNote(n, t).release(t + Math.min(n.len, L) * this.stepDur);
          this.hit('chords', t, n.degree);
        }
      }
      if (!bass.muted) {
        for (const n of bass.notes) {
          const abs = due(n);
          if (abs === null) continue;
          const t = this.timeOf(abs) + this.swing(n.step);
          const v = playBass(chordDegreeAt(project, n.step), n.tone, t, n.vel);
          this.applyBend(v, n.bend, t);
          v.release(t + Math.min(n.len, L) * this.stepDur);
          this.hit('bass', t, n.tone);
        }
      }
      if (!lead.muted) {
        for (const n of lead.notes) {
          const abs = due(n);
          if (abs === null) continue;
          const t = this.timeOf(abs) + this.swing(n.step);
          const v = playLead(n.degree, t, n.vel);
          this.applyBend(v, n.bend, t);
          v.release(t + Math.min(n.len, L) * this.stepDur);
          this.hit('lead', t, n.degree);
        }
      }
      if (project.click) {
        for (let s = 0; s < L; s += 4) {
          const abs = base + s;
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

  /** If a recorded note lands in audio not yet queued it would sound twice; skip that copy. */
  private skipFor(abs: number): number | undefined {
    return abs >= this.scheduledUntil ? abs : undefined;
  }

  /** Record a drum hit (call when a pad is played live). */
  recordDrum(e: { timeStamp: number }, pad: number, vel: number) {
    if (!this.canRecord) return;
    const L = loopSteps(project);
    let abs = this.absForEvent(e);
    if (project.quantize) abs = Math.round(abs);
    const step = mod(abs, L);
    const skipAbs = this.skipFor(abs);
    update((p) => {
      if (project.quantize) {
        const same = p.drums.notes.find((n) => n.pad === pad && Math.abs(n.step - step) < 0.01);
        if (same) { same.vel = vel; same.skipAbs = skipAbs; return; }
      }
      p.drums.notes.push({ step, pad, vel, skipAbs });
    });
  }

  /** Snap a recorded note's start/length to the grid when quantize is on. */
  private place(startAbs: number, endAbs: number) {
    const L = loopSteps(project);
    let s = startAbs;
    let len = Math.max(0.25, endAbs - startAbs);
    if (project.quantize) {
      s = Math.round(s);
      len = Math.max(1, Math.round(len));
    }
    return { abs: s, step: mod(s, L), len: Math.min(len, L) };
  }

  /** Begin a live chord recording; returns a function to call on release. */
  beginChordRecord(e: { timeStamp: number }, degree: number, inv: number, mods: Mods, vel: number) {
    if (!this.canRecord) return null;
    const startAbs = this.absForEvent(e);
    return (endEvent: { timeStamp: number }) => {
      if (!this.playing) return;
      const { step, len } = this.place(startAbs, this.absForEvent(endEvent));
      update((p) => {
        p.chords.notes = p.chords.notes.filter((n) => n.step + n.len <= step || n.step >= step + len);
        p.chords.notes.push({ step, len, degree, inv, mods: { ...mods }, vel });
      });
    };
  }

  /** Store a finished bass or lead note with its bend curve. */
  recordMelodic(track: 'bass' | 'lead', startAbs: number, endAbs: number, pitch: number, vel: number, bends: LiveBend[]) {
    if (!this.playing) return;
    const { abs, step, len } = this.place(startAbs, endAbs);
    // Keep bends relative to when the note actually started; thin them out.
    const bend: BendPoint[] = [];
    for (const b of bends) {
      const t = Math.max(0, b.abs - startAbs);
      const last = bend[bend.length - 1];
      if (!last || Math.abs(last.v - b.v) > 0.04 || t - last.t > 0.5) bend.push({ t: +t.toFixed(3), v: +b.v.toFixed(3) });
    }
    const hasBend = bend.some((b) => Math.abs(b.v) > 0.05);
    const skipAbs = this.skipFor(abs);
    update((p) => {
      if (track === 'bass') {
        // The bass is monophonic: a new note replaces whatever it overlaps.
        p.bass.notes = p.bass.notes.filter((n) => n.step + n.len <= step || n.step >= step + len);
        p.bass.notes.push({ step, len, tone: pitch, vel, bend: hasBend ? bend : undefined, skipAbs });
      } else {
        p.lead.notes.push({ step, len, degree: pitch, vel, bend: hasBend ? bend : undefined, skipAbs });
      }
    });
  }

  /** Store an arpeggiator note that was scheduled exactly on the grid. */
  recordArpNote(abs: number, len: number, degree: number, vel: number) {
    if (!this.canRecord) return;
    const L = loopSteps(project);
    const step = mod(abs, L);
    const skipAbs = this.skipFor(abs);
    update((p) => {
      const same = p.lead.notes.find((n) => n.degree === degree && Math.abs(n.step - step) < 0.01);
      if (same) { same.skipAbs = skipAbs; return; }
      p.lead.notes.push({ step, len, degree, vel, skipAbs });
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
