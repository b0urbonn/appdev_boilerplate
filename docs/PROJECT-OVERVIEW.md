# Maalam

A small, readable Android chatbot app you can build on. It is
**offline-first**: every conversation lives in a local SQLite database, so
browsing, creating, and reading chats works with no network at all.

Two AI providers are included and can be switched in **Detector settings** (gear icon in the chat):

- **Cloud** — Google Gemini, streamed over plain HTTPS (no SDK). Needs a
  free API key.
- **Local** — Gemma 4 E2B running entirely on-device with
  [LiteRT-LM](https://github.com/google-ai-edge/LiteRT-LM) via
  `react-native-litert-lm`. Works with zero connectivity once the ~2.6 GB
  model is downloaded.

Built with Expo SDK 57 + TypeScript + expo-router.

**Students: start with the [guide](GUIDE.md)** (requirements, setup, renaming,
first run, checklist, troubleshooting).

## Prerequisites

- Node.js 20.19+ and npm
- JDK 17 (e.g. `brew install openjdk@17` on macOS)
- Android SDK (via Android Studio, or `brew install --cask android-commandlinetools`)
- A **physical ARM Android phone** is strongly recommended. The local model
  requires ARM hardware and sufficient total device RAM (6–8 GB or more is
  recommended). The app estimates compatibility from total RAM; available
  RAM can still affect whether the native runtime can load the model. It
  will not run on x86_64 emulators; arm64 emulator images on Apple Silicon
  may work but are slow.

> **No Expo Go.** The app uses native modules (LiteRT-LM, SQLite), so it
> must be built as a development build with `expo run:android`.

## Setup

**No Android Studio needed:** build in Expo's cloud with
`eas build --profile development --platform android` (profiles are in
`eas.json`), install the APK, then run `npx expo start`. See
[GUIDE.md](GUIDE.md) section 6.2. The local build below is optional.

```bash
SKIP_IOS_FRAMEWORK_DOWNLOAD=1 npm install
npx expo run:android # builds the dev client and installs on your device
```

`expo run:android` compiles the Android app (Gradle), installs it, and
starts Metro. Set `ANDROID_HOME` / `JAVA_HOME` first if they aren't in your
environment, e.g. on macOS with Homebrew:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=$HOME/Library/Android/sdk   # Android Studio default
# or, with brew's android-commandlinetools:
# export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
```

## Using the app

### Cloud provider (Gemini)

1. Get a free API key: <https://aistudio.google.com/apikey>
2. In the app: **Detector settings > AI provider** dropdown, choose **Cloud AI
   (Gemini)** and paste the key. The model
   list loads automatically. **Auto** chooses a suitable available model for
   the request and can fall back when a model is unavailable or rate limited.
   You can also select a specific model from the **Model** dropdown.
3. Chat normally. Free-tier rate limits apply — a 429 shows a friendly
   "wait a minute" error; tap the errored message to retry.

### Local provider (Gemma 4 E2B)

1. **Detector settings > AI provider** dropdown: choose **Local AI (Gemma 4 E2B)**.
   Only the local options are shown.
2. Tap **Download model**. ~2.6 GB, use Wi-Fi. Downloads can be cancelled and
   resumed; the file only counts as ready once fully downloaded (it is
   renamed from a temp file).
3. Tap **Load model** to load it into memory (takes a while). The chat stays
   disabled until the model is loaded. **Unload** frees the memory again.
4. The app detects available CPU, GPU, and physical NPU hardware. Use the
   backend selector to choose an available option; changing it unloads the
   model, so load it again to apply. Detection reports device hardware and
   does not guarantee every model operation will run on an accelerator.
5. Local chat supports image and audio input when those inputs are enabled
   for the selected model. The app prepares audio on-device before inference.

### Context window indicator

A ring in the chat's top bar (next to the gear) fills up as the chat uses
the model's context window, i.e. how much past conversation the AI can still
remember. Tap it for details: tokens used, room left, and roughly how many
of the latest messages still fit. Gemini reports real counts after
each reply (`usageMetadata`, against the model's `inputTokenLimit`); the
local model reports its KV-cache tokens (4096-token window, set by
`LOCAL_CONTEXT_TOKENS` in `src/ai/local.ts`). Before the first reply the
number is an estimate (about 4 characters per token). Over 80% the ring
turns red; clear the chat to start fresh.

Local inference and chat history work offline after the model is downloaded.
Internet access is needed for Gemini responses and the initial model download.

## Architecture

```
src/app/_layout.tsx            DB init, SettingsProvider, onboarding gate (Stack.Protected)
src/app/onboarding.tsx         Intro slides + nickname step (first launch only)
src/app/(tabs)/_layout.tsx     Tabs: Home, Chat (no headers)
src/app/(tabs)/index.tsx       Home: greeting, AI status card, action buttons
src/app/(tabs)/chat.tsx        The single chat (streaming, retry, stop, banners, gear button)
src/app/settings.tsx           System settings (gear on Home): nickname, light/dark
                               theme, backup/restore, about, reset all data
src/app/chat-settings.tsx      Chatbot settings (gear in Chat): provider, API key, model,
                               local model download, system prompt, clear chat
src/db/client.ts               SQLite open + PRAGMA user_version migrations
src/db/conversations.ts        Conversation row for the single chat
src/db/messages.ts             Message repository (status: done|pending|error)
src/settings/storage.ts        kv-store settings + SecureStore API key
src/settings/SettingsContext.tsx
src/ai/types.ts                ChatProvider interface
src/ai/gemini.ts               Gemini REST + SSE streaming
src/ai/local.ts                LiteRT-LM engine, model download manager
modules/local-ai-device/       Android hardware probes and native audio conversion
src/ai/index.ts                getProvider(settings): provider switch
src/hooks/useNetwork.ts        NetInfo connectivity
src/hooks/useAiStatus.ts       "Can the selected AI answer right now?"
src/utils/confirm.ts           Confirm dialogs that work on Android and web
src/backup/                    Backup/restore to a JSON file (share sheet on
                               Android, download on web)
src/components/                Banner, ChatInput, MessageBubble, Section, Dropdown,
                               ContextRing
src/theme.ts                   Light/dark colors
```

### Onboarding and nickname

On first launch the app shows `src/app/onboarding.tsx`: a few intro slides
(edit the `SLIDES` array) and a nickname step. Finishing sets the
`onboarded` setting, and the root layout's `Stack.Protected` guard swaps to
the main tabs. The nickname is shown on Home and added to the AI system
prompt (`buildSystemPrompt()` in `src/settings/storage.ts`). Change it in
**Settings > Profile** (gear icon on Home). **Settings > Reset all data**
deletes the chat, all settings, the API key and the downloaded local model,
then starts again from onboarding.

**Settings > Appearance** switches between Light (default) and Dark.
**Settings > Data** backs everything up to a JSON file (share sheet on
Android, download in the browser) and restores it later. The backup
contains the chat and settings — never the Gemini API key, and not the
downloaded local model file.

### Home buttons

The Home tab renders the `ACTIONS` array in `src/app/(tabs)/index.tsx` as a
grid of buttons. The dashed "Your feature" tiles are empty placeholders
(no `onPress` yet). To add a feature: create a screen (e.g.
`src/app/notes.tsx`), then add `{ label, icon, onPress: (router) =>
router.push('/notes') }` to `ACTIONS`. Icons are
[Ionicons](https://icons.expo.fyi) names.


### Offline-first data flow

Sending a message:

1. The user message is inserted into `messages` (status `done`).
2. An empty assistant message is inserted (status `pending`).
3. Tokens stream into the UI; SQLite is written at most every 500 ms and a
   final write happens when generation completes (`status = 'done'`).
4. On failure the message is marked `error` with the error text — tap it to
   retry. A `pending` message still present at app start is marked
   `error` ("Generation interrupted").

The app has one chat (conversation id `main`); there is no chat history
list. "Clear chat" in Detector settings deletes its messages.

### Adding a new AI provider

Implement `ChatProvider` (see `src/ai/types.ts`) in a new file under
`src/ai/`, then add one line in `getProvider()` in `src/ai/index.ts`.
`generate()` receives the full message history (new user message last) and
calls `opts.onToken` for each streamed chunk.

### Changing the package name

Edit `android.package` in `app.json` (currently
`com.example.offlineaistarter`), then run `npx expo prebuild --clean` or
`npx expo run:android` again to regenerate the native project. The
`android/` directory is generated — do not edit it by hand.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "Free-tier rate limit reached" | Wait ~a minute; retry by tapping the errored message. |
| "Invalid API key or model" | Re-check the key in Detector settings, or choose "Auto (best available)" as the model. |
| Local model load fails | Check the device's total-RAM compatibility estimate, close other apps, and try another detected backend. Runtime memory needs vary; total RAM is an estimate, not a guarantee. |
| Local AI won't run on emulator | LiteRT-LM is ARM-only — use a physical ARM device. |
| `npm install` fails on litert-lm postinstall | It tries to fetch iOS frameworks; run `SKIP_IOS_FRAMEWORK_DOWNLOAD=1 npm install`. |
| App stops responding on first local message | Model load takes time; watch for "Loading model...". |

## Verify (for maintainers)

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleDebug
```
