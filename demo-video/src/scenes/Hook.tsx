import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  random,
} from 'remotion';
import { C, FONT, SPRING, usePortrait } from '../theme';
import { Bg } from '../components/Bg';

const GlitchWord: React.FC<{ word: string; color: string; at: number; size?: number }> = ({
  word,
  color,
  at,
  size = 190,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f - at, fps, config: SPRING.slam });
  // glitch jitter for ~30 frames after landing
  const g = f - at;
  const glitching = g > 6 && g < 42;
  const jx = glitching ? (random(`jx${f}`) - 0.5) * 14 : 0;
  const jy = glitching ? (random(`jy${f}`) - 0.5) * 8 : 0;
  const split = glitching ? 6 : 0;
  return (
    <div
      style={{
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: size,
        letterSpacing: -4,
        color,
        opacity: enter,
        transform: `translate(${jx}px,${jy}px) scale(${0.6 + enter * 0.4})`,
        textShadow: glitching
          ? `${-split}px 0 ${C.tint}, ${split}px 0 ${C.danger}`
          : `0 0 60px ${color}66`,
        position: 'relative',
      }}
    >
      {word}
      {glitching && (
        <div
          style={{
            position: 'absolute',
            top: `${random(`c${f}`) * 100}%`,
            left: 0,
            right: 0,
            height: 6 + random(`h${f}`) * 10,
            background: `${color}88`,
            mixBlendMode: 'screen',
          }}
        />
      )}
    </div>
  );
};

export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const eyebrow = spring({ frame: f - 8, fps, config: SPRING.soft });
  const fadeOut = interpolate(f, [150, 168], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const portrait = usePortrait();
  const slash = interpolate(f, [46, 56], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wordSize = portrait ? 150 : 190;
  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <Bg accent={C.dangerDeep} accent2={C.blue} />
      <AbsoluteFill
        style={{ justifyContent: 'center', alignItems: 'center', gap: portrait ? 24 : 10 }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: portrait ? 34 : 44,
            fontWeight: 500,
            color: C.textSecondary,
            letterSpacing: 4,
            opacity: eyebrow,
            transform: `translateY(${(1 - eyebrow) * 20}px)`,
            textTransform: 'uppercase',
            textAlign: 'center',
            padding: '0 40px',
          }}
        >
          What if your phone could tell
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: portrait ? 'column' : 'row',
            alignItems: 'center',
            gap: portrait ? 18 : 40,
          }}
        >
          <GlitchWord word="REAL" color={C.success} at={28} size={wordSize} />
          {/* slash divider */}
          <div
            style={
              portrait
                ? {
                    width: 260,
                    height: 8,
                    background: `linear-gradient(90deg, ${C.tint}, ${C.danger})`,
                    transform: `scaleX(${slash})`,
                    transformOrigin: 'center',
                    borderRadius: 4,
                    boxShadow: `0 0 30px ${C.tint}`,
                  }
                : {
                    width: 8,
                    height: 210,
                    background: `linear-gradient(${C.tint}, ${C.danger})`,
                    transform: `rotate(18deg) scaleY(${slash})`,
                    transformOrigin: 'center',
                    borderRadius: 4,
                    boxShadow: `0 0 30px ${C.tint}`,
                  }
            }
          />
          <GlitchWord word="FAKE" color={C.danger} at={44} size={wordSize} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
