# FlowTask Prototype and Offline AI Starter

## FlowTask web prototype

This repository includes a responsive FlowTask productivity-app prototype built
with Vite, React, TypeScript, and Tailwind CSS. Its browser state is saved
locally for the current browser profile. Select the FlowTask logo to open the
illustrated feature infographic. Open the **Weekly** tab and choose **Play** to
try the keyboard- and touch-controlled Three.js cat runner. The desktop preview
uses an iPhone-proportioned 402 × 874 frame; on mobile it fills the viewport.

```bash
npm run dev
npm run build
```

The Vite app is served at `http://localhost:5173` by default.

An Android-first Expo chatbot with on-device Gemma 4 E2B, cloud Gemini, and
local SQLite conversation storage. The Android app uses native modules, so run
it in a development build; Expo Go is not supported.

## Documentation

See **[docs/README.md](docs/README.md)** for the documentation index.

- [Student setup and project guide](docs/GUIDE.md)
- [Architecture and data flow](docs/ARCHITECTURE.md)
- [Local AI, attachments, and device requirements](docs/LOCAL-AI.md)
- [Cloud Gemini provider and fallback](docs/CLOUD-AI.md)
- [Android hardware detector module](docs/LOCAL-DEVICE.md)
- [Full project overview](docs/PROJECT-OVERVIEW.md)

## Quick start

Install packages, then run the Android development build on an ARM phone:

```bash
SKIP_IOS_FRAMEWORK_DOWNLOAD=1 npm install
npx expo run:android
```

For the Expo tunnel, install a development APK first, then run:

```bash
npx expo start --dev-client --tunnel
```

The local Gemma model is downloaded separately from Chat settings. Setup,
cloud build and device requirements are in the [student guide](docs/GUIDE.md).
