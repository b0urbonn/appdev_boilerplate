import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { C, FONT, SPRING, usePortrait } from '../theme';
import { Bg } from '../components/Bg';
import { Icon } from '../components/PhoneFrame';

const Line: React.FC<{
  text: string;
  icon: 'user' | 'cloud' | 'wifiOff' | 'clock';
  at: number;
  positive?: boolean;
  compact?: boolean;
}> = ({ text, icon, at, positive, compact }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: SPRING.slam });
  const mark = interpolate(f, [at + 12, at + 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const accent = positive ? C.success : C.danger;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 24 : 36,
        opacity: s,
      }}
    >
      <div
        style={{
          width: compact ? 80 : 104,
          height: compact ? 80 : 104,
          borderRadius: 26,
          background: `${accent}1c`,
          border: `2px solid ${accent}55`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${0.6 + s * 0.4})`,
          position: 'relative',
        }}
      >
        <Icon name={icon} size={compact ? 40 : 52} color={accent} />
        {positive && mark > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: -10,
              right: -10,
              width: 40,
              height: 40,
              borderRadius: 20,
              background: C.success,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `3px solid ${C.bg}`,
              transform: `scale(${mark})`,
            }}
          >
            <Icon name="check" size={22} color="#0E0E12" strokeWidth={3.4} />
          </div>
        )}
      </div>
      <div style={{ position: 'relative' }}>
        <span
          style={{
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: compact ? 64 : 92,
            letterSpacing: -2,
            color: C.text,
            opacity: 0.95,
          }}
        >
          {text}
        </span>
        {!positive && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: '54%',
              height: 8,
              width: `${mark * 100}%`,
              background: C.danger,
              borderRadius: 4,
              boxShadow: `0 0 18px ${C.danger}88`,
            }}
          />
        )}
      </div>
    </div>
  );
};

export const Trust: React.FC = () => {
  const f = useCurrentFrame();
  const portrait = usePortrait();
  const fadeOut = interpolate(f, [172, 188], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <Bg accent={C.dangerDeep} accent2={C.success} />
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          gap: portrait ? 30 : 44,
        }}
      >
        <Line text="No account" icon="user" at={14} compact={portrait} />
        <Line text="No uploads" icon="cloud" at={52} compact={portrait} />
        <Line text="Local history" icon="clock" at={88} positive compact={portrait} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
