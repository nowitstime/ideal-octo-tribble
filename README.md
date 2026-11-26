# OCTO

A touch-first loop maker for the phone, built as a PWA (Vite + TypeScript + Web Audio).

## What's in it

- **Loop map** (home): the loop is a ring; instruments hang off it on strings and the chord progression threads in from above. Tempo (drag the number), 1/2/4 bars, quantize, metronome click, play/record.
- **Drums**: 16 synthesized pads (velocity from where you hit), a bead lane to edit the selected pad's steps, and per-pad tune/decay/level, swing and lane clearing in Settings.
- **Chords**: one column per chord in the key. Slide up for brighter voicings, hold 7 / sus / add9 with another finger, drag across the strum strip. Columns mark the chord the progression is on.
- **Bass**: one string split into chord-tone zones (root, 3rd, 5th, 7th, octave) that retune to whatever chord is playing. Slide along it to glide, pull it off its line to bend.
- **Lead**: a field of scale-note bands (pitch left to right, brightness up), magnetic so slow moves land in tune and fast moves glide. **Arp** mode: touch to spawn an orb that arpeggiates the current chord in time with the loop; height sets speed, a second finger circling the orb picks the pattern.
- **Bend strip** on the bass and lead pages: a spring-back pitch wheel for the other hand. Recorded notes keep their bends.
- **Sounds**: drum kits (Pulse, Acoustic-ish, Lo-fi, Minimal, Big room) and presets for chords (pad, keys, pluck, organ, strings, bells), bass (sub, round, acid, fuzz) and lead (glass, saw, square, flute), all synthesized.
- **Progression**: pick a key (circle of fifths), major/minor and a preset; the progression is drawn as a shape on the circle of chords. "Use" refills the chords track.
- Recording into the loop, corrected for touch and output latency and snapped to 1/16 when quantize is on. Each loop pass you record is its own **take**: undo removes the last pass, and **pass lines** under each track let you mute a pass to compare or delete it. Record options in the transport: `+` overdub / `↻` replace (clears what you play over), `1×` (record one loop, then stop recording), and a one-bar **count-in** when recording from stopped.
- **Clear** is the same everywhere: the ✕ on each instrument page and on each string on the map. Tap it, then tap again to confirm. The project autosaves locally.

The latency test lives at `lab.html`.

## Run locally

```sh
npm install
npm run dev      # served on your LAN; mic test needs HTTPS or localhost
npm run build
npm test         # Vitest: theory, ticks, swing, save migration
```

Note positions are stored as whole ticks (480 per quarter, see `src/ticks.ts`). Saves carry a `version`; older ones are converted on load (`migrate` in `src/project.ts`).

Play-test notes live in [`feedback/`](feedback/README.md), one file per screen.

## Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on push.
One-time setup: repo **Settings → Pages → Source: GitHub Actions**.
