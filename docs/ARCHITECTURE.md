# Architecture and data flow

## App entry and navigation

`src/app/_layout.tsx` opens and migrates SQLite, reads model download state,
loads settings, and shows onboarding until the user finishes it. The root
Expo Router stack protects the onboarding and app routes.

The tab group in `src/app/(tabs)/_layout.tsx` contains Home and Chat. Chat
hides the bottom tab bar. The Home screen presents the selected-provider status
and action tiles. Chat owns the single conversation, message composer, recorder,
provider selection, streaming updates, retries, and stop control.

The Detector settings screen lives in `src/app/chat-settings.tsx`; app appearance, profile,
backup, restore, and reset live in `src/app/settings.tsx`.

## Message and provider flow

1. `src/app/(tabs)/chat.tsx` ensures the `main` conversation exists.
2. It stores the new user message and a pending assistant message in SQLite.
3. `src/ai/index.ts` selects `createGeminiProvider` or `createLocalProvider`
   from the current settings.
4. The provider emits answer chunks through `GenerateOptions.onToken`.
   Chat updates the visible message in batches and writes progress to SQLite.
5. Chat marks the answer done, or stores the error so it can be retried.

`src/ai/types.ts` defines the shared `ChatProvider`, `ChatMessage`, and
`GenerateOptions` contracts. When a new app launch finds a pending assistant
message, it marks generation interrupted. The app has one chat thread, with id
`main`.

## Local persistence

- `src/db/client.ts` owns the SQLite database and ordered schema migrations.
- `src/db/messages.ts` and `src/db/conversations.ts` hold query functions.
- `src/settings/storage.ts` stores regular settings in Expo SQLite KV Store.
  The Gemini API key uses Expo SecureStore on Android and session storage in the
  browser.
- `src/attachments/files.ts` copies images and recordings into app-private
  attachment storage. Clearing all chats removes those files.
- `src/backup/` exports and restores conversations, messages, and portable
  settings. The backup does not contain the API key or downloaded model.

## Downloaded model lifecycle

`src/ai/local.ts` owns model download, resume, pause, cancel, load and unload
state. Downloads first go to a partial file and move into the model location
only after they finish. Cancel removes the partial or completed model file.

The LiteRT-LM engine is loaded on request and kept in a module singleton while
the app runs. Text chat loads the text configuration. An image or audio message
loads the multimodal configuration when needed. If the input configuration or
selected backend changes, the engine is unloaded and reloaded. Existing local
conversation context can be replayed after a reload from stored chat messages.

The engine library exposes no immediate cancellation API for a running native
generation. Stop prevents more tokens from being shown while native generation
finishes.

## RAM and device detection

`src/ai/deviceCapabilities.ts` combines the native hardware probe with model
memory estimates. Total physical RAM is used for the compatibility estimate.
Current available RAM is sampled independently and shown as live status; it is
not the model-loading gate. Native engine allocations can still fail at runtime.

The Android probe in `modules/local-ai-device/` reads device and ABI details,
physical and available memory, storage, NNAPI accelerator devices and an
available OpenCL GPU. Physical NPU presence and successful LiteRT model
execution on that backend are distinct facts. LiteRT can fall back to CPU.

`src/settings/SettingsContext.tsx` performs the full hardware scan when local AI
is selected, then refreshes RAM and storage periodically while the app is in
the foreground. Refreshing the display keeps the previous configuration
visible while the resource sample updates.

## UI, motion, and dialogs

Reusable buttons and icon buttons are in `src/components/Button.tsx`. The theme
lives in `src/theme.ts`; light/dark preference is saved with the other settings.
`SmoothPressable` and `AccessibilityPreferences` respect the reduced-motion
setting. The message input keeps attachment, text, voice and send controls in
one row. Android keyboard handling is configured in `app.json` and the chat
screen uses `KeyboardAvoidingView`.

App confirmation dialogs use `src/components/Popup.tsx` and `src/utils/confirm.ts`.
They blur the app surface behind the dialog. System permission sheets and the
Android image picker are owned by Android and are outside the app's popup layer.

## Protected-app monitoring

`modules/app-monitor/` is a local Expo module that watches the apps the user
picked during onboarding. `MaalamMonitorService` (an Accessibility service)
tracks the foreground app, shows a floating bubble while a protected app is
open, and captures the screen when it changes (debounced, rate-limited and
deduplicated with a difference hash plus the visible-text snapshot).

Each captured frame starts `MaalamScanTaskService`, a React Native
HeadlessJsTaskService that runs the `MaalamScan` task registered in `index.js`.
`src/detection/task.ts` loads settings, calls `src/detection/analyze.ts` — which
reuses the selected provider via `getProvider(settings)` with a JSON-only
detection prompt — and reports the verdict back to the service with
`AppMonitor.reportResult`. Flagged frames are moved into
`documentDirectory/detections/` and stored in the `detections` SQLite table
(`src/db/detections.ts`); clean frames are deleted.

The floating bubble's ring color reflects monitor state: green while live
monitoring is idle, purple while a capture/scan is in flight, red when a
frame is flagged, and orange in Manual mode.

Tapping the bubble opens the monitor tools popup — a themed card that follows
the app's light/dark setting (`darkTheme` in `MonitorConfig`, synced through
`useMonitorSync`). The header is an icon chain — monitored app icon, an
animated link connector, the Maalam icon with a state dot — flanked by an
"open Maalam" shortcut (launches the app) and a close button. Below it, a
single oblong toggle animates between **Live Mode** (auto screen scans only)
and **Manual Mode** (on-demand inspection).

Manual mode offers a chat thread: user bubbles (with attached-image
previews), assistant replies, status messages, and inline verdict cards.
A "+" button in the composer reveals the tools — Attach (screenshot/image
picker), Detect link (reads a URL off the foreground screen), and Paste
link. Submissions run the same `MaalamScanTaskService` pipeline; the verdict
appears as an in-thread card with **View result** (full report popup) and
**Open app** (`maalam://detections/<id>` → `src/app/detections/[id].tsx`).

`src/app/monitor-preview.tsx` is an in-app simulation of this overlay used
for design iteration; keep it visually in sync with `MaalamMonitorService`.
The home screen shows the protection status, a protected-apps launcher and
recent detections; `src/app/protected-apps.tsx` edits the monitored list.
Settings sync to the service via `useMonitorSync`
(`src/monitor/useMonitorSync.ts`).
