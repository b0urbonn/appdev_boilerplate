// Scene timing at 30fps. Audio durations measured via afinfo.
// Total ≈ 2430 frames ≈ 81s.
export interface SceneDef {
  id: string;
  frames: number;
  audio: string;
  audioDelay: number;
  captions: { text: string; from: number; to: number }[];
}

export const SCENES: SceneDef[] = [
  {
    id: 'hook',
    frames: 155,
    audio: 'audio/hook.mp3', // 96f
    audioDelay: 18,
    captions: [
      { text: "What if your phone could tell what's real —", from: 18, to: 75 },
      { text: "and what's fake?", from: 75, to: 122 },
    ],
  },
  {
    id: 'intro',
    frames: 225,
    audio: 'audio/intro.mp3', // 154f
    audioDelay: 20,
    captions: [
      { text: 'Meet Maalam — your offline-first guardian', from: 20, to: 100 },
      { text: 'against deepfakes and harmful content.', from: 100, to: 180 },
    ],
  },
  {
    id: 'scan',
    frames: 285,
    audio: 'audio/scan.mp3', // 223f
    audioDelay: 12,
    captions: [
      { text: 'Attach any image and run a manipulation scan —', from: 12, to: 110 },
      { text: 'AI-generated and tampered media, spotted in seconds.', from: 110, to: 240 },
    ],
  },
  {
    id: 'detect',
    frames: 250,
    audio: 'audio/detect.mp3', // 203f
    audioDelay: 10,
    captions: [
      { text: 'Text and voice clips are screened for hate speech, scams, and threats', from: 10, to: 115 },
      { text: '— each flagged with a clear verdict.', from: 115, to: 215 },
    ],
  },
  {
    id: 'verdict',
    frames: 240,
    audio: 'audio/verdict.mp3', // 187f
    audioDelay: 10,
    captions: [
      { text: 'Every scan ends with a verdict — a risk score you can read at a glance,', from: 10, to: 110 },
      { text: 'and a full report you can share.', from: 110, to: 200 },
    ],
  },
  {
    id: 'monitor',
    frames: 270,
    audio: 'audio/monitor.mp3', // 209f
    audioDelay: 12,
    captions: [
      { text: 'Turn on protection and Maalam watches your chosen apps in the background', from: 12, to: 125 },
      { text: '— alerting you the moment something harmful appears.', from: 125, to: 225 },
    ],
  },
  {
    id: 'learn',
    frames: 190,
    audio: 'audio/learn.mp3', // 134f
    audioDelay: 14,
    captions: [
      { text: 'Built-in lessons train your eye —', from: 14, to: 85 },
      { text: 'so you can spot a fake even without the app.', from: 85, to: 155 },
    ],
  },
  {
    id: 'engine',
    frames: 270,
    audio: 'audio/engine.mp3', // 216f
    audioDelay: 14,
    captions: [
      { text: 'Verdicts run on-device by default — or flip on cloud AI for extra power.', from: 14, to: 135 },
      { text: 'Either way, your data stays yours.', from: 135, to: 235 },
    ],
  },
  {
    id: 'chat',
    frames: 175,
    audio: 'audio/chat.mp3', // 128f
    audioDelay: 10,
    captions: [
      { text: 'And a built-in assistant answers your questions,', from: 10, to: 75 },
      { text: 'even fully offline.', from: 75, to: 140 },
    ],
  },
  {
    id: 'trust',
    frames: 190,
    audio: 'audio/trust.mp3', // 136f
    audioDelay: 15,
    captions: [
      { text: 'No account. No uploads.', from: 15, to: 80 },
      { text: 'Every scan stays in your local history.', from: 80, to: 155 },
    ],
  },
  {
    id: 'outro',
    frames: 180,
    audio: 'audio/outro.mp3', // 109f
    audioDelay: 30,
    captions: [
      { text: "Maalam. See what's real.", from: 30, to: 85 },
      { text: 'Coming soon to Google Play.', from: 85, to: 145 },
    ],
  },
];

export const TOTAL_FRAMES = SCENES.reduce((a, s) => a + s.frames, 0); // 2430
export const MUSIC_END_FADE = TOTAL_FRAMES - 36;
