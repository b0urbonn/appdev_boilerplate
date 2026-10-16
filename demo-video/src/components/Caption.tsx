import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { C, FONT, usePortrait } from '../theme';

export const Caption: React.FC<{ text: string; from: number; to: number }> = ({
  text,
  from,
  to,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  if (f < from || f > to) return null;
  const local = f - from;
  const enter = spring({ frame: local, fps, config: { damping: 18, stiffness: 220 } });
  const exit = interpolate(f, [to - 6, to], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        position: 'absolute',
        bottom: portrait ? 120 : 52,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity: Math.min(enter, exit),
        transform: `translateY(${(1 - enter) * 22}px)`,
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontWeight: 500,
          fontSize: portrait ? 36 : 31,
          letterSpacing: 0.2,
          color: C.text,
          background: 'rgba(10,10,16,0.66)',
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: '10px 26px',
          backdropFilter: 'blur(6px)',
          maxWidth: portrait ? '90%' : '82%',
          textAlign: 'center',
        }}
      >
        {text}
      </div>
    </div>
  );
};
