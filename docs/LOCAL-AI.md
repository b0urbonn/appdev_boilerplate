# Local AI

The Android app runs Google's Gemma 4 E2B instruction model with
`react-native-litert-lm`. After the model file is downloaded and loaded, prompt
and attachment inference runs on the device without a Gemini key or network.
The browser build does not include the Android inference engine.

## Requirements and RAM behavior

- Use a 64-bit ARM Android device with Android API 26 or newer. A physical
  phone is recommended; x86 Android emulators are not supported by this engine.
- The model download is about 2.6 GB and requires more than 2.6 GB of free
  storage for setup and temporary files.
- Local model compatibility uses **total physical RAM**, together with the
  model size, context size and backend estimate. The current free RAM reading
  is shown to the user but does not gate the load attempt.
- An Android or native inference allocation can still fail at runtime. That
  failure is reported; when an accelerator allocation returns a memory error,
  the app can retry on CPU.

The hardware panel shows detected physical hardware, total RAM, current
available RAM and free storage. It refreshes resource values while retaining
the previous device configuration on screen.

## Download and load

1. Open Detector settings and choose **Local AI**.
2. Choose **Download model**. Pause keeps a partial download for resuming;
   cancel deletes the partial and downloaded model files.
3. After the download completes, choose **Load model**. The initial engine
   load can take several seconds; later model use reuses the loaded engine.
4. **Unload** releases inference memory. **Delete** unloads the engine and
   removes the downloaded file.
5. **Auto** uses the detected hardware report. An explicit backend can be
   selected from the detected NPU, GPU or CPU choices.

The exact model asset and expected download size live in
`src/ai/modelInfo.ts`. The model itself is not stored in Git or included in an
APK; it is downloaded into app-private storage.

## Text generation

The runtime is configured with a 4096-token context and a capped 512-token
reply. Gemma sampling settings use temperature 1.0, top-k 64 and top-p 0.95.
Repetition controls discourage loops. If an answer contains a severe repeated
loop or an unrelated CJK response to a plain English prompt, the app discards
that attempt and retries on CPU when an accelerator was selected. Persisted
invalid assistant output is excluded when local chat context is rebuilt.

These checks improve output stability; small on-device models can still make
mistakes. Clear the chat when you want a fresh context.

## Images and voice messages

The chat composer supports text, one selected image, one recorded voice message,
or a combination of these inputs. Local and cloud providers both receive the
selected attachment along with the user's text.

For local inference:

- Images are passed by private local file path to LiteRT-LM; they are not
  converted to cloud requests.
- Android recordings are AAC. `LocalAudioDecoder.kt` decodes recordings with
  MediaCodec and writes temporary mono 16 kHz PCM WAV audio for the model.
- The temporary WAV is deleted after inference. The original recording stays
  in app storage so it can be played back in the chat.
- If there is no typed prompt, the app supplies a short task prompt for the
  image or voice message.

Changing from text to multimodal input loads the multimodal model configuration
on demand. The vision encoder uses the GPU when available and the audio encoder
uses CPU under LiteRT-LM. This may take longer the first time because the
encoder model has to initialize.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Local AI is unavailable in the browser | Run the Android development build. |
| Download is incomplete | Resume it from Detector settings; model files are stored in app-private storage. |
| Model load fails | Check total-RAM compatibility and free storage, then retry Auto or CPU. Runtime memory can differ by Android version and other running apps. |
| Image or voice control is missing | Confirm **Local AI** is selected and update the development build so the Expo native module is installed. |
| Audio decode fails | Try a shorter voice recording and confirm it plays in the chat. The recording must be in app-private storage. |
| Output repeats or changes language unexpectedly | The app detects some severe loops and retries accelerator failures on CPU. Start a fresh chat if an earlier answer is already in conversation history. |
