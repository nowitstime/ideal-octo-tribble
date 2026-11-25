# OCTO

A touch-first loop maker for the phone, built as a PWA (Vite + TypeScript + Web Audio).

## What's in it

- **Loop map** (home): the loop is a ring; instruments hang off it on strings and the chord progression threads in from above. Tempo (drag the number), 1/2/4 bars, quantize, metronome click, play/record.
- **Drums**: 16 synthesized pads (velocity from where you hit), a bead lane to edit the selected pad's steps, and per-pad tune/decay/level, swing and lane clearing in Settings.
- **Chords**: one column per chord in the key. Slide up for brighter voicings, hold 7 / sus / add9 with another finger, drag across the strum strip. Columns mark the chord the progression is on.
- **Progression**: pick a key (circle of fifths), major/minor and a preset; the progression is drawn as a shape on the circle of chords. "Use" refills the chords track.
- Recording overdubs into the loop, corrected for touch and output latency and snapped to 1/16 when quantize is on. The project autosaves locally.

The latency test lives at `lab.html`.

## Run locally

```sh
npm install
npm run dev      # served on your LAN; mic test needs HTTPS or localhost
npm run build
```

## Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on push.
One-time setup: repo **Settings → Pages → Source: GitHub Actions**.
