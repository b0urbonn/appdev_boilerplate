import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { C } from '../theme';

export const Bg: React.FC<{ accent?: string; accent2?: string }> = ({
  accent = C.blue,
  accent2 = C.tint,
}) => {
  const f = useCurrentFrame();
  const drift1 = f * 0.6;
  const drift2 = f * 0.4;
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
      {/* faint dot grid */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${C.border} 1.2px, transparent 1.2px)`,
          backgroundSize: '42px 42px',
          opacity: 0.35,
        }}
      />
      {/* drifting glows */}
      <div
        style={{
          position: 'absolute',
          width: 1400,
          height: 1400,
          left: -400 + Math.sin(drift1 / 60) * 120,
          top: -550 + Math.cos(drift2 / 60) * 90,
          background: `radial-gradient(circle, ${accent}55, transparent 62%)`,
          filter: 'blur(60px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 1200,
          height: 1200,
          right: -450 + Math.cos(drift2 / 60) * 110,
          bottom: -500 + Math.sin(drift1 / 60) * 80,
          background: `radial-gradient(circle, ${accent2}33, transparent 60%)`,
          filter: 'blur(70px)',
        }}
      />
      {/* vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)',
        }}
      />
      {/* scene fade-in */}
      <AbsoluteFill
        style={{
          background: C.bg,
          opacity: interpolate(f, [0, 6], [1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      />
    </AbsoluteFill>
  );
};
