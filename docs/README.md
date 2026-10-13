# Project documentation

Use this page to find setup steps and technical references for Offline AI
Starter.

## Start here

- [Student guide](GUIDE.md): requirements, computer setup, Android builds,
  first launch, renaming, extension checklist, useful commands and
  troubleshooting.
- [Full project overview](PROJECT-OVERVIEW.md): features, navigation,
  onboarding, settings, offline flow and extension examples.

## Technical references

- [Architecture and data flow](ARCHITECTURE.md): screen routing, providers,
  persistence, backup, chat streaming and context handling.
- [Local AI](LOCAL-AI.md): Gemma 4 E2B setup, model lifecycle, hardware choices,
  local image and voice input, RAM and troubleshooting.
- [Cloud AI](CLOUD-AI.md): Gemini REST/SSE integration, model selection,
  attachment routing, adaptive quota fallback and API-key storage.
- [Android local-device module](LOCAL-DEVICE.md): RAM/storage probes, NNAPI and
  OpenCL detection, native audio conversion and module build notes.

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
