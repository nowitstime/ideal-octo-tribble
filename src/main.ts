import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { Engine, type LatencyHint, type Sound } from './audio';

registerSW({ immediate: true });

const engine = new Engine();
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const ms = (s: number) => `${(s * 1000).toFixed(1)} ms`;

const startBtn = $<HTMLButtonElement>('start');
const hintSel = $<HTMLSelectElement>('hint');
const status = $('status');

// Stop long-press menus and double-tap zoom from getting in the way.
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- Audio start / info ----------

function readHint(): LatencyHint {
  const v = hintSel.value;
  return v === 'interactive' || v === 'balanced' ? v : Number(v);
}

async function startAudio() {
  metro.stop();
  const ctx = await engine.start(readHint());
  startBtn.textContent = 'Audio on · tap to restart';
  startBtn.classList.add('on');
  status.textContent = `AUDIO ON · ${hintSel.selectedOptions[0].text.toUpperCase()}`;
  $('s-rate').textContent = `${ctx.sampleRate} Hz`;
  updateLatencyStats();
}

function updateLatencyStats() {
  const ctx = engine.ctx;
  if (!ctx) return;
  $('s-base').textContent = ms(ctx.baseLatency);
  // outputLatency can be 0 until audio has been flowing for a moment.
  $('s-out').textContent = 'outputLatency' in ctx && ctx.outputLatency ? ms(ctx.outputLatency) : 'n/a';
}
setInterval(updateLatencyStats, 1000);

startBtn.addEventListener('click', startAudio);
hintSel.addEventListener('change', () => { if (engine.ctx) startAudio(); });

async function ensureAudio() {
  if (!engine.ctx) await startAudio();
}

// ---------- Touch → handler delay ----------

const touchDelays: number[] = [];
function noteTouchDelay(e: PointerEvent) {
  const d = performance.now() - e.timeStamp;
  if (d >= 0 && d < 500) {
    touchDelays.push(d);
    if (touchDelays.length > 30) touchDelays.shift();
    const avg = touchDelays.reduce((a, b) => a + b, 0) / touchDelays.length;
    $('s-touch').textContent = `${avg.toFixed(1)} ms`;
  }
}

// ---------- 1 · Pads ----------

document.querySelectorAll<HTMLButtonElement>('.pad').forEach((pad) => {
  pad.addEventListener('pointerdown', async (e) => {
    e.preventDefault();
    if (!engine.ctx) { await ensureAudio(); return; }
    // Trigger audio first, before any UI work.
    const r = pad.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const d = Math.hypot(x - r.width / 2, y - r.height / 2) / (Math.min(r.width, r.height) / 2);
    const vel = 1 - 0.65 * Math.min(1, d);
    engine.play(pad.dataset.sound as Sound, engine.now, vel);
    noteTouchDelay(e);

    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    pad.appendChild(dot);
    dot.animate(
      [{ transform: 'scale(1)', opacity: 0.9 }, { transform: `scale(${6 + vel * 10})`, opacity: 0 }],
      { duration: 380, easing: 'cubic-bezier(.2,.7,.3,1)' },
    ).onfinish = () => dot.remove();
  });
});

// ---------- 2 · Metronome + tap along ----------

class Metronome {
  bpm = 100;
  running = false;
  beats: number[] = [];
  private next = 0;
  private count = 0;
  private timer = 0;
  private flashTimers: number[] = [];

  start() {
    if (!engine.ctx) return;
    this.running = true;
    this.next = engine.now + 0.15;
    this.count = 0;
    this.beats = [];
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  stop() {
    this.running = false;
    clearInterval(this.timer);
    this.flashTimers.forEach(clearTimeout);
    this.flashTimers = [];
  }

  // Lookahead scheduler: always keep ~120 ms of clicks queued in the audio clock.
  private tick() {
    const ctx = engine.ctx!;
    while (this.next < ctx.currentTime + 0.12) {
      engine.click(this.next, this.count % 4 === 0);
      this.beats.push(this.next);
      if (this.beats.length > 64) this.beats.shift();
      // Visual beat, delayed to roughly when it's actually heard.
      const heardIn = (this.next - ctx.currentTime + (ctx.outputLatency || ctx.baseLatency)) * 1000;
      this.flashTimers.push(window.setTimeout(() => {
        tapEl.classList.add('beat');
        setTimeout(() => tapEl.classList.remove('beat'), 90);
      }, heardIn));
      if (this.flashTimers.length > 16) this.flashTimers.shift();
      this.next += 60 / this.bpm;
      this.count++;
    }
  }
}

const metro = new Metronome();
const metroBtn = $<HTMLButtonElement>('metro');
const tapEl = $<HTMLButtonElement>('tap');
const taps: number[] = [];

function setBpm(v: number) {
  metro.bpm = Math.max(60, Math.min(160, v));
  $('bpm').textContent = String(metro.bpm);
}
$('bpm-down').addEventListener('click', () => setBpm(metro.bpm - 5));
$('bpm-up').addEventListener('click', () => setBpm(metro.bpm + 5));

metroBtn.addEventListener('click', async () => {
  await ensureAudio();
  if (metro.running) {
    metro.stop();
    metroBtn.textContent = 'Start metronome';
    metroBtn.classList.remove('active');
  } else {
    metro.start();
    metroBtn.textContent = 'Stop metronome';
    metroBtn.classList.add('active');
  }
});

tapEl.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (!engine.ctx || !metro.running) return;
  noteTouchDelay(e);
  tapEl.classList.add('flash');
  setTimeout(() => tapEl.classList.remove('flash'), 70);

