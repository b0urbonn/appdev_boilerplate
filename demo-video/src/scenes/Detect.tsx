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
import { Icon } from '../components/PhoneFrame';

const Waveform: React.FC<{ bars?: number; height?: number }> = ({
  bars = 42,
  height = 120,
}) => {
  const f = useCurrentFrame();
  const hotLo = Math.floor(bars * 0.57);
  const hotHi = Math.floor(bars * 0.81);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, height }}>
      {[...Array(bars)].map((_, i) => {
        const base = 0.25 + random(`b${i}`) * 0.55;
        const wave = Math.sin(f * 0.22 + i * 0.55) * 0.5 + 0.5;
        const h = 8 + base * wave * (height - 16);
        const hot = i >= hotLo && i <= hotHi; // flagged region
        return (
          <div
            key={i}
            style={{
              width: 7,
              height: h,
              borderRadius: 4,
              background: hot ? C.danger : C.tint,
              opacity: hot ? 0.95 : 0.75,
            }}
          />
        );
      })}
    </div>
  );
};

const FlagCard: React.FC<{
  label: string;
  detail: string;
  color: string;
  at: number;
  compact?: boolean;
}> = ({ label, detail, color, at, compact }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: SPRING.pop });
  const stamp = spring({ frame: f - at - 28, fps, config: SPRING.slam });
  return (
    <div
      style={{
        width: compact ? 620 : 560,
        background: C.card,
        border: `1.5px solid ${C.border}`,
        borderLeft: `6px solid ${color}`,
        borderRadius: 18,
        padding: compact ? '18px 24px' : '24px 30px',
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 16 : 22,
        opacity: s,
        transform: `translateX(${(1 - s) * 90}px)`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: compact ? 48 : 56,
          height: compact ? 48 : 56,
          borderRadius: 14,
          background: `${color}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: compact ? 22 : 26,
        }}
      >
        !
      </div>
      <div>
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: compact ? 28 : 34,
            color: C.text,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: compact ? 20 : 24,
            color: C.textSecondary,
            marginTop: 4,
          }}
        >
          {detail}
        </div>
      </div>
      {f > at + 28 && (
        <div
          style={{
            position: 'absolute',
            right: 22,
            top: '50%',
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: compact ? 18 : 22,
            letterSpacing: 3,
            color,
            border: `3px solid ${color}`,
            borderRadius: 8,
            padding: '6px 14px',
            opacity: stamp,
            transform: `translateY(-50%) rotate(-8deg) scale(${1.6 - stamp * 0.6})`,
          }}
        >
          FLAGGED
        </div>
      )}
    </div>
  );
};

export const Detect: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const enter = spring({ frame: f, fps, config: SPRING.soft });
  const fadeOut = interpolate(f, [225, 243], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <Bg accent={C.dangerDeep} accent2={C.warning} />
      <AbsoluteFill
        style={{
          flexDirection: portrait ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: portrait ? 44 : 100,
        }}
      >
        {/* Inputs */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: portrait ? 24 : 34,
            opacity: enter,
            transform: `translateX(${(1 - enter) * -80}px)`,
          }}
        >
          {/* text clip */}
          <div
            style={{
              background: C.card,
              border: `1.5px solid ${C.border}`,
              borderRadius: 20,
              padding: '26px 30px',
              maxWidth: portrait ? 620 : 520,
              fontFamily: FONT,
              fontSize: portrait ? 25 : 28,
              fontWeight: 500,
              color: C.text,
              lineHeight: 1.5,
            }}
          >
            "send the money now or{' '}
            <span
              style={{
                background: `${C.dangerDeep}55`,
                color: C.danger,
                padding: '1px 8px',
                borderRadius: 6,
              }}
            >
              you'll regret it
            </span>
            "
          </div>
          {/* voice clip */}
          <div
            style={{
              background: C.card,
              border: `1.5px solid ${C.border}`,
              borderRadius: 20,
              padding: '26px 30px',
              display: 'flex',
              alignItems: 'center',
              gap: 22,
            }}
          >
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 29,
                background: C.blue,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: '18px solid #fff',
                  borderTop: '11px solid transparent',
                  borderBottom: '11px solid transparent',
                  marginLeft: 4,
                }}
              />
            </div>
            <Waveform bars={portrait ? 30 : 42} height={portrait ? 96 : 120} />
          </div>
        </div>

        {/* Flags */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: portrait ? 20 : 30 }}>
          <FlagCard label="Threat" detail="coercion · intimidation" color={C.danger} at={35} compact={portrait} />
          <FlagCard label="Scam pattern" detail="urgency · payment demand" color={C.warning} at={65} compact={portrait} />
          <FlagCard label="Hate speech" detail="targeted group slur" color={C.dangerDeep} at={95} compact={portrait} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
