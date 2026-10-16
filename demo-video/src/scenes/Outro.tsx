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

export const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: f - 8, fps, config: { damping: 16, stiffness: 90 } });
  const tag = spring({ frame: f - 55, fps, config: SPRING.soft });
  const ring = interpolate(f, [10, 70], [0.4, 1.6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ringFade = interpolate(f, [10, 70], [0.6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shimmer = interpolate(f, [70, 105], [-1, 1.6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const end = interpolate(f, [158, 178], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const badge = spring({ frame: f - 88, fps, config: SPRING.pop });
  const portrait = usePortrait();
  const ringBase = portrait ? 440 : 620;
  return (
    <AbsoluteFill style={{ opacity: end }}>
      <Bg />
      {/* pulse ring */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            position: 'absolute',
            width: ringBase * ring,
            height: ringBase * ring,
            borderRadius: '50%',
            border: `3px solid ${C.tint}`,
            opacity: ringFade,
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${C.blue}44, transparent 70%)`,
            opacity: logo,
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{ alignItems: 'center', justifyContent: 'center', gap: 30 }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: portrait ? 20 : 34,
            opacity: logo,
            transform: `scale(${0.8 + logo * 0.2})`,
          }}
        >
          <Icon
            name="shield"
            size={portrait ? 74 : 110}
            color={C.tint}
            strokeWidth={1.8}
          />
          <div style={{ position: 'relative', overflow: 'hidden' }}>
            <span
              style={{
                fontFamily: FONT,
                fontWeight: 900,
                fontSize: portrait ? 118 : 190,
                letterSpacing: -6,
                color: C.text,
                lineHeight: 1,
              }}
            >
              MAALAM
              <span style={{ color: C.tint }}>.</span>
            </span>
            {/* shimmer sweep */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: 160,
                left: `${shimmer * 100}%`,
                background:
                  'linear-gradient(100deg, transparent, rgba(255,255,255,0.28), transparent)',
                transform: 'skewX(-18deg)',
              }}
            />
          </div>
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: portrait ? 34 : 46,
            letterSpacing: portrait ? 8 : 12,
            color: C.tint,
            textTransform: 'uppercase',
            opacity: tag,
            transform: `translateY(${(1 - tag) * 24}px)`,
          }}
        >
          See what's real
        </div>
        {/* Play Store badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            marginTop: 26,
            border: `2px solid ${C.border}`,
            borderRadius: 18,
            padding: '16px 34px',
            background: `${C.card}dd`,
            opacity: badge,
            transform: `translateY(${(1 - badge) * 30}px) scale(${0.85 + badge * 0.15})`,
            boxShadow: `0 0 40px ${C.blue}44`,
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${C.tint}, ${C.blue})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="play" size={26} color="#fff" />
          </div>
          <div>
            <div
              style={{
                fontFamily: FONT,
                fontWeight: 600,
                fontSize: 19,
                letterSpacing: 3,
                color: C.textSecondary,
                textTransform: 'uppercase',
              }}
            >
              Coming soon to
            </div>
            <div
              style={{
                fontFamily: FONT,
                fontWeight: 800,
                fontSize: 32,
                color: C.text,
                letterSpacing: 0.5,
              }}
            >
              Google Play
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
