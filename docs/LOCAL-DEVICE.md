# Android local-device module

`modules/local-ai-device/` is an Expo native module used by the local AI
hardware status screen and local model planner. The generated project consumes
it from source; do not edit the generated `android/` directory by hand.

## What it reports

- Device model, SoC name, Android API, and current process ABI.
- Physical total RAM and current available RAM from Android's `ActivityManager`.
- Free storage from the app's private files directory.
- Physical NPU evidence from Android NNAPI device enumeration, a Qualcomm HTP
  driver, or the verified Snapdragon SM8550 chip signature.
- GPU availability by loading OpenCL and finding an available GPU device.

Physical hardware detection does not assert that LiteRT can use that hardware
for this particular model. LiteRT selects its backend and can fall back when a
backend is unavailable. Available RAM is refreshed for display; compatibility
estimates use total physical RAM.

## Native image and audio inputs

The module also exposes `prepareAudio(uri)`. It accepts a recording saved under
this app's files or cache directory and converts it to mono 16 kHz PCM WAV with
Android `MediaExtractor` and `MediaCodec`. It returns a temporary private path;
JavaScript deletes the WAV after local inference. The original attachment is
kept for chat playback.

## Build integration

- Expo module metadata: `modules/local-ai-device/expo-module.config.json`.
- Android setup and CMake: `modules/local-ai-device/android/build.gradle` and
  `src/main/cpp/`.
- Kotlin module: `src/main/java/expo/modules/localaidevice/`.
- App registration: CNG discovers the module; `app.json` sets the Android API
  level. `modules/**/android/build`, `.cxx`, and `.gradle` outputs are ignored.

For an Android development build, follow the native setup commands in the
[student guide](GUIDE.md). The project uses Android API 26 as its minimum.

## Platform references

- [Android Neural Networks API](https://developer.android.com/ndk/reference/group/neural-networks)
- [Expo local modules](https://docs.expo.dev/more/create-expo-module/)
- [Snapdragon 8 Gen 2 platform](https://www.qualcomm.com/smartphones/products/8-series/snapdragon-8-gen-2-mobile-platform)
