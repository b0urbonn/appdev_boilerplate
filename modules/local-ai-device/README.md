# Local AI device probe

Android Expo module that reads the chip, process ABI, physical/available RAM,
free storage, NNAPI accelerator devices, and available OpenCL GPU device. Scans do
not download or load a model.

NPU presence is distinct from LiteRT model compatibility. A native NNAPI
accelerator, Qualcomm HTP driver, or verified SM8550 chip establishes physical
NPU hardware. When drivers are hidden and the chip is unknown, report unknown
rather than claiming the phone has no NPU. LiteRT verifies the actual model
backend at load time and may use its CPU fallback.

Sources: [Android device enumeration](https://developer.android.com/ndk/reference/group/neural-networks),
[Snapdragon 8 Gen 2](https://www.qualcomm.com/smartphones/products/8-series/snapdragon-8-gen-2-mobile-platform),
[Expo local modules](https://docs.expo.dev/more/create-expo-module/).

Compatibility and backend selection use total physical RAM; available RAM is
shown as a live resource reading. Native allocation failures still report errors.
Voice messages are decoded from Android recordings to temporary mono 16 kHz
PCM WAV files for the local audio encoder. Original recordings remain available
for playback, while the temporary WAV is deleted after inference.
