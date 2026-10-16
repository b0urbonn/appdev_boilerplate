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

const LessonCard: React.FC<{
  title: string;
  mins: number;
  bullets: string[];
  icon: 'eye' | 'play' | 'book';
  color: string;
  at: number;
  tilt: number;
  compact?: boolean;
}> = ({ title, mins, bullets, icon, color, at, tilt, compact }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: SPRING.pop });
  return (
    <div
      style={{
        width: compact ? 560 : 480,
        background: C.card,
        border: `1.5px solid ${C.border}`,
        borderRadius: 24,
        padding: compact ? '18px 26px' : '26px 30px',
        opacity: s,
        transform: `translateY(${(1 - s) * 90}px) rotate(${(1 - s) * tilt + tilt * 0.15}deg)`,
        transformOrigin: 'bottom center',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          marginBottom: compact ? 10 : 16,
        }}
      >
        <div
          style={{
            width: compact ? 52 : 62,
            height: compact ? 52 : 62,
            borderRadius: 16,
            background: `${color}22`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={compact ? 28 : 34} color={color} />
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: compact ? 26 : 30,
              color: C.text,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 600,
              fontSize: 20,
              color: C.textSecondary,
              marginTop: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Icon name="clock" size={18} color={C.textSecondary} />
            {mins} min read
          </div>
        </div>
      </div>
      {bullets.map((b, i) => {
        const bs = spring({ frame: f - at - 14 - i * 8, fps, config: SPRING.pop });
        return (
          <div
            key={b}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 0',
              opacity: bs,
              transform: `translateX(${(1 - bs) * 24}px)`,
            }}
          >
            <Icon name="check" size={20} color={color} strokeWidth={3} />
            <span
              style={{
                fontFamily: FONT,
                fontWeight: 500,
                fontSize: compact ? 19 : 21,
                color: C.textSecondary,
              }}
            >
              {b}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const Learn: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const head = spring({ frame: f - 10, fps, config: SPRING.slam });
  const fadeOut = interpolate(f, [172, 188], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <Bg accent={C.warning} accent2={C.blue} />
      <AbsoluteFill
        style={{
          flexDirection: portrait ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: portrait ? 40 : 110,
          textAlign: portrait ? 'center' : 'left',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: portrait ? 14 : 22,
            alignItems: portrait ? 'center' : 'flex-start',
          }}
        >
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 900,
              fontSize: portrait ? 84 : 110,
              letterSpacing: -4,
              lineHeight: 1.02,
              color: C.text,
              opacity: head,
              transform: `translateY(${(1 - head) * 50}px) scale(${0.8 + head * 0.2})`,
            }}
          >
            TRAIN
            <br />
            <span style={{ color: C.tint }}>YOUR EYE</span>
          </div>
          <div
            style={{
              fontFamily: FONT,
              fontSize: portrait ? 26 : 30,
              fontWeight: 500,
              color: C.textSecondary,
              opacity: head,
              maxWidth: 480,
              lineHeight: 1.4,
            }}
          >
            Offline lessons on spotting
            <br />
            manipulated media.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: portrait ? 18 : 24 }}>
          <LessonCard
            title="Spotting deepfake faces"
            mins={3}
            bullets={['Blinking & lip-sync clues', 'Edges, light and skin texture']}
            icon="eye"
            color={C.tint}
            at={30}
            tilt={-3}
            compact={portrait}
          />
          <LessonCard
            title="Voice-clone red flags"
            mins={2}
            bullets={['Flat emotion, odd pacing', 'Verify before you trust a voice']}
            icon="play"
            color={C.warning}
            at={55}
            tilt={2}
            compact={portrait}
          />
          <LessonCard
            title="Checking viral posts"
            mins={4}
            bullets={['Source-check in seconds', 'Reverse-image habits']}
            icon="book"
            color={C.success}
            at={80}
            tilt={-2}
            compact={portrait}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
