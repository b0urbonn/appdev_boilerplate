// Procedural hype music generator — 120 BPM, stereo WAV.
// Usage: node gen-music.mjs [seconds] [outName] > writes public/audio/<outName>.wav
import { writeFileSync } from 'node:fs';

const SR = 44100;
const BPM = 120;
const BEAT = 60 / BPM; // 0.5s
const BAR = BEAT * 4; // 2s
const SECONDS = Number(process.argv[2] || 90);
const OUT_NAME = process.argv[3] || 'music';
const N = Math.floor(SECONDS * SR);
const out = new Float32Array(N * 2);

const TAU = Math.PI * 2;
const rand = (() => {
  let s = 1337;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
})();

// A-minor progression: Am, F, C, G (roots in octave 2)
const PROG = [
  { root: 110.0, chord: [220.0, 261.63, 329.63] }, // A3 C4 E4
  { root: 110.0, chord: [220.0, 261.63, 329.63] },
  { root: 87.31, chord: [174.61, 220.0, 261.63] }, // F3 A3 C4
  { root: 87.31, chord: [174.61, 220.0, 261.63] },
  { root: 130.81, chord: [261.63, 329.63, 392.0] }, // C4 E4 G4
  { root: 130.81, chord: [261.63, 329.63, 392.0] },
  { root: 98.0, chord: [196.0, 246.94, 293.66] }, // G3 B3 D4
  { root: 98.0, chord: [196.0, 246.94, 293.66] },
];
const ARP = [220, 261.63, 293.66, 329.63, 392, 440, 523.25]; // A minor pentatonic-ish

const mix = (i, l, r) => {
  if (i < 0 || i >= N) return;
  out[i * 2] += l;
  out[i * 2 + 1] += r;
};

const addMono = (startSec, durSec, fn, gain = 1, pan = 0) => {
  const s0 = Math.floor(startSec * SR);
  const len = Math.floor(durSec * SR);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const v = fn(t) * gain;
    const idx = s0 + i;
    if (idx < N) {
      out[idx * 2] += v * (1 - Math.max(0, pan));
      out[idx * 2 + 1] += v * (1 + Math.min(0, pan));
    }
  }
};

const kick = (at) =>
  addMono(at, 0.28, (t) => {
    const f = 45 + 140 * Math.exp(-t * 40);
    const amp = Math.exp(-t * 11);
    return Math.sin(TAU * f * t) * amp + (rand() - 0.5) * 0.6 * Math.exp(-t * 300);
  }, 0.95);

const hat = (at, open = false, g = 0.16) =>
  addMono(at, open ? 0.09 : 0.035, (t) => {
    const n = rand() - 0.5;
    return n * Math.exp(-t * (open ? 40 : 120));
  }, g, 0.25);

const clap = (at) =>
  addMono(at, 0.22, (t) => {
    const n = rand() - 0.5;
    const bp = Math.sin(TAU * 1800 * t) * 0.4 + n;
    const env = Math.exp(-t * 14) * (0.6 + 0.4 * Math.sin(t * 95));
    return bp * env * 0.7;
  }, 0.4, -0.15);

const bass = (at, freq, dur) =>
  addMono(at, dur, (t) => {
    const v =
      Math.sin(TAU * freq * t) +
      0.5 * Math.sin(TAU * freq * 2 * t) +
      0.25 * Math.sin(TAU * freq * 3 * t);
    return Math.tanh(v * 1.6) * Math.min(1, t * 60) * Math.exp(-t * 3.2);
  }, 0.34);

const pad = (at, chord, dur) => {
  for (const f of chord) {
    for (const det of [-4, 3]) {
      addMono(at, dur, (t) => {
        const fr = f * Math.pow(2, det / 1200);
        const v = Math.tanh(Math.sin(TAU * fr * t) * 2.2);
        const env = Math.min(1, t * 3) * Math.exp(-Math.max(0, t - dur + 0.5) * 8);
        return v * env;
      }, 0.035, det / 4);
    }
  }
};

const pluck = (at, freq, g = 0.14) =>
  addMono(at, 0.3, (t) => {
    const v = Math.sin(TAU * freq * t) + 0.4 * Math.sin(TAU * freq * 2 * t);
    return v * Math.exp(-t * 18);
  }, g, (rand() - 0.5) * 0.7);

