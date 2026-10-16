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
import { PhoneFrame, Icon } from '../components/PhoneFrame';

const SCAN_START = 30;
const SCAN_END = 110; // sweep duration
const FINDING_AT = 118;

// Fake "photo" — abstract face-ish gradient composition
const Photo: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: `linear-gradient(160deg, #2a3550 0%, #1a1f33 55%, #12141f 100%)`,
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: '18%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 150,
        height: 150,
        borderRadius: '50%',
        background: `radial-gradient(circle at 38% 32%, #7f8dbb, #454f77 65%, #2b3050)`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '38%',
        background: `linear-gradient(180deg, transparent, #0d2f52 40%, #0a3d6e)`,
      }}
    />
    {[...Array(5)].map((_, i) => (
      <div
        key={i}
        style={{
          position: 'absolute',
          bottom: 30 + i * 26,
          left: -40 + i * 60,
          width: 220,
          height: 12,
          borderRadius: 6,
          background: 'rgba(112,183,255,0.18)',
          transform: `rotate(${-6 + i * 3}deg)`,
        }}
      />
    ))}
  </div>
);

const PipelineRow: React.FC<{
  label: string;
  at: number;
  doneAt: number;
  compact?: boolean;
}> = ({ label, at, doneAt, compact }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: SPRING.pop });
  const done = spring({ frame: f - doneAt, fps, config: SPRING.pop });
  const spin = f * 8;
  const sz = compact ? 44 : 52;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 14 : 18,
        opacity: s,
        transform: `translateX(${(1 - s) * 60}px)`,
      }}
    >
      <div
        style={{
          width: sz,
          height: sz,
          borderRadius: sz / 2,
          border: `3px solid ${done >= 1 ? C.success : C.border}`,
          borderTopColor: done >= 1 ? C.success : C.tint,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: done >= 1 ? 'none' : `rotate(${spin}deg)`,
          background: C.card,
        }}
      >
        {done >= 1 && <Icon name="check" size={compact ? 22 : 26} color={C.success} />}
      </div>
      <div
        style={{
          fontFamily: FONT,
          fontSize: compact ? 27 : 32,
          fontWeight: 600,
          color: done >= 1 ? C.text : C.textSecondary,
        }}
      >
        {label}
      </div>
    </div>
  );
};

export const Scan: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const enter = spring({ frame: f, fps, config: SPRING.soft });
  const sweep = interpolate(f, [SCAN_START, SCAN_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const finding = spring({ frame: f - FINDING_AT, fps, config: SPRING.slam });
  const pulse = 0.5 + Math.sin(f * 0.35) * 0.5;
  const fadeOut = interpolate(f, [240, 258], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const PW = portrait ? 290 : 400; // phone width
  const screenH = PW * 2.05 - 52;

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <Bg accent={C.blue} />
      <AbsoluteFill
        style={{
          flexDirection: portrait ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: portrait ? 46 : 130,
        }}
      >
        {/* Phone with scan effect */}
        <div style={{ opacity: enter, transform: `translateX(${(1 - enter) * -90}px)` }}>
          <PhoneFrame width={PW} tilt={5}>
            <div style={{ position: 'relative', flex: 1, overflow: 'hidden', margin: 14, borderRadius: 18 }}>
              <Photo />
              {/* analysis grid */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage:
                    'linear-gradient(rgba(112,183,255,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(112,183,255,0.14) 1px, transparent 1px)',
                  backgroundSize: '34px 34px',
                }}
              />
              {/* scan line */}
              {f >= SCAN_START && f <= SCAN_END + 6 && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: sweep * screenH,
                    height: 4,
                    background: C.tint,
                    boxShadow: `0 0 24px 6px ${C.tint}aa`,
                  }}
                />
              )}
              {/* scanned tint */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  height: sweep * screenH,
                  background: 'rgba(112,183,255,0.08)',
                }}
              />
              {/* detection brackets */}
              {f > FINDING_AT && (
                <div
                  style={{
                    position: 'absolute',
                    top: '20%',
                    left: '24%',
                    width: '52%',
                    height: '34%',
                    opacity: finding,
                    transform: `scale(${1.25 - finding * 0.25})`,
                  }}
                >
                  {[
                    { top: 0, left: 0, bt: true, bl: true },
                    { top: 0, right: 0, bt: true, br: true },
                    { bottom: 0, left: 0, bb: true, bl: true },
                    { bottom: 0, right: 0, bb: true, br: true },
                  ].map((pos, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        width: 34,
                        height: 34,
                        borderTop: pos.bt ? `4px solid ${C.danger}` : 'none',
                        borderBottom: pos.bb ? `4px solid ${C.danger}` : 'none',
                        borderLeft: pos.bl ? `4px solid ${C.danger}` : 'none',
                        borderRight: pos.br ? `4px solid ${C.danger}` : 'none',
                        top: pos.top,
                        bottom: pos.bottom,
                        left: pos.left,
                        right: pos.right,
                      }}
                    />
                  ))}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      border: `2px solid ${C.danger}${Math.round(40 + pulse * 60).toString(16)}`,
                    }}
                  />
                </div>
              )}
            </div>
            {/* verdict chip under image */}
            <div style={{ padding: '0 16px 20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: `${C.dangerDeep}33`,
                  border: `1.5px solid ${C.dangerDeep}`,
                  borderRadius: 14,
                  padding: '12px 16px',
                  opacity: finding,
                  transform: `translateY(${(1 - finding) * 18}px)`,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    background: C.danger,
                    boxShadow: `0 0 12px ${C.danger}`,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONT,
                    fontWeight: 700,
                    fontSize: 19,
                    color: C.danger,
                  }}
                >
                  AI-generated · 94%
                </span>
              </div>
            </div>
          </PhoneFrame>
        </div>

        {/* Pipeline steps */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: portrait ? 26 : 44,
            alignItems: portrait ? 'center' : 'flex-start',
          }}
        >
          <div
            style={{
              fontFamily: FONT,
              fontSize: portrait ? 22 : 24,
              fontWeight: 700,
              letterSpacing: 5,
              color: C.tint,
              textTransform: 'uppercase',
              opacity: enter,
            }}
          >
            Manipulation scan
          </div>
          <PipelineRow label="Extracting features" at={20} doneAt={55} compact={portrait} />
          <PipelineRow label="Analyzing artifacts" at={60} doneAt={105} compact={portrait} />
          <PipelineRow label="Scoring" at={110} doneAt={FINDING_AT} compact={portrait} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
