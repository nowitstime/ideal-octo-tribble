# Things to steal from Pockimusi

Pockimusi is the button-only looper for the RG35XX handheld (LÖVE/Lua). It went through about a dozen build phases and a few logged play sessions, so its docs hold a lot of tested thinking. This file pulls out what should carry over to OCTO's touch screen, and what you thought while playing it.

Sources: `pockimusi/feedback/*.md` (session notes), `FUTURE_PLANS.md` §2 ("what playing has shown"), `SPEC.md`, `MUSICAL_PARTS.md`, `FUTURE_INSTRUMENTS.md`, `PHASE_K.md`, `PHASE_L.md`. Written 2026-11-26.

Legend: ⭐ steal soon · 🧪 worth a prototype · 💤 later · ✅ OCTO already has some form of it

---

## 1. Your general sentiment (from playing Pockimusi)

### What you loved

- **The chord mechanic** was a favourite from the start. Picking chords and having everything else follow them was the heart of it.
- **Dial** was the most fun instrument: rolling a thumb round the scale. It had one clear gesture that felt like *playing*, not operating a control.
- **Lead / Arp** was the easiest to get going and the richest musically: single held notes with glide mixed in between arps. ×2 speed on a combo was "the move". Two speeds were enough; you didn't want more.
- **Chord-follow** worked well. FOLLOW on the arp "just worked" across chord changes.
- **Stamping a progression** made chords easy, and seeing chord names on the timeline helped.
- **Hand Drums** "felt nice". Two thumbs on drums was immediately pleasant.
- Simple, low-step setups: the most fun Pockimusi setup was a laptop with an Xbox controller, meaning big controls, big screen, good speakers.

### What bugged you

- **Loop slop.** Overdub after overdub and the loop "goes crazy". It came up in every session. Easily the most repeated worry.
- **Everything sounded like video-game boss music.** You wanted jungle, D&B and pop to be reachable. (Phase L, the electronic pass, was the answer: reese/sub patches, breaks, roller, wobble, pump.)
- **Songs came out sounding alike.** You weren't sure how to structure chords in a 2- or 3-bar loop.
- **Too many features, not enough focus.** The early, simpler version with one bright colour and a couple of options was easier to read. Pages needed stripping back.
- **Every instrument page looked the same,** and "every instrument works the same" didn't always suit the instrument.
- **Confusing wording and buttons** (NEXT / TOP on the chord track; BACK on `Y`; stamping starting in the next slot; greyed-out preview boxes). You wanted a **delete** button.
- **Sounds that didn't fit the instrument:** Valves needed real brass; Dial's moves went quiet on fading sounds (it wanted a re-strike, not only a glide).
- Other people played a note within a second but **had to ask how to record**. The gap was the step after the first note.

### Principles you settled on

- Each instrument needs a **musical purpose and to be fun**, both at once. Different ways of playing should pull you towards different styles. Several leads with different feels is on purpose.
- **Instrument ≠ sound.** How you play and what comes out are chosen separately.
- **Hard to play a wrong note.** Play degrees/chord tones, not raw pitches.
- **The first minute must work alone.** Depth is fine (Ableton is loved and not obvious); getting lost at the start isn't.
- **Workflow first, sound polish later.**

These match what you've already said about OCTO: deletable, no long-press, forgiving and responsive, minimal and elegant.

---

## 2. Things to steal

### Fixing loop slop (your biggest Pockimusi complaint)

| Idea | In Pockimusi | On OCTO's touch screen |
| :-- | :-- | :-- |
| ⭐ **Takes split per loop pass** | While recording, every full loop pass becomes its own take, so undo removes one pass, not the whole session | Tag each recorded note with a take id. Undo pops the last pass. Show passes as stacked thin lines under the track so you can tap one to delete it |
| ⭐ **Replace vs overdub** | Wanted, never built (no free button) | A small toggle beside record: `+` overdub / `↻` replace. Replace clears the track's notes in the region you play over |
| ⭐ **Auto-stop after one pass** | Wanted, never built | A "1×" record option: records exactly one loop, then stops. Stops the "play too much" pile-up |
| 🧪 **Per-track clear and erase** | Undo, erase, clear per track | ✅ partly (drum lane clearing). Make it the same on every track: a visible clear on each instrument page and on its string on the map |
| ⭐ **Count-in** | One bar count-in before recording | Tap record while stopped → one bar of clicks → recording starts on the 1 |