const riser = (at, dur) =>
  addMono(at, dur, (t) => {
    const p = t / dur;
    const n = (rand() - 0.5) * (0.2 + p * 0.8);
    const tone = Math.sin(TAU * (300 + p * 2200) * t) * 0.3;
    return (n * 0.5 + tone) * p;
  }, 0.16);

const impact = (at) => {
  addMono(at, 0.9, (t) => Math.sin(TAU * (55 + 30 * Math.exp(-t * 8)) * t) * Math.exp(-t * 4), 0.9);
  addMono(at, 0.5, (t) => (rand() - 0.5) * Math.exp(-t * 10), 0.3);
};

const bars = Math.floor(SECONDS / BAR);
for (let bar = 0; bar < bars; bar++) {
  const t0 = bar * BAR;
  const prog = PROG[bar % PROG.length];
  const phase = bar < 4 ? 'intro' : bar < bars - 6 ? 'main' : bar < bars - 2 ? 'break' : 'end';

  // pad + arp always (except intro half)
  if (phase !== 'intro' || bar >= 2) pad(t0, prog.chord, BAR);
  if (phase === 'main' || phase === 'end') {
    for (let s = 0; s < 16; s++) {
      const f = ARP[(s * 3 + bar) % ARP.length] * (bar % 8 >= 4 ? 1 : 0.5);
      pluck(t0 + s * BEAT * 0.25, f, s % 4 === 0 ? 0.15 : 0.09);
    }
  }

  // drums
  if (phase === 'main' || phase === 'end') {
    for (let b = 0; b < 4; b++) {
      kick(t0 + b * BEAT);
      if (b === 1 || b === 3) clap(t0 + b * BEAT);
      for (let h = 0; h < 2; h++) hat(t0 + b * BEAT + h * 0.25, h === 1 && b === 3, h === 0 ? 0.15 : 0.1);
    }
    for (let b = 0; b < 4; b++) bass(t0 + b * BEAT + 0.25, prog.root, 0.22);
  } else if (phase === 'intro') {
    for (let b = 0; b < 4; b++) kick(t0 + b * BEAT);
    for (let b = 0; b < 4; b++) hat(t0 + b * BEAT + 0.25, false, 0.08 + bar * 0.015);
  } else {
    // break: halftime feel
    kick(t0);
    clap(t0 + 2 * BEAT);
    hat(t0 + BEAT, true, 0.1);
    hat(t0 + 3 * BEAT, true, 0.1);
    bass(t0, prog.root, 0.4);
  }

  // risers into main and into end
  if (bar === 3 || bar === bars - 3) riser(t0, BAR);
  if (bar === bars - 2) riser(t0, BAR);
}

// final impact at last bar
impact(bars * BAR);

// sidechain pump: duck everything slightly right after each beat
for (let i = 0; i < N; i++) {
  const beatPhase = (i / SR) % BEAT;
  const duck = 0.78 + 0.22 * Math.min(1, beatPhase * 9);
  out[i * 2] *= duck;
  out[i * 2 + 1] *= duck;
}

// soft-clip + normalize + 1.2s fade-out tail
let peak = 0;
for (let i = 0; i < out.length; i++) {
  out[i] = Math.tanh(out[i] * 1.4);
  peak = Math.max(peak, Math.abs(out[i]));
}
const fadeStart = N - Math.floor(1.2 * SR);
for (let i = 0; i < out.length; i++) {
  out[i] *= 0.88 / peak;
  if (i / 2 > fadeStart) out[i] *= Math.max(0, 1 - (i / 2 - fadeStart) / (N - fadeStart));
}

// WAV encode
const buf = Buffer.alloc(44 + out.length * 2);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + out.length * 2, 4);
buf.write('WAVEfmt ', 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(out.length * 2, 40);
for (let i = 0; i < out.length; i++) {
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(out[i] * 32767))), 44 + i * 2);
}
writeFileSync(`public/audio/${OUT_NAME}.wav`, buf);
console.log(`${OUT_NAME}.wav ${(N / SR).toFixed(1)}s written, peak ${(20 * Math.log10(peak)).toFixed(1)}dB pre-norm`);
