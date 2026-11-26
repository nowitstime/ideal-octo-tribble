# OCTO — Build plan

Everything from [IDEAS_FROM_POCKIMUSI.md](IDEAS_FROM_POCKIMUSI.md), put in order. Written 2026-11-26.

## How we work

- **Feel before features.** Every phase ends with a play test on the Pixel. The next phase doesn't start until the last one feels right. Pockimusi grew faster than it was played; this plan tries not to repeat that.
- **Small phases.** Each one is a branch and a build you can try on your phone the same day.
- **Rules for every touch control:**
  - No timer-based long-press. Use taps, toggles, drags and a second finger instead.
  - Everything recorded can be deleted, and everything can be undone.
  - Touch targets are big and forgiving, and land in tune.
  - The look stays pastel squares, strings and circle knobs: crisp, not sketchy.
- **A feedback file per screen** (copied from Pockimusi's `feedback/` setup): how it plays, questions to answer while playing, dated notes, Decided, Next. Set up in Phase 0, then filled in after each play test.

## Order at a glance

| # | Phase | Why it's here | Size |
| :-- | :-- | :-- | :-- |
| 0 | Foundations | The note format and saves need to change before features pile on top | S |
| 1 | No more loop slop | Your most repeated complaint in Pockimusi | M |
| 2 | Song chords | The heart of what you loved, and the fix for "songs sound alike" | L |
| 3 | Dance sounds | The fix for "everything sounds like boss music" | M |
| 4 | Drum performance | Repeat, flam, ratchet, variation, per-track grid and swing | M |
| 5 | Arp and lead | Built on what you liked most about Lead/Arp | M |
| 6 | Instrument slots, then new instruments one at a time | Dial, Breaks, Roller, Wobble | L |
| 7 | Workflow and clarity | Pattern slots, first-run hints, meters | M |
| 8 | Later | Song mode, expression, ornaments and more | — |

---

## Phase 0 · Foundations

The groundwork that later phases need. Nothing new to play.

- [ ] **Integer ticks.** Store note positions as whole ticks at 480 per quarter (120 per 1/16) instead of fractional 16th steps. Snapping, triplets, swing and bar changes then stay exact. Touches `state.ts`, `audio/transport.ts`, `ui/noteLane.ts` and every screen that writes notes.
- [ ] **Project format v2 with migration.** Add `version: 2`. Old saves are converted on load (step × 120 = tick). Keep the old storage key readable once.
- [ ] **Take id on every recorded note** (`take: number`). Unused until Phase 1, but it goes in now so saves don't need converting twice.
- [ ] **A note's own data stays musical.** Pitched notes keep storing a degree or chord tone (as now) so they can re-fit when chords change.
- [ ] **Tests.** Add Vitest for the pure logic: theory, tick snapping, swing, save migration. Run them with `npm test`.
- [ ] **`feedback/` folder:** one file per screen (map, drums, chords, bass, lead, progression) plus a README with a session log.

**Done when:** an old project loads unchanged, everything plays and records as before, and the tests pass.

---

## Phase 1 · No more loop slop

- [ ] **Takes per loop pass.** While recording, each full pass of the loop is a new take. Undo removes the last pass, not a time window. (The snapshot undo stays for edits like knobs and deletes.)
- [ ] **Pass lines.** Under each track on its page, thin stacked lines, one per take. Tap one to select it, tap ✕ to delete that pass. Mute a pass to compare.
- [ ] **Overdub / replace toggle** next to record: `+` adds; `↻` replaces whatever the track had wherever you play over it during the pass.
- [ ] **One-pass record** (`1×`): record exactly one loop, then stop recording on its own (playback carries on).
- [ ] **Count-in.** Record while stopped → one bar of clicks → recording starts on the 1. On/off in the transport.
- [ ] **The same clear everywhere.** Each instrument page and each string on the map gets the same clear control (tap, then confirm with a second tap on the same spot; no hold).

**Play test:** build a loop with five or more overdubs. Can you always get back to something good? Does replace feel natural?

---

## Phase 2 · Song chords

Today the progression is spread evenly across the loop (`chordDegreeAt`), and the chords track plays a copy of it. This phase makes a proper chord lane: the song's chords, which every follower reads.

- [ ] **Chord lane in the project:** `song.chords: { tick, degree, colour }[]` and `song.bars` (1, 2, 4, 8 or 16), **independent of the loop's bars**. A 2-bar groove can play over an 8-bar progression, so each pass of the loop hears different chords. A pass counter in the transport picks which part of the lane is heard.
- [ ] **Followers read the lane.** Bass (already by chord tone), chords track, arp, and a new **FOLLOW switch on the lead** (degrees over the chord: 1 root, 3 third, 5 fifth, 7 seventh, 8 octave; 2/4/6 walk the scale). Recorded lines re-fit when chords change.
- [ ] **Lane strip.** A thin row of chord boxes, shown above the ring on the map and on the progression page. Names on the strip (C, Am, F…), numerals (I, vi, IV…) where you pick chords.
- [ ] **Edit one chord.** Tap a box to select it, then pick a new chord, colour it, or ✕ to delete it. The same chord twice in a row joins into one long chord.
- [ ] **Grid for boxes:** 1/2, 1, 2 or 4 bars per box.
- [ ] **Stamp.** Pick a progression and stamp it from the selected box. "Use" today becomes stamp-from-the-start.
- [ ] **Borrowed chords:** add ♭VI, ♭VII and iv to the chord set (a second row on the chords page and on the circle).
- [ ] **More progressions:** POP, 50S, SAD POP, ROCK, JAZZ ii-V-I, ROYAL ROAD, DESCEND, MIXO, HEROIC, BITTERSWEET, CANON, BLUES 8 (merge with OCTO's current presets).
- [ ] **Colour radial.** Drag from a chord box (or column) in a direction: ↑ 7 · ↗ 9 · → add9 · ↖ 6 · ← sus4 · ↙ sus2 · ↓ dim · ↘ aug. Up = richer, down = tense, sides = sus. The chords page keeps its second-finger 7 / sus / add9.
- [ ] **Live change.** While playing, tap a chord on the progression page: it lands on the next box, drawn dashed, not saved unless recording.
- [ ] **SPICE:** `OFF` / `LIGHT` / `WILD`. On playback some plain chords get a random colour, new each pass; the lane itself doesn't change.

**Play test:** write an 8-bar progression with a 2-bar drum loop. Does it stop loops sounding alike? Is editing one chord quick?

---

## Phase 3 · Dance sounds

- [ ] **One shared preset pool.** Every pitched instrument can use any preset; its own group comes first. Groups: Bass, Lead, Pad, Pluck, Odd.
- [ ] **Preset flags:** `rings` (overlaps, re-strikes) vs `sustains` (held, mono, slurs). Used again in Phase 5.
- [ ] **Electronic presets:** Reese, DNB Sub, Neuro, Hoover, Supersaw, Stab, Atmos, Vox. Reese and DNB Sub first.
- [ ] **Pump.** Any kick ducks the other tracks: `OFF` / `LIGHT` / `MEDIUM` / `HARD` per pitched track. No kick in the loop → pump on every beat. Done with gain automation in `engine.ts`.
- [ ] **Drums sound real:** three variants of each snare, hat and clap, played in turn; soft hits filtered darker as well as quieter; closed hat cuts open hat.
- [ ] **New kits:** Jungle, Funk Breaks, Acoustic, Neuro, Liquid (synthesized).
- [ ] **Tempo up to 240** for D&B and jungle.

**Play test:** can you make something that sounds like jungle, D&B and pop in one session each?

---

## Phase 4 · Drum performance

- [ ] **Note repeat strip** on the drums page: 1/4, 1/8, 1/16 (and triplets on a triplet grid). Hold a pad with one finger and touch a rate with another: the pad rolls in time. Works while stopped, on its own timer from the touch.
- [ ] **Flam and ratchet.** Pad zones or a mode chip: left edge flam, right edge ratchet (three hits in a 1/16); top = accent, bottom = ghost, as velocity already does.
- [ ] **Variation:** `OFF` / `LIGHT` / `WILD`. Ghost hits get a 50% chance to play; light fills on the last beat.
- [ ] **Per-track grid and swing.** Each track has its own grid (1/4, 1/8, 1/16, 1/12T, free) and swing, applied at playback so it can change after recording. Moves swing out of the drums only.

**Play test:** does note repeat make fills easy? Are flam and ratchet musical, or novelties?

---

## Phase 5 · Arp and lead

- [ ] **×2 with a second finger** anywhere on the lead field while the arp runs. Two speeds only.
- [ ] **1/4 rate** at the bottom of the orb's speed range.
- [ ] **Chaos:** `OFF` / `LOW` / `MED` / `HIGH` share of steps that play a random chord or scale tone, skip, or jump an octave.
- [ ] **Double:** each arp step plays twice (ratchet).
- [ ] **New patterns:** octave, pedal, up 2 octaves, random in chord.
- [ ] **Pattern sets** on the arp's settings page: `CLASSIC`, `CHORD + SCALE`, `DANCE`, `WILD`. The set decides which patterns circling the orb walks through.
- [ ] **Notes and arps on one page.** One finger on the field plays a held note with glide; the orb starts from its own zone. No mode switch between them.
- [ ] **Re-strike vs slur from the preset flag:** ringing presets re-strike on each new band, sustaining ones slur. A row can override it.

**Play test:** does mixing held notes with arps feel as good as in Pockimusi? Do chaos and double add life without turning to mush?

---

## Phase 6 · Instrument slots, then new instruments

First the slot system, then one new instrument at a time, each with its own play test before the next.

- [ ] **6a · Swappable slots.** Each of the four squares on the map holds an instrument; tap its name on the instrument page to swap (with a preview and undo). Instrument and sound stay separate. Notes carry over where they can (e.g. lead ↔ dial keep degrees).
- [ ] **6b · Dial** (lead): a ring of eight scale degrees. Drag round = slur, lift and tap = new note, keep going round = up an octave. FOLLOW turns positions into chord degrees.
- [ ] **6c · Breaks** (rhythm): classic breaks as patterns, eight slices in a ring. Tap a slice to jump at the next 1/8; stutter, reverse and choke buttons; half / double time. Transcriptions come from Pockimusi's `breaks.lua`, checked by ear.
- [ ] **6d · Roller** (bass): the bass string repeats on the grid while touched (1/16, 1/8, 1/8T, rolling accents) instead of sustaining. Slide to change the next note.
- [ ] **6e · Wobble** (bass): a real low-pass (Web Audio) moving at a rate locked to the beat, picked from a ring (1 bar … 1/16T).

**Play test for each:** does it pull you towards a style no other instrument does? If not, it doesn't stay.

---

## Phase 7 · Workflow and clarity

- [ ] **Pattern slots A–H** along the edge of the map. Tap to switch at the end of the loop; copy one slot into another.
- [ ] **First-run hints:** one line that walks through play → record → add another instrument, then disappears.
- [ ] **Clarity pass:** one bright highlight per screen on the next thing to press; the first screen of each page holds only the two or three things used most; the rest on Settings.
- [ ] **Meters** on the map's strings (Web Audio `AnalyserNode`).
- [ ] **Master filter punch-in** on the transport: touch to close it, let go to open.
- [ ] **Test unwatched:** hand it to someone with one sentence ("it's a looper, make a beat"), leave for 5–10 minutes, note what they never found.

---

## Phase 8 · Later

Not scheduled. Each one moves up once it's decided.

- Scenes and song mode: a song as a recording of slot switches and mutes, with a block strip for repairs.
- Shared expression: delayed vibrato, bend into, fall-off, swell, articulation per note.
- Ornaments: a swipe into a lead band adds a 3-note run, grace note or trill.
- Voice leading on the chords track (nearest inversion).
- Approach notes on the bass (a note leading into the next chord).
- Recordable punch-in effects.
- A build: note repeat speeding up over a bar.
- Wanted sounds: brass, bowed strings, electric guitar clean and muted, organ, air pad, sine "singing" lead, vocal ooh, more percussion.
- `.wav` export (Web Audio can render offline).

---

## Decisions to make along the way

1. **Phase 2:** is the chords *track* still needed once the lane exists, or does it become "play the lane's chords with a rhythm"? (In Pockimusi the separate chord track got folded into the lane.)
2. **Phase 2:** maximum lane length: 8 or 16 bars?
3. **Phase 4:** flam/ratchet as pad zones or as a mode chip?
4. **Phase 6:** is Dial a fifth slot option for the lead square, or a mode of the lead page?
5. **Phase 7:** pattern slots before or after the new instruments? (Moving them earlier is easy if you want them sooner.)