### Chords and harmony

| Idea | In Pockimusi | On OCTO |
| :-- | :-- | :-- |
| ⭐ **A chord lane separate from playing chords** ("track C") | A silent lane outside the four tracks that *only* sets the song's chords; the Chord Harp then plays heard chords without steering anyone. Can be longer than the loop (2–16 bars), so a 2-bar groove can sit over a 4- or 8-bar progression | OCTO's progression already threads into the loop map. Make it the real chord source with its own length, independent of the loop's bars. That directly answers "songs sound alike in a 2-bar loop" |
| ⭐ **Stamp + edit single chords** | Pick a progression, stamp it across the lane, then recolour or delete single boxes | ✅ "Use" refills the chords. Add: tap a chord box on the progression strip to change, colour or delete just that one |
| ⭐ **Numerals in the middle, names on the timeline** | Session 3: you enter by numerals, so show numerals where you pick; names on the tape deck | Show I–vi on the chord columns and the circle; chord names on the loop ring |
| ⭐ **Colour wheel for one chord** | Hold `A` + direction: ↑ 7 · ↗ 9 · → add9 · ↖ 6 · ← sus4 · ↙ sus2 · ↓ dim · ↘ aug. "Up richer, down tense, sides sus" | ✅ partly (7 / sus / add9 by second finger). Add dim, aug, 6, 9 and use the same up = richer, down = tense layout as a radial when you drag on a chord box |
| 🧪 **SPICE** | `OFF` / `LIGHT` / `WILD`: on playback some plain chords get a random colour, new each pass; followers play the coloured chord too; the recording doesn't change | A three-way switch on the progression page. Your "randomly augmented" idea from session 3 |
| ⭐ **Progression list** | POP, 50S, SAD POP, ROCK, JAZZ ii-V-I, ROYAL ROAD, DESCEND, MIXO, HEROIC (♭VI ♭VII I), BITTERSWEET (I IV iv I), CANON, BLUES 8 | Compare with OCTO's presets and add the missing ones. Needs borrowed chords (♭VI, ♭VII, iv) in OCTO's chord set |
| ⭐ **Borrowed chords** | Nine chords: I ii iii IV V vi plus ♭VI ♭VII iv | Add ♭VI, ♭VII and iv as extra columns (or a second row) on the chords page. They're behind HEROIC, MIXO and BITTERSWEET |
| ⭐ **Follow by degree, re-harmonise recordings** | Notes store their degree; changing chords later re-fits lines already recorded. FOLLOW on/off per track | ✅ bass does this by chord tone. Give the lead a FOLLOW switch too (degrees over the chord, Bass's rule: 1 root, 3 third, 5 fifth, 7 seventh, 8 octave; 2/4/6 walk the scale) |
| 🧪 **Live chord change without recording** | Change chords live on the bar line; followers play it for one box, nothing written (dashed box) | Tap a chord on the progression while playing: it lands on the next bar, shown dashed, not saved. Great for jamming |
| 💤 **Voice leading** | Choose the inversion nearest the last chord | Automatic inversion picking for the chords track, a "smooth" switch |

### Lead and arp

| Idea | In Pockimusi | On OCTO |
| :-- | :-- | :-- |
| ⭐ **×2 rate as the main move** | `L1 + R1` held = arp ×2. "1× and 2× is enough" | A second finger anywhere on the lead field = ×2 while held (no long-press: it's a two-finger hold, not a timer) |
| ⭐ **`1/4` arp rate** | Wanted, since ×2 covers the next one up | Make sure the orb's slowest height reaches 1/4 |
| ✅ **Gate** | Wanted a `GATE` row (short / normal / legato) | Already a Gate knob on the arp |
| ⭐ **Chaos** (from the MiniFreak) | `OFF` / `LOW` / `MED` / `HIGH` share of steps that pick a random chord/scale tone, skip, or jump an octave. Low levels still sound like the pattern | A four-step knob on the arp settings page |
| ⭐ **Double / ratchet** (from the MiniFreak) | Each arp step plays twice | A toggle on the arp settings page |
| 🧪 **Pattern sets** | Ready-made sets of patterns per button (`CLASSIC`, `CHORD + SCALE`, `DANCE`: octave / pedal / up 2 oct, `WILD`) so you don't build every combination | OCTO picks pattern by circling the orb. A set switch on the settings page could decide which patterns the circle walks through. Add `OCTAVE` and `PEDAL` patterns |
| ⭐ **Mix single notes with arps** | `B` single held note with glide, between arps, was what made it rich | Keep single notes and arp on the same page instead of a mode switch, e.g. one finger = note, orb from a separate zone or a two-finger tap |
| 🧪 **Re-strike vs slur** | Dial's quiet-roll problem: sliding to a new note on a fading sound goes silent. Fix: `GLIDE` / `BEND` / `NEW NOTE`, with a default per sound (plucks re-strike, pads slur) | OCTO's lead field glides on fast moves. Add a per-preset default: pluck/bells re-strike on each new band, glass/saw/flute slur |
| 🧪 **Dial as a touch instrument** | Your favourite: the scale as a circle under the thumb; roll = slur, lift and press = new note, carry past the top = next octave | A ring of 8 scale degrees. Drag round = slur, tap = new note, keep going round = up an octave. Fits the circle-and-strings look perfectly |
| 💤 **Shared expression toolkit** | Built once, used by every melodic instrument: articulation per note, delayed vibrato, bend into, fall-off, swell | OCTO has bends recorded; add delayed vibrato and fall-off as per-note flags next |
| 💤 **Motions / ornaments** | A quick gesture before a note adds a run, grace note or trill landing on that note | A swipe into a band adds a 3-note run up/down into it. Risky (false triggers) but possibly the most fun |

### Drums and rhythm

| Idea | In Pockimusi | On OCTO |
| :-- | :-- | :-- |
| ⭐ **Note repeat locked to the grid, works while stopped** | Shoulders = repeat at 1/4, 1/8, 1/16 (triplet grid aware). You flagged it must also repeat with the transport stopped | A repeat strip on the drums page: hold a pad with a second finger on 1/8 or 1/16 and it rolls in time; runs on its own timer when stopped |
| ⭐ **Accent / ghost / flam / ratchet** | D-pad as two axes: ↑ accent, ↓ ghost, ← flam, → ratchet (3 hits in a 1/16), diagonals combine | ✅ velocity from where you hit. Add flam and ratchet as zones on each pad (e.g. left edge flam, right edge ratchet) or as a mode chip |
| ⭐ **Closed hat chokes open hat** | Built in | Check OCTO's kits do this; it's a big realism win for little code |
| 🧪 **Variation** | `OFF` / `LIGHT` / `WILD`: ghost hits get a 50% chance to play, fills on the last beat | Per-note chance; a Variation switch on the drums settings page |
| ⭐ **Round-robin + darker soft hits** | Snares, hats, claps rendered three times and cycled; soft hits low-passed, not just quieter | Generate 3 variants per synthesized hit; filter by velocity. Cheap in Web Audio |
| 🧪 **Breaks** | Famous breaks sliced into 8; pick a slice by direction, jump at the next 1/8; stutter, reverse, choke; half/double time; a snare roll into the bar line | A Breaks instrument: 8 slices in a ring, tap to jump. Directly answers "I want jungle / D&B". Needs breaks transcribed as patterns (Pockimusi's `src/breaks.lua` has them) |
| 🧪 **Two-hand drums** | Hand Drums: the same pads reachable by both thumbs for rolls and interlocking | On touch this is nearly free: make sure two fingers can roll the same pad cleanly and pads are big |
| 💤 **A build** | Repeat rate rising over a bar into the next loop | A riser gesture on the repeat strip |

### Bass

| Idea | In Pockimusi | On OCTO |
| :-- | :-- | :-- |
| 🧪 **Roller** (pitched note repeat) | Hold a note and it repeats on the grid (1/16, 1/8, 1/8T, 1/16 with off-beats accented); move to change the next repeat's note. Rolling D&B bass at 174 | A repeat toggle on the bass string: touching the string rolls at the chosen rate instead of sustaining |
| 🧪 **Wobble** | Pick a wobble rate locked to the beat (1 bar … 1/16T), the bass "talks" | A rate ring on the bass settings, or the bend strip's other axis as wobble rate. Web Audio's real filter makes this easier than on LÖVE |
| 💤 **Approach notes** | A note that leads into the next chord on beat 4 | An "approach" zone at the end of the string |

### Sound and mix

| Idea | In Pockimusi | On OCTO |
| :-- | :-- | :-- |
| ⭐ **Pump (sidechain)** | Any kick restarts a per-track duck; `OFF` / `LIGHT` / `MEDIUM` / `HARD`; no kick in the loop = pump on every beat | Easy with Web Audio gain automation. A Pump knob per pitched track. Instantly sounds more like dance music |
| ⭐ **Patches grouped by part** | `BASS`, `LEAD`, `PAD`, `PLUCK`, `ODD`; each instrument's list shows its own group first but can use the whole pool | Let any preset be used on any pitched instrument, own group first |
| ⭐ **Electronic patch wave** | `REESE`, `DNB SUB`, `NEURO`, `HOOVER`, `SUPERSAW`, `STAB`, `ATMOS`, `VOX` | Add these to OCTO's presets; reese + DNB sub first |
| ⭐ **A patch says how it behaves** | `rings` (overlaps) vs `sustains` (held, mono) | Per-preset flag that also drives re-strike vs slur |
| 🧪 **Master low-pass punch-in** | Hold to close a master filter, release opens | A finger-held filter pad on the transport. Make punch-ins recordable later |
| 🧪 **Meters** | Per-track meters on the lanes and mix page | Real `AnalyserNode` meters on the map's strings |
| 💤 **Wanted sounds** | Brass (trumpet, horn section, muted), bowed strings, electric guitar clean/muted, organ, air pad, sine "singing" lead, vocal ooh, more percussion | A wish list for future presets |

### Structure and workflow

| Idea | In Pockimusi | On OCTO |
| :-- | :-- | :-- |
| ⭐ **Pattern slots A–H** | A menu with eight saved pattern slots | Eight slots on the map (squares along an edge). Tap to switch at the loop end; copy to another slot |
| 💤 **Scenes and song mode** | Scenes A–H; copy A to B then change one thing; switches queue to the loop end; "the song is a recording of switching" (scenes + mutes), with a block strip for repairs | Later: record a performance of slot switches and mutes as the song |
| ⭐ **Instrument ≠ sound, swappable slots** | Swap the instrument in a track slot with preview, applied on release, undoable; notes carry over where they can | Let a track switch between e.g. Lead field and Dial while keeping notes |
| 🧪 **Per-track grid and swing** | Each track has its own quantize grid (1/4, 1/8, 1/16, 1/12T, free) and swing, applied at playback so it can change after recording | OCTO has one quantize and drum swing. Per-track grid + swing at playback time |
| ⭐ **Store notes on a fine tick grid** | 480 PPQN integer ticks; snapping, triplets, swing and 2↔4 bar changes stay exact | OCTO stores fractional 16th steps. Worth moving to integer ticks before adding triplets/swing everywhere |
| ⭐ **First-run prompts** | "Tap record" until the first take lands, then the next step, then nothing | A single hint line that walks: play → record → add another instrument |
| 🧪 **Clarity rules** | One bright highlight per screen on the next thing to press; first screen holds only the 2–3 things changed most | Apply to every OCTO page; settings pages hold the rest |
| 💤 **Test it unwatched** | Hand it over with one sentence ("it's a looper, make a beat"), leave 5–10 minutes, note what was never found | Do this with OCTO on someone else's phone |
| ⭐ **The feedback system itself** | One file per instrument: how it plays, questions to answer while playing, dated session notes, Decided, Next | Copy `pockimusi/feedback/` structure for OCTO: one file per screen with questions |

---

## 3. Don't steal

- **Anything built around holding buttons.** Pockimusi leans on holds (hold `SELECT`, hold `X` for the wheel, hold `L2` to punch in). On OCTO a hold is a long-press, which vibrates the phone. Turn every hold into a tap toggle, a second finger, or a drag.
- **"Same grammar on every track."** It was a founding rule and later felt wrong ("doesn't always suit the instrument"). On touch, let each instrument have the surface it needs.
- **The sheer number of instruments.** Thirteen instruments outran the time to play-test them. Add one, play it properly, then the next.
- **Workarounds for LÖVE's limits** (pre-rendered samples, 60 Hz envelopes, faked meters, no resonant filter). Web Audio does these natively.
- **Valves' fingering chart.** Liked as an idea, but it's a puzzle mapped to four buttons. Not a touch idea.
