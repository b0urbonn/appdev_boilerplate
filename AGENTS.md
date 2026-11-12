# AGENTS

Android-only Expo (SDK 57) offline-first chatbot. No Expo Go — native
modules require a development build.

## Verification commands

```bash
npx tsc --noEmit                                    # typecheck
npx expo lint                                       # eslint (eslint-config-expo)
npx expo-doctor                                     # dependency/config health
npx expo prebuild --platform android --clean        # regenerate android/
cd android && ./gradlew assembleDebug               # build APK
# faster local build (ARM only, matches LiteRT-LM): add -PreactNativeArchitectures=arm64-v8a
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

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
