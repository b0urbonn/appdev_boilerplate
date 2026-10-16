# Project documentation

Use this page to find setup steps and technical references for **Maalam** —
an Android-first, offline-first detector for deepfakes and harmful content
(image/text/voice scans, verdict reports, protected-app monitoring, offline
lessons, and an assistant chat).

## Start here

- [Student guide](GUIDE.md): requirements, computer setup, Android builds
  (dev client and release APK), first launch, renaming, extension checklist,
  useful commands and troubleshooting.
- [Full project overview](PROJECT-OVERVIEW.md): features (scan, verdicts,
  monitor, learn, history, chat), navigation, onboarding, settings, offline
  flow and extension examples.

## Technical references

- [Architecture and data flow](ARCHITECTURE.md): screen routing, providers,
  persistence, backup, chat streaming and context handling.
- [Local AI](LOCAL-AI.md): Gemma 4 E2B setup, model lifecycle, hardware choices,
  local image and voice input, RAM and troubleshooting.
- [Cloud AI](CLOUD-AI.md): Gemini REST/SSE integration, model selection,
  attachment routing, adaptive quota fallback and API-key storage.
- [Android local-device module](LOCAL-DEVICE.md): RAM/storage probes, NNAPI and
  OpenCL detection, native audio conversion and module build notes.
- The `modules/app-monitor/` native module (foreground capture +
  `MaalamScanTaskService` headless analysis) powers protected-app
  monitoring; its JS bridge lives in `src/monitor/`.
- `demo-video/` is a standalone Remotion project that renders the promo
  video (`npm run render:all` for the 81s landscape+portrait pair,
  `npm run render:60` for the 60s pair).

## Project conventions

- App routes are in `src/app/` and use Expo Router.
- Android native configuration comes from `app.json` and the local Expo module;
  the generated `android/` folder is ignored.
- Keep API keys out of source control. Gemini keys are saved with Android
  SecureStore and are excluded from backups.
- Add SQLite schema changes as new ordered migrations in `src/db/client.ts`;
  don't edit an already released migration.
- Check code changes with `npx tsc --noEmit`, `npx expo lint`, and
  `npx expo-doctor`. Native Android builds are listed in the [guide](GUIDE.md).
