// 60s variant: same scenes, narration regenerated at +15% rate,
// tighter per-scene budgets. Audio durations measured via afinfo.
// Total = 1800 frames = 60.0s at 30fps.
import type { SceneDef } from './script';

export const SCENES_60: SceneDef[] = [
  {
    id: 'hook',
    frames: 105,
    audio: 'audio/1min/hook.mp3', // 84f
    audioDelay: 14,
    captions: [
      { text: "What if your phone could tell what's real —", from: 14, to: 56 },
      { text: "and what's fake?", from: 56, to: 98 },
    ],
  },
  {
    id: 'intro',
    frames: 158,
    audio: 'audio/1min/intro.mp3', // 133f
    audioDelay: 14,
    captions: [
      { text: 'Meet Maalam — your offline-first guardian', from: 14, to: 80 },
      { text: 'against deepfakes and harmful content.', from: 80, to: 146 },
    ],
  },
  {
    id: 'scan',
    frames: 212,
    audio: 'audio/1min/scan.mp3', // 194f
    audioDelay: 10,
    captions: [
      { text: 'Attach any image and run a manipulation scan —', from: 10, to: 100 },
      { text: 'AI-generated and tampered media, spotted in seconds.', from: 100, to: 204 },
    ],
  },
  {
    id: 'detect',
    frames: 192,
    audio: 'audio/1min/detect.mp3', // 176f
    audioDelay: 8,
    captions: [
      { text: 'Text and voice clips are screened for hate speech, scams, and threats', from: 8, to: 92 },
      { text: '— each flagged with a clear verdict.', from: 92, to: 184 },
    ],
  },
  {
    id: 'verdict',
    frames: 180,
    audio: 'audio/1min/verdict.mp3', // 162f
    audioDelay: 8,
    captions: [
      { text: 'Every scan ends with a verdict — a risk score you can read at a glance,', from: 8, to: 88 },
      { text: 'and a full report you can share.', from: 88, to: 170 },
    ],
  },
  {
    id: 'monitor',
    frames: 198,
    audio: 'audio/1min/monitor.mp3', // 181f
    audioDelay: 10,
    captions: [
      { text: 'Turn on protection and Maalam watches your chosen apps in the background', from: 10, to: 100 },
      { text: '— alerting you the moment something harmful appears.', from: 100, to: 191 },
    ],
  },
  {
    id: 'learn',
    frames: 136,
    audio: 'audio/1min/learn.mp3', // 116f
    audioDelay: 10,
    captions: [
      { text: 'Built-in lessons train your eye —', from: 10, to: 62 },
      { text: 'so you can spot a fake even without the app.', from: 62, to: 126 },
    ],
  },
  {
    id: 'engine',
    frames: 203,
    audio: 'audio/1min/engine.mp3', // 187f
    audioDelay: 10,
    captions: [
      { text: 'Verdicts run on-device by default — or flip on cloud AI for extra power.', from: 10, to: 102 },
      { text: 'Either way, your data stays yours.', from: 102, to: 197 },
    ],
  },
  {
    id: 'chat',
    frames: 128,
    audio: 'audio/1min/chat.mp3', // 111f
    audioDelay: 8,
    captions: [
      { text: 'And a built-in assistant answers your questions,', from: 8, to: 60 },
      { text: 'even fully offline.', from: 60, to: 119 },
    ],
  },
  {
    id: 'trust',
    frames: 138,
    audio: 'audio/1min/trust.mp3', // 118f
    audioDelay: 10,
    captions: [
      { text: 'No account. No uploads.', from: 10, to: 64 },
      { text: 'Every scan stays in your local history.', from: 64, to: 128 },
    ],
  },
  {
    id: 'outro',
    frames: 150,
    audio: 'audio/1min/outro.mp3', // 94f
    audioDelay: 22,
    captions: [
      { text: "Maalam. See what's real.", from: 22, to: 68 },
      { text: 'Coming soon to Google Play.', from: 68, to: 130 },
    ],
  },
];

export const TOTAL_FRAMES_60 = SCENES_60.reduce((a, s) => a + s.frames, 0); // 1800
export const MUSIC_END_FADE_60 = TOTAL_FRAMES_60 - 36;
export const MUSIC_SRC_60 = 'audio/music60.wav';
