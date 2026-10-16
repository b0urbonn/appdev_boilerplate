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

const NodeCard: React.FC<{
  label: string;
  sub: string;
  icon: React.ReactNode;
  at: number;
  color: string;
  dashed?: boolean;
  compact?: boolean;
}> = ({ label, sub, icon, at, color, dashed, compact }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: SPRING.pop });
  const pulse = 0.7 + Math.sin(f * 0.12) * 0.3;
  return (
    <div
      style={{
        width: compact ? 300 : 300,
        background: C.card,
        border: dashed ? `2px dashed ${color}88` : `2px solid ${color}88`,
        borderRadius: 24,
        padding: compact ? '22px 0 18px' : '34px 0 28px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: compact ? 9 : 14,
        opacity: s,
        transform: `translateY(${(1 - s) * 50}px) scale(${0.85 + s * 0.15})`,
        boxShadow: `0 0 ${40 * pulse}px ${color}33`,
      }}
    >
      <div
        style={{
          width: compact ? 66 : 92,
          height: compact ? 66 : 92,
          borderRadius: compact ? 18 : 24,
          background: `${color}1c`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
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
          fontWeight: 600,
          fontSize: compact ? 16 : 20,
          letterSpacing: 3,
          color,
          textTransform: 'uppercase',
        }}
      >
        {sub}
      </div>
    </div>
  );
};

const Connector: React.FC<{
  at: number;
  dashed?: boolean;
  color: string;
  width?: number;
  vertical?: boolean;
}> = ({ at, dashed, color, width = 180, vertical }) => {
  const f = useCurrentFrame();
  const grow = interpolate(f, [at, at + 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const t = ((f - at) % 40) / 40; // traveling dot 0..1
  if (vertical) {
    return (
      <div style={{ position: 'relative', width: 4, height: width }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 2,
            background: dashed
              ? `repeating-linear-gradient(180deg, ${color} 0 12px, transparent 12px 22px)`
              : color,
            transform: `scaleY(${grow})`,
            transformOrigin: 'top',
            opacity: dashed ? 0.7 : 1,
          }}
        />
        {grow >= 1 && !dashed && (
          <div
            style={{
              position: 'absolute',
              left: -5,
              top: t * (width - 14),
              width: 14,
              height: 14,
              borderRadius: 7,
              background: '#fff',
              boxShadow: `0 0 16px ${color}`,
            }}
          />
        )}
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', width, height: 4 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 2,
          background: dashed
            ? `repeating-linear-gradient(90deg, ${color} 0 12px, transparent 12px 22px)`
            : color,
          transform: `scaleX(${grow})`,
          transformOrigin: 'left',
          opacity: dashed ? 0.7 : 1,
        }}
      />
      {grow >= 1 && !dashed && (
        <div
          style={{
            position: 'absolute',
            top: -5,
            left: t * (width - 14),
            width: 14,
            height: 14,
            borderRadius: 7,
            background: '#fff',
            boxShadow: `0 0 16px ${color}`,
          }}
        />
      )}
    </div>
  );
};

export const OnDevice: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const enter = spring({ frame: f, fps, config: SPRING.soft });
  const lock = spring({ frame: f - 175, fps, config: SPRING.pop });
  const fadeOut = interpolate(f, [252, 268], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const iconSz = portrait ? 40 : 52;
  const chain = (
    <>
      <NodeCard
        label="Phone"
        sub="your media"
        icon={<Icon name="shield" size={iconSz} color={C.textSecondary} />}
        at={12}
        color={C.border}
        compact={portrait}
      />
      <Connector at={40} color={C.success} width={portrait ? 96 : 180} vertical={portrait} />
      <NodeCard
        label="On-device"
        sub="AI · default"
        icon={<Icon name="chip" size={iconSz} color={C.success} />}
        at={58}
        color={C.success}
        compact={portrait}
      />
      <Connector at={92} dashed color={C.tint} width={portrait ? 96 : 180} vertical={portrait} />
      <NodeCard
        label="Cloud AI"
        sub="opt-in"
        icon={<Icon name="cloud" size={iconSz} color={C.tint} />}
        at={108}
        color={C.tint}
        dashed
        compact={portrait}
      />
    </>
  );
  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <Bg accent={C.success} accent2={C.blue} />
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          gap: portrait ? 30 : 60,
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: portrait ? 24 : 26,
            fontWeight: 700,
            letterSpacing: 6,
            color: C.textSecondary,
            textTransform: 'uppercase',
            opacity: enter,
            textAlign: 'center',
            padding: '0 30px',
          }}
        >
          Two engines. Your choice.
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: portrait ? 'column' : 'row',
            alignItems: 'center',
            gap: portrait ? 6 : 44,
          }}
        >
          {chain}
        </div>
        {/* privacy lock */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            opacity: lock,
            transform: `translateY(${(1 - lock) * 30}px)`,
          }}
        >
          <div
            style={{
              width: portrait ? 56 : 64,
              height: portrait ? 56 : 64,
              borderRadius: 32,
              background: `${C.success}1e`,
              border: `1.5px solid ${C.success}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="lock" size={portrait ? 28 : 32} color={C.success} />
          </div>
          <span
            style={{
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: portrait ? 30 : 36,
              color: C.text,
              letterSpacing: 0.5,
            }}
          >
            Your data stays yours.
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
