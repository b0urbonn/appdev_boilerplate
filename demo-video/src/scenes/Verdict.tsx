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

const RING_AT = 20;
const RING_DUR = 70;
const STAMP_AT = 105;

const ReportRow: React.FC<{ label: string; value: string; color: string; at: number }> = ({
  label,
  value,
  color,
  at,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: SPRING.pop });
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${C.border}`,
        padding: '16px 4px',
        opacity: s,
        transform: `translateY(${(1 - s) * 20}px)`,
      }}
    >
      <span style={{ fontFamily: FONT, fontSize: 26, fontWeight: 500, color: C.textSecondary }}>
        {label}
      </span>
      <span style={{ fontFamily: FONT, fontSize: 26, fontWeight: 800, color }}>{value}</span>
    </div>
  );
};

export const Verdict: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const enter = spring({ frame: f, fps, config: SPRING.soft });
  const score = interpolate(f, [RING_AT, RING_AT + RING_DUR], [0, 0.87], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const stamp = spring({ frame: f - STAMP_AT, fps, config: SPRING.slam });
  const share = spring({ frame: f - 150, fps, config: SPRING.pop });
  const fadeOut = interpolate(f, [212, 228], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const ringSize = portrait ? 360 : 440;
  const R = portrait ? 137 : 170;
  const circ = 2 * Math.PI * R;
  const ringColor = score > 0.66 ? C.danger : score > 0.4 ? C.warning : C.success;

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <Bg accent={C.warning} accent2={C.dangerDeep} />
      <AbsoluteFill
        style={{
          flexDirection: portrait ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: portrait ? 54 : 130,
        }}
      >
        {/* Score ring */}
        <div
          style={{
            position: 'relative',
            width: ringSize,
            height: ringSize,
            opacity: enter,
            transform: `scale(${0.85 + enter * 0.15})`,
          }}
        >
          <svg
            width={ringSize}
            height={ringSize}
            viewBox={`0 0 ${ringSize} ${ringSize}`}
          >
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={R}
              fill="none"
              stroke={C.border}
              strokeWidth={26}
            />
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={R}
              fill="none"
              stroke={ringColor}
              strokeWidth={26}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - score)}
              transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
              style={{ filter: `drop-shadow(0 0 18px ${ringColor}88)` }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontFamily: FONT,
                fontWeight: 900,
                fontSize: portrait ? 104 : 130,
                color: ringColor,
                letterSpacing: -4,
                lineHeight: 1,
              }}
            >
              {Math.round(score * 100)}
              <span style={{ fontSize: portrait ? 44 : 54 }}>%</span>
            </div>
            <div
              style={{
                fontFamily: FONT,
                fontWeight: 600,
                fontSize: 26,
                letterSpacing: 4,
                color: C.textSecondary,
                marginTop: 8,
              }}
            >
              RISK SCORE
            </div>
          </div>
          {/* stamp */}
          {f > STAMP_AT && (
            <div
              style={{
                position: 'absolute',
                bottom: -18,
                left: '50%',
                fontFamily: FONT,
                fontWeight: 900,
                fontSize: 40,
                letterSpacing: 6,
                color: C.danger,
                border: `5px solid ${C.danger}`,
                borderRadius: 12,
                padding: '8px 22px',
                background: 'rgba(14,14,18,0.92)',
                opacity: stamp,
                transform: `translateX(-50%) rotate(-6deg) scale(${1.5 - stamp * 0.5})`,
              }}
            >
              HIGH RISK
            </div>
          )}
        </div>

        {/* Report card */}
        <div
          style={{
            width: 540,
            background: C.card,
            border: `1.5px solid ${C.border}`,
            borderRadius: 24,
            padding: '30px 34px',
            opacity: enter,
            transform: `translateX(${(1 - enter) * 70}px)`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 30,
              color: C.text,
              marginBottom: 14,
            }}
          >
            Verdict report
          </div>
          <ReportRow label="Manipulation" value="Detected" color={C.danger} at={55} />
          <ReportRow label="AI artifacts" value="Strong" color={C.danger} at={72} />
          <ReportRow label="Metadata" value="Stripped" color={C.warning} at={89} />
          <ReportRow label="Engine" value="On-device AI" color={C.tint} at={106} />
          {/* share row */}
          <div
            style={{
              marginTop: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              border: `1.5px solid ${C.tint}66`,
              borderRadius: 14,
              padding: '14px 0',
              background: `${C.blue}22`,
              opacity: share,
              transform: `scale(${0.8 + share * 0.2})`,
            }}
          >
            <Icon name="share" size={26} color={C.tint} />
            <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 24, color: C.tint }}>
              Share report
            </span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
