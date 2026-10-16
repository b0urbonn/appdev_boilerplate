# Student Guide: Maalam

This guide covers everything to do **before** you build your own project on
this boilerplate: what you need, how to set up your computer, how to run the
app, and what to change to make it yours.

Read it from top to bottom the first time. Skip to
[Checklist](#10-checklist-before-you-start-your-project) when you start your
next project.

---

## 1. What you get

An Android app built with **React Native + Expo** that already has:

| Feature | Where |
| --- | --- |
| Onboarding slides + nickname setup (first launch only) | `src/app/onboarding.tsx` |
| Home screen with a greeting, AI status card and buttons | `src/app/(tabs)/index.tsx` |
| Empty "Your feature" buttons for your own features | `ACTIONS` in `src/app/(tabs)/index.tsx` |
| One AI chat screen (streaming replies, retry, stop) | `src/app/(tabs)/chat.tsx` |
| Context ring that shows how much the AI still remembers | `src/components/ContextRing.tsx` |
| System settings (nickname, light/dark theme, backup/restore, about, reset all data) | `src/app/settings.tsx` |
| Chatbot settings (AI provider, API key, model, local model, saved system prompt) | `src/app/chat-settings.tsx` |
| Offline storage (SQLite database on the phone) | `src/db/` |
| Cloud AI: Google Gemini (free API key) | `src/ai/gemini.ts` |
| Local AI: Gemma 4 E2B running on the phone, no internet | `src/ai/local.ts` |

**Offline-first** means the app saves everything on the device. It works
without internet; Gemini replies and the initial local-model download need a connection. Image
and voice attachments can be sent to either provider.

---

## 2. Requirements

### Computer

| | Minimum | Recommended |
| --- | --- | --- |
| OS | Windows 10/11, macOS 12+, or Linux | Any of these, 64-bit |
| RAM | 8 GB | 16 GB if you also use Android Studio (optional) |
| Free disk | 5 GB | 25 GB+ if you also use Android Studio (optional) |
| Internet | Needed for `npm install`, cloud builds and Gemini | Wi-Fi for the 2.6 GB local model download |

### Software

| Tool | Version | Needed for |
| --- | --- | --- |
| [Node.js](https://nodejs.org) | **20.19.4+**, 22.13+ or 24.3+ (use the LTS) | Everything |
| npm | Comes with Node.js | Installing packages |
| [Git](https://git-scm.com) | Any recent | Getting/saving the code |
| Code editor | e.g. [VS Code](https://code.visualstudio.com) | Editing |
| EAS CLI | Latest (`npm install -g eas-cli`) | Building the Android app in Expo's cloud |
| A web browser | Chrome or Edge | Testing the UI quickly |
| *Optional:* Android Studio | Latest (JDK 17 + Android SDK 36 + NDK 27.1) | Only if you want to build on your own computer |

You **don't need Android Studio**. The Android app is built on Expo's
servers with **EAS Build** (section 6.2).

### Phone (for the real Android app)

- **A real Android phone with an ARM processor** (almost every phone is ARM).
- Android **8.0 (API 26) or newer**.
- For **local AI**: **6–8 GB RAM** is recommended and **about 3 GB free
  storage** for the model. Compatibility is estimated from the phone’s total
  physical RAM. Available RAM is displayed live, but operating-system or
  native-engine allocation limits can still affect loading.
- The phone and your computer on the **same Wi-Fi** while developing.

> Android **emulators** on Windows/Intel PCs (x86_64) **cannot run local AI**.
> They can still run the rest of the app and Gemini.

### Accounts

- A **Google account** to make a free Gemini API key at
  <https://aistudio.google.com/apikey>.
- A free **Expo account** at <https://expo.dev/signup> (for cloud builds).
- Optional: a GitHub account to save and share your project.

### What you install yourself vs what `npm install` installs

| You install yourself (once per computer) | How |
| --- | --- |
| Node.js (includes npm and npx) | <https://nodejs.org>, LTS version |
| Git | <https://git-scm.com> |
| VS Code (or any editor) | <https://code.visualstudio.com> |
| EAS CLI (Expo's build tool) | `npm install -g eas-cli` |
| *Optional:* Android Studio | <https://developer.android.com/studio> (section 6.3) |

`eas-cli` is the **only** global npm package. Don't install the old
`expo-cli`; `npx expo ...` uses the Expo CLI that comes with the project.

Everything below is installed **automatically by `npm install`** from
`package.json`. You don't install them one by one.

### Libraries in this project

**Core**

| Package | Version | What it's for |
| --- | --- | --- |
| `expo` | ~57.0 | The Expo SDK and CLI (`npx expo ...`) |
| `react` / `react-dom` | 19.2.3 | React (react-dom is for the browser) |
| `react-native` | 0.86.3 | The mobile framework |
| `react-native-web` | ^0.21 | Runs the app in the browser for testing |
| `@expo/metro-runtime` | ~57.0 | Bundler runtime (needed for web) |
| `expo-dev-client` | ~57.0 | Lets you run your own dev build (instead of Expo Go) |
| `expo-build-properties` | ~57.0 | Sets Android build options (min Android 8 / API 26) |

**Navigation and UI**

| Package | Version | What it's for |
| --- | --- | --- |
| `expo-router` | ~57.0 | File-based screens (`src/app/`) and tabs |
| `react-native-screens` | ~4.26 | Native screen containers for navigation |
| `react-native-safe-area-context` | ~5.7 | Keeps content away from the notch/status bar |
| `@expo/vector-icons` | ^15.0 | Icons (Ionicons) |
| `react-native-svg` | 15.15.4 | Draws the context ring |
| `expo-font` | ~57.0 | Loads fonts/icons |
| `expo-splash-screen` | ~57.0 | Splash screen while the app starts |
| `expo-status-bar` | ~57.0 | Phone status bar style |
| `expo-system-ui` | ~57.0 | Background colour behind the app |
| `expo-linking` | ~57.0 | Opening links (e.g. the API key page) |
| `expo-constants` | ~57.0 | Reads the app name/version for Settings > About |

**Offline storage**

| Package | Version | What it's for |
| --- | --- | --- |
| `expo-sqlite` | ~57.0 | Local database for chat messages; also stores settings (`kv-store`) |
| `expo-secure-store` | ~57.0 | Encrypted storage for the Gemini API key |
| `expo-file-system` | ~57.0 | Downloads and stores the local AI model file |
| `expo-sharing` | 57.0.22 | Shares/saves the backup file |
| `expo-document-picker` | 57.0.3 | Picks a backup file to restore |
| `@react-native-community/netinfo` | 12.0.1 | Detects online/offline |

**AI**

| Package | Version | What it's for |
| --- | --- | --- |
| `react-native-litert-lm` | ^0.7.0 | Runs Gemma 4 E2B on the phone (LiteRT-LM). Android only |
| `react-native-nitro-modules` | ^0.37 | Native bridge that `react-native-litert-lm` needs |
| *(none for Gemini)* | | Gemini is called with plain `fetch` over HTTPS; no SDK |

**Dev tools** (only used on your computer)

| Package | Version | What it's for |
| --- | --- | --- |
| `typescript` | ~6.0 | Type checking (`npx tsc --noEmit`) |
| `@types/react` | ~19.2 | React types for TypeScript |
| `eslint` + `eslint-config-expo` | ^9 / ~57.0 | Code style checks (`npm run lint`) |

**Downloaded later, not by npm**

| What | Size | When |
| --- | --- | --- |
| Android build tools | Nothing on your computer | EAS Build runs them on Expo's servers |
| Gemma 4 E2B model (`gemma-4-E2B-it.litertlm`) | ~2.6 GB | When you tap **Download model** in the app |

> Packages with native code (`react-native-litert-lm`, `expo-sqlite`,
> `react-native-svg`, etc.) are why **Expo Go doesn't work**. You build your
> own version of the app once with EAS Build (a "development build"). Every
> time you add a package with native code, build it again.

---

## 3. Set up your computer (once)

### 3.1 Install Node.js and Git

Download and install both from their websites, then check in a terminal:

```bash
node -v    # should print v20.19.x, v22.x or v24.x
npm -v
git --version
```

### 3.2 Install EAS CLI and log in to Expo

```bash
npm install -g eas-cli
eas login        # use your Expo account
eas whoami       # should print your username
```

### 3.3 Prepare your phone

1. Use an Android phone with Android 8.0 or newer.
2. When you install your app's APK later, Android asks to allow installing
   apps from your browser/files app. Tap **Settings > Allow**.
3. Keep the phone on the same Wi-Fi as your computer while developing.

---

## 4. Get the code

Copy the boilerplate into a **new folder for each project**. Don't work
inside the original.

```bash
# from a Git repository
git clone <boilerplate-repo-url> my-project
cd my-project
rm -rf .git          # Windows PowerShell: Remove-Item -Recurse -Force .git
git init

# or: copy the folder, then delete node_modules/ and android/ in the copy
```

Install packages:

```bash
npm install
```

If `npm install` fails at the `react-native-litert-lm` step (it tries to
download iOS files), run:

```bash
SKIP_IOS_FRAMEWORK_DOWNLOAD=1 npm install
# Windows PowerShell:
# $env:SKIP_IOS_FRAMEWORK_DOWNLOAD=1; npm install
```

---

## 5. Make it your project (rename)

Do this **before `eas init` and your first build**. Changing the package
name later means a new app on the phone.

| What | File | Change |
| --- | --- | --- |
| App name on the phone | `app.json` > `expo.name` | `"Maalam"` → `"My Study Buddy"` |
| Slug | `app.json` > `expo.slug` | `"my-study-buddy"` (lowercase, dashes) |
| URL scheme | `app.json` > `expo.scheme` | `"my-study-buddy"` |
| **Android package ID** | `app.json` > `expo.android.package` | `"com.yourname.mystudybuddy"` (must be unique, lowercase, no dashes) |
| npm name | `package.json` > `name` | `"my-study-buddy"` |
| App icon/splash | `assets/images/` | Replace `icon.png`, `android-icon-*.png`, `splash-icon.png` (keep sizes) |
| Colours | `src/theme.ts` | Change `tint` and the other colours for light/dark |
| Title in README | `../README.md` | Your project name and description |
| License | `LICENSE` | Replace with your own (it is still Expo's template license) |

Then link the project to **your** Expo account (adds a `projectId` to
`app.json`):

```bash
eas init
```

> Never edit an `android/` folder by hand (if you have one). It is generated
> from `app.json`; EAS Build makes its own on Expo's servers.

---

## 6. Run the app

### 6.1 In the browser (fastest, for UI work)

```bash
npx expo start --web
```

Open <http://localhost:8081>. Changes reload automatically.

In the browser:
- Onboarding, Home, Settings and **Gemini** chat work.
- **Local AI does not work** (it needs the phone's hardware). Detector settings
  shows a note instead.
- The Gemini key is only kept for the current browser tab.

### 6.2 On your Android phone (with Expo, no Android Studio)

Expo Go can't run this project, so you build **your own Expo app** once
in the cloud. This is called a **development build**. The settings are
already in `eas.json`.

1. Start a cloud build:

   ```bash
   eas build --profile development --platform android
   ```

   - Answer **Yes** if it asks to create a project or generate an Android
     keystore.
   - The build runs on Expo's servers, usually 10–30 minutes, longer if
     the free queue is busy. Watch it at <https://expo.dev> > your project
     > **Builds**.

2. When it finishes, it shows a **QR code / link**. Open it on your phone,
   download the **APK** and install it.

3. Start the dev server on your computer:

   ```bash
   npx expo start
   ```

4. Open your new app on the phone (not Expo Go). Pick the dev server it
   finds on your Wi-Fi, or scan the QR code in the terminal. Code changes
   now reload on the phone right away.

   If the phone can't connect (school/public Wi-Fi), run
   `npx expo start --tunnel`.

**When do I need to build again?** Only when you **add a package with
native code** or **change `app.json`** (name, icon, package ID, plugins).
Editing your screens and code under `src/` does **not** need a new build.

The free Expo plan has a limited number of builds per month (see
<https://expo.dev/pricing>), so don't rebuild for every small change.

**Share a finished app** (an APK anyone can install, no dev server needed):

```bash
eas build --profile preview --platform android
```

### 6.3 Optional: build on your own computer (Android Studio)

Skip this unless you want unlimited builds on your own PC.

1. Install [Android Studio](https://developer.android.com/studio) and
   finish its setup wizard.
2. **SDK Manager**: install **Android 16 (API 36)**, **Build-Tools 36**,
   **NDK 27.1.12297006** and **Platform-Tools**.
3. Set `ANDROID_HOME` to the SDK folder and `JAVA_HOME` to Android
   Studio's `jbr` folder:

   **Windows** (PowerShell, then open a new terminal):

   ```powershell
   setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
   setx JAVA_HOME "C:\Program Files\Android\Android Studio\jbr"
   setx PATH "$env:PATH;$env:LOCALAPPDATA\Android\Sdk\platform-tools"
   ```

   **macOS** (add to `~/.zshrc`):

   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```

   **Linux** (add to `~/.bashrc`):

   ```bash
   export ANDROID_HOME=$HOME/Android/Sdk
   export JAVA_HOME=/opt/android-studio/jbr
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```

4. On the phone: **Settings > About phone** > tap **Build number** 7 times,
   then turn on **Developer options > USB debugging**. Plug it in with a
   data cable and tap **Allow**. `adb devices` should list it.
5. Build and install:

   ```bash
   npx expo run:android
   ```

   The first local build downloads several GB and is slow; later ones are
   fast.

---

## 7. Set up the AI

### 7.1 Cloud AI (Gemini, free)

1. Go to <https://aistudio.google.com/apikey> and create an API key.
2. In the app: **Chat** > gear icon > **AI provider: Cloud AI (Gemini)**.
3. Paste the key and save. The app picks the best model for your key
   (**Auto**). You can choose another model from the dropdown.
4. Chat. The free tier has rate limits; if you see "rate limit", wait a
   minute and tap the failed message to retry.

> **Keep your API key secret.** Don't put it in the code, screenshots,
> GitHub, or group chats. The app stores it in the phone's secure storage.
> If it leaks, delete it in AI Studio and make a new one.

### 7.2 Local AI (Gemma 4 E2B, offline)

1. **Chat** > gear icon > **AI provider: Local AI (Gemma 4 E2B)**.
2. Tap **Download model** (~2.6 GB, **use Wi-Fi**). You can cancel and
   resume.
3. Tap **Load model**. Wait until it says it's loaded.
4. Chat, now fully offline. **Unload** frees memory; **Delete** frees
   storage.
5. The app checks device hardware and uses total RAM for its compatibility
   estimate. Select an available backend in Detector settings; CPU is the broadest
   compatibility option, while GPU or NPU may accelerate supported operations.
   A runtime allocation can still fail even when the total-RAM estimate passes.

### 7.3 Context ring

The ring at the top of the chat fills up as the conversation gets longer.
When it's full, the AI starts forgetting the oldest messages. Tap it for
details. Clear the chat in Detector settings to start fresh.

---

## 8. Build your own features

### 8.1 Change onboarding

Edit the `SLIDES` array in `src/app/onboarding.tsx` (icon, title, body).
Icons are Ionicons names: <https://icons.expo.fyi>.

To see onboarding again: **Home** > gear > **Reset all data**.
This deletes everything (chat, settings, API key, local model).

### 8.2 Add a screen and a Home button

1. Create a file, e.g. `src/app/notes.tsx`:

   ```tsx
   import { Text, View } from 'react-native';

   export default function Notes() {
     return (
       <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
         <Text>My notes</Text>
       </View>
     );
   }
   ```

   The file name is the route: `notes.tsx` → `/notes`.

2. In `src/app/(tabs)/index.tsx`, replace one empty item in `ACTIONS`:

   ```tsx
   { label: 'Notes', icon: 'document-text-outline', onPress: (router) => router.push('/notes') },
   ```

### 8.3 Change how the AI behaves

- **Personality/instructions**: edit the system prompt in Detector settings and
  press **Save**. The default is in `src/settings/storage.ts`
  (`buildSystemPrompt()`).
- **Use the AI in your own screen**: use `getProvider(settings)` from
  `src/ai/index.ts`; see how `src/app/(tabs)/chat.tsx` calls `generate()`.
- **Add another AI provider**: implement `ChatProvider` from
  `src/ai/types.ts` and add it to `getProvider()`.

### 8.4 Save your own data offline

- Small values (preferences): add a field to `Settings` in
  `src/settings/storage.ts`, then read/update it with `useSettings()`.
- Lists/records (notes, tasks): add a table as a **new migration** in
  `src/db/client.ts` (never edit old migrations), then write a repository
  file like `src/db/messages.ts`.

### 8.5 Add packages

```bash
npx expo install <package-name>
```

Use `npx expo install` (not plain `npm install`) so you get a version that
matches Expo SDK 57. If the package has native code, make a new
build (`eas build --profile development --platform android`).

---

## 9. Project map

```
app.json                 App name, package ID, icons, plugins
src/app/                 Screens (file name = route)
  _layout.tsx            Startup: database, settings, onboarding gate
  onboarding.tsx         Intro slides + nickname
  (tabs)/index.tsx       Home
  (tabs)/chat.tsx        Chat
  settings.tsx           System settings
  chat-settings.tsx      Chatbot settings
src/ai/                  Gemini + local AI providers
src/db/                  SQLite database
src/backup/              Backup/restore to a JSON file
src/settings/            Saved settings + useSettings()
src/components/          Reusable UI pieces
src/hooks/               useNetwork, useAiStatus
src/theme.ts             Colours
```

See the [documentation index](README.md) for the architecture, local model,
cloud routing, and native hardware notes.

---

## 10. Checklist before you start your project

- [ ] Node.js 20.19+ installed (`node -v`)
- [ ] Git installed
- [ ] Copied the boilerplate into a **new folder** and ran `git init`
- [ ] `npm install` finished without errors
- [ ] Renamed `name`, `slug`, `scheme` and **`android.package`** in `app.json`
- [ ] Renamed `name` in `package.json`
- [ ] Replaced icons/splash in `assets/images/` (optional but recommended)
- [ ] Updated the root [README](../README.md) and `LICENSE`
- [ ] App runs in the browser: `npx expo start --web`
- [ ] Created a Gemini API key and tested a chat
- [ ] (Android) Expo account created, `eas-cli` installed, `eas login` done
- [ ] (Android) `eas init` run in your project folder
- [ ] (Android) Development build installed on the phone
      (`eas build --profile development --platform android`)
- [ ] (Android) `npx expo start` running and the phone app connects
- [ ] (Local AI) Model downloaded and loaded on a real phone
- [ ] Checked no API key is written anywhere in the code
- [ ] First commit: `git add . && git commit -m "Start from Maalam"`

---

## 11. Useful commands

| Command | What it does |
| --- | --- |
| `npm install` | Install packages |
| `npx expo start --web` | Run in the browser |
| `npx expo start` | Start the dev server (app already installed on phone) |
| `eas login` | Log in to your Expo account |
| `eas init` | Link the project to your Expo account |
| `eas build --profile development --platform android` | Cloud build of your dev app (APK) |
| `eas build --profile preview --platform android` | Cloud build of a shareable APK |
| `npx expo start --tunnel` | Dev server when the phone can't reach your PC on Wi-Fi |
| `npx expo run:android` | *Optional:* local build with Android Studio |
| `npx expo install <pkg>` | Add a package with the right version |
| `npx tsc --noEmit` | Check TypeScript errors |
| `npm run lint` | Check code style |
| `npx expo-doctor` | Check the project setup for problems |
| `adb devices` | *Optional:* list phones connected by USB (Android Studio) |

Run `npx tsc --noEmit` and `npm run lint` before you submit or share your
project.

---

## 12. Troubleshooting

| Problem | Fix |
| --- | --- |
| `node: command not found` / wrong version | Reinstall Node.js LTS, then open a new terminal. |
| `npm install` fails on `react-native-litert-lm` | Run with `SKIP_IOS_FRAMEWORK_DOWNLOAD=1` (see section 4). |
| `eas: command not found` | Run `npm install -g eas-cli`, then open a new terminal. |
| EAS build waits in the queue for a long time | Normal on the free plan. Check back later at expo.dev. |
| EAS build failed | Open the build on expo.dev, read the log, fix the error and build again. |
| Phone app can't find the dev server | Use the same Wi-Fi for both, or run `npx expo start --tunnel`. |
| Can't install the APK | Allow "Install unknown apps" for your browser/files app. |
| *(Android Studio only)* `SDK location not found` | Set `ANDROID_HOME` (section 6.3) and open a new terminal. |
| *(Android Studio only)* `adb devices` shows nothing | Use a data cable, enable USB debugging, accept the prompt on the phone. |
| Port 8081 already in use | Close the other `expo start` terminal, or run `npx expo start --port 8082`. |
| Chat controls are hidden by the keyboard | Update `softwareKeyboardLayoutMode` in `app.json`; the chat uses keyboard avoidance and keeps its composer in one row. Rebuild the Android development client after changing native config. |
| App opens in Expo Go and crashes | Expo Go isn't supported. Use your development build (section 6.2). |
| Blank screen / stale code in browser | Stop the server and run `npx expo start --web --clear`. |
| "Invalid API key" | Re-paste the key in Detector settings; set model to **Auto**. |
| "Rate limit reached" | Free-tier limit; wait a minute and retry. |
| Local AI unavailable in browser | Expected. Local AI only works in the Android app. |
| Local model won't load / app closes | Check the total-RAM compatibility status, confirm the model finished downloading and retry with **Auto** or **CPU**. A runtime memory allocation can still fail. |
| Local AI on emulator fails | Emulators on x86 PCs aren't supported. Use a real phone. |
| Want a clean start | Home > gear > **Reset all data**. |