  // Audio-clock time of the touch, corrected for how long the event took to reach us.
  const t = engine.now - (performance.now() - e.timeStamp) / 1000;
  const period = 60 / metro.bpm;
  let best = Infinity;
  for (const b of metro.beats) if (Math.abs(t - b) < Math.abs(best)) best = t - b;
  if (Math.abs(best) > period / 2) return;
  taps.push(best);
  if (taps.length > 32) taps.shift();
  renderTaps();
});

function renderTaps() {
  $('tap-count').textContent = `${taps.length} TAPS`;
  // Skip the first couple of taps while you lock in.
  const use = taps.length > 4 ? taps.slice(2) : taps;
  if (use.length < 3) { $('t-mean').textContent = '–'; $('t-sd').textContent = '–'; return; }
  const mean = use.reduce((a, b) => a + b, 0) / use.length;
  const sd = Math.sqrt(use.reduce((a, b) => a + (b - mean) ** 2, 0) / use.length);
  $('t-mean').textContent = ms(mean);
  $('t-sd').textContent = ms(sd);
}

$('tap-reset').addEventListener('click', () => { taps.length = 0; renderTaps(); });

// ---------- 3 · Mic round trip ----------

let workletLoaded: AudioContext | null = null;

async function measureRoundTrip(): Promise<number[]> {
  const ctx = engine.ctx!;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  if (workletLoaded !== ctx) {
    await ctx.audioWorklet.addModule(`${import.meta.env.BASE_URL}recorder-worklet.js`);
    workletLoaded = ctx;
  }
  const src = ctx.createMediaStreamSource(stream);
  const rec = new AudioWorkletNode(ctx, 'recorder');
  const sink = ctx.createGain();
  sink.gain.value = 0;
  src.connect(rec).connect(sink).connect(ctx.destination);

  const chunks: { frame: number; data: Float32Array }[] = [];
  rec.port.onmessage = (e) => chunks.push(e.data);

  await sleep(500); // let the mic settle
  const t0 = ctx.currentTime + 0.5;
  const times = Array.from({ length: 6 }, (_, i) => t0 + i * 0.45);
  times.forEach((t) => engine.ping(t));
  await sleep((times[times.length - 1] - ctx.currentTime + 0.7) * 1000);

  src.disconnect();
  rec.disconnect();
  stream.getTracks().forEach((t) => t.stop());
  if (!chunks.length) throw new Error('No mic audio received');

  const sr = ctx.sampleRate;
  const start = chunks[0].frame;
  const total = chunks[chunks.length - 1].frame + chunks[chunks.length - 1].data.length - start;
  const buf = new Float32Array(total);
  for (const c of chunks) buf.set(c.data, c.frame - start);

  // Noise floor from the quiet stretch before the first ping.
  const quietEnd = Math.max(1, Math.min(buf.length, Math.round(t0 * sr) - start));
  let noise = 0;
  for (let i = 0; i < quietEnd; i++) noise += Math.abs(buf[i]);
  noise /= quietEnd;

  const results: number[] = [];
  for (const t of times) {
    const f = Math.round(t * sr) - start;
    const end = Math.min(buf.length, f + Math.round(0.4 * sr));
    if (f < 0 || f >= end) continue;
    let peak = 0;
    for (let i = f; i < end; i++) peak = Math.max(peak, Math.abs(buf[i]));
    if (peak < noise * 6 + 0.01) continue; // didn't hear it
    const thr = noise + (peak - noise) * 0.35;
    for (let i = f; i < end; i++) {
      if (Math.abs(buf[i]) > thr) { results.push((i - f) / sr); break; }
    }
  }
  return results;
}

const micBtn = $<HTMLButtonElement>('mic');
micBtn.addEventListener('click', async () => {
  await ensureAudio();
  metro.stop();
  metroBtn.textContent = 'Start metronome';
  metroBtn.classList.remove('active');
  micBtn.disabled = true;
  micBtn.textContent = 'Listening…';
  try {
    const r = await measureRoundTrip();
    if (!r.length) {
      $('m-mean').textContent = 'not heard';
      $('m-all').textContent = 'turn volume up';
    } else {
      const sorted = [...r].sort((a, b) => a - b);
      $('m-mean').textContent = ms(sorted[Math.floor(sorted.length / 2)]);
      $('m-all').textContent = r.map((x) => Math.round(x * 1000)).join(' · ');
    }
  } catch (err) {
    $('m-mean').textContent = 'error';
    $('m-all').textContent = (err as Error).message.slice(0, 40);
  } finally {
    micBtn.disabled = false;
    micBtn.textContent = 'Measure speaker → mic';
  }
});

function sleep(msec: number) {
  return new Promise((r) => setTimeout(r, msec));
}
