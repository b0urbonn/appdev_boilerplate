# AGENTS

Android-only Expo (SDK 57) offline-first chatbot. No Expo Go — native
modules require a development build.

## Verification commands

```bash
npx tsc --noEmit                                    # typecheck
npx expo lint                                       # eslint (eslint-config-expo)
npx expo-doctor                                     # dependency/config health
npx expo prebuild --platform android --clean        # regenerate android/
cd android && ./gradlew assembleDebug               # build debug APK
./gradlew assembleRelease                           # release APK (debug-signed)
# faster local build (ARM only, matches LiteRT-LM): add -PreactNativeArchitectures=arm64-v8a
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`,
release: `android/app/build/outputs/apk/release/app-release.apk`
(debug-keystore signed — sideload only; Play needs a real upload key)

## Environment used for the native build

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17       # brew openjdk@17
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools  # brew android-commandlinetools
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
export SKIP_IOS_FRAMEWORK_DOWNLOAD=1                # for npm install (litert-lm postinstall)
```

## Notes

- Routes live in `src/app/` (expo-router). First launch goes through
  `src/app/onboarding.tsx`; the gate is `Stack.Protected` in `src/app/_layout.tsx`.

- `android/` is generated (CNG) — never edit by hand; configure via
  `app.json` plugins.
- `react-native-litert-lm` postinstall downloads iOS frameworks; set
  `SKIP_IOS_FRAMEWORK_DOWNLOAD=1` for Android-only installs.
- The `android/` and `ios/` dirs are gitignored.

- `demo-video/` is a standalone Remotion project (own package.json) that
  renders the promo video in two lengths × two orientations:
  `npm run render:all` → 81s `maalam-demo-landscape.mp4` (1920×1080) +
  `maalam-demo-portrait.mp4` (1080×1920); `npm run render:60` → 60s
  `maalam-demo-1min-*.mp4` pair (`npm run studio` to preview). Narration is
  edge-tts in `public/audio/` (`public/audio/1min/` for the 60s cut, +15%
  rate); scene timing lives in `src/script.ts` (81s) and `src/script60.ts`
  (60s). Scenes adapt via `usePortrait()` in `src/theme.ts`. It is
  excluded from root `tsconfig`/eslint.
