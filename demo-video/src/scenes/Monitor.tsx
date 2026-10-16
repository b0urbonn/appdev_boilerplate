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

const ALERT_AT = 130;
const FLAGGED_TILE = 4; // index of the app that gets flagged

const APPS = [
  { label: 'Chats', hue: '#3b82f6' },
  { label: 'Social', hue: '#a855f7' },
  { label: 'Videos', hue: '#ec4899' },
  { label: 'Mail', hue: '#14b8a6' },
  { label: 'Feed', hue: '#f97316' },
  { label: 'Gallery', hue: '#84cc16' },
];

const AppTile: React.FC<{
  label: string;
  hue: string;
  at: number;
  flagged: boolean;
  compact?: boolean;
}> = ({ label, hue, at, flagged, compact }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: SPRING.pop });
  const pulse = flagged ? 0.6 + Math.sin(f * 0.35) * 0.4 : 0;
  const tile = compact ? 74 : 92;
  return (
    <div
      style={{
        width: compact ? 118 : 150,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        opacity: s,
        transform: `scale(${0.6 + s * 0.4})`,
      }}
    >
      <div
        style={{
          width: tile,
          height: tile,
          borderRadius: 26,
          background: `linear-gradient(140deg, ${hue}, ${hue}88)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 30,
          color: '#fff',
          border: flagged ? `3px solid ${C.danger}` : '3px solid transparent',
          boxShadow: flagged
            ? `0 0 ${30 + pulse * 30}px ${C.danger}aa`
            : '0 8px 24px rgba(0,0,0,0.4)',
          position: 'relative',
        }}
      >
        {label[0]}
        {/* protected check */}
        {f > at + 30 && !flagged && (
          <div
            style={{
              position: 'absolute',
              bottom: -8,
              right: -8,
              width: compact ? 28 : 34,
              height: compact ? 28 : 34,
              borderRadius: 17,
              background: C.success,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `3px solid ${C.bg}`,
            }}
          >
            <Icon name="check" size={18} color="#0E0E12" strokeWidth={3.4} />
          </div>
        )}
      </div>
      <span
        style={{
          fontFamily: FONT,
          fontWeight: 600,
          fontSize: compact ? 18 : 21,
          color: flagged ? C.danger : C.textSecondary,
        }}
      >
        {label}
      </span>
    </div>
  );
};

export const Monitor: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const enter = spring({ frame: f, fps, config: SPRING.soft });
  const alert = spring({ frame: f - ALERT_AT, fps, config: SPRING.slam });
  const sweepDeg = f * 2.2;
  const fadeOut = interpolate(f, [252, 268], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <Bg accent={C.dangerDeep} accent2={C.blue} />
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          gap: 56,
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 6,
            color: C.textSecondary,
            textTransform: 'uppercase',
            opacity: enter,
            transform: `translateY(${(1 - enter) * -20}px)`,
          }}
        >
          Background protection
        </div>

        {/* radar circle + app grid */}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              inset: -70,
              borderRadius: '50%',
              border: `1.5px solid ${C.border}`,
              overflow: 'hidden',
              opacity: enter,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `conic-gradient(from ${sweepDeg}deg, rgba(112,183,255,0.28), transparent 70deg)`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: '33%',
                borderRadius: '50%',
                border: `1px solid ${C.border}`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: '16.5%',
                borderRadius: '50%',
                border: `1px solid ${C.border}`,
              }}
            />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: portrait ? 26 : 44,
              padding: 20,
            }}
          >
            {APPS.map((a, i) => (
              <AppTile
                key={a.label}
                label={a.label}
                hue={a.hue}
                at={14 + i * 9}
                flagged={f > ALERT_AT && i === FLAGGED_TILE}
                compact={portrait}
              />
            ))}
          </div>
        </div>

        {/* alert banner */}
        {f > ALERT_AT && (
          <div
            style={{
              position: 'absolute',
              top: 90,
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              background: 'rgba(28,28,34,0.96)',
              border: `2px solid ${C.danger}`,
              borderRadius: 22,
              padding: '20px 34px',
              boxShadow: `0 20px 60px rgba(0,0,0,0.55), 0 0 50px ${C.dangerDeep}66`,
              opacity: alert,
              transform: `translateY(${(1 - alert) * -80}px) scale(${0.9 + alert * 0.1})`,
            }}
          >
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 16,
                background: `${C.dangerDeep}33`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="bell" size={32} color={C.danger} />
            </div>
            <div>
              <div
                style={{
                  fontFamily: FONT,
                  fontWeight: 800,
                  fontSize: portrait ? 27 : 30,
                  color: C.text,
                }}
              >
                Harmful content detected
              </div>
              <div
                style={{
                  fontFamily: FONT,
                  fontWeight: 500,
                  fontSize: portrait ? 20 : 23,
                  color: C.textSecondary,
                  marginTop: 2,
                }}
              >
                Feed app · threat flagged · tap to review
              </div>
            </div>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
