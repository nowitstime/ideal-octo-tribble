# OCTO

A touch-first loop maker for the phone, built as a PWA (Vite + TypeScript + Web Audio).

## Current stage: latency lab

Before building the instruments we check whether web audio on Android is fast enough to play live:

1. **Pads**: finger-drum and judge by feel. Velocity comes from where you hit (centre = louder).
2. **Tap along**: tap with a metronome. The result is the offset the app will use to line up recorded notes.
3. **Mic round trip**: plays clicks through the speaker and listens with the mic to measure the real delay.

## Run locally

```sh
npm install
npm run dev      # served on your LAN; mic test needs HTTPS or localhost
npm run build
```

## Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on push.
One-time setup: repo **Settings → Pages → Source: GitHub Actions**.
