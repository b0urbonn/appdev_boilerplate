# Maalam

An Android-first Expo app that detects deepfakes and harmful content. Attach an
image for a manipulation scan, or submit text and voice clips to flag hate
speech, threats, scams and more. Verdicts come from on-device Gemma 4 E2B or
cloud Gemini, with local SQLite storage. The Android app uses native modules,
so run it in a development build; Expo Go is not supported.

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

The local Gemma model is downloaded separately from Detector settings. Setup,
cloud build and device requirements are in the [student guide](docs/GUIDE.md).
