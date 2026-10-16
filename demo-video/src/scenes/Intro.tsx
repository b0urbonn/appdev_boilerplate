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

const Wordmark: React.FC<{ at: number; size?: number }> = ({ at, size = 150 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex' }}>
      {'MAALAM'.split('').map((ch, i) => {
        const s = spring({
          frame: f - at - i * 3,
          fps,
          config: SPRING.pop,
        });
        return (
          <span
            key={i}
            style={{
              fontFamily: FONT,
              fontWeight: 900,
              fontSize: size,
              letterSpacing: -4,
              background: `linear-gradient(160deg, ${C.tint} 20%, ${C.blue} 80%)`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              opacity: s,
              transform: `translateY(${(1 - s) * 46}px) scale(${0.7 + s * 0.3})`,
              display: 'inline-block',
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
};

const Pill: React.FC<{ text: string; at: number; size?: number }> = ({
  text,
  at,
  size = 26,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: SPRING.pop });
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: FONT,
        fontWeight: 600,
        fontSize: size,
        letterSpacing: 2,
        color: C.tint,
        border: `1.5px solid ${C.tint}66`,
        borderRadius: 999,
        padding: '10px 24px',
        background: `${C.blue}22`,
        opacity: s,
        transform: `scale(${0.7 + s * 0.3})`,
      }}
    >
      {text}
    </div>
  );
};

// Abstract app UI inside the phone
const AppUI: React.FC = () => {
  const f = useCurrentFrame();
  const blink = Math.sin(f * 0.15) > 0 ? 1 : 0.35;
  return (
    <div style={{ flex: 1, padding: 18, gap: 14, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name="shield" size={30} color={C.tint} />
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, color: C.text }}>maalam</div>
        <div
          style={{
            marginLeft: 'auto',
            width: 9,
            height: 9,
            borderRadius: 5,
            background: C.success,
            opacity: blink,
          }}
        />
      </div>
      {[0.85, 0.6, 0.75].map((w, i) => (
        <div
          key={i}
          style={{
            alignSelf: i % 2 ? 'flex-end' : 'flex-start',
            width: `${w * 100}%`,
            height: 44,
            borderRadius: 14,
            background: i % 2 ? C.blue : C.card,
            opacity: 0.9,
          }}
        />
      ))}
      <div
        style={{
          marginTop: 'auto',
          height: 60,
          borderRadius: 16,
          background: `linear-gradient(90deg, ${C.blue}, ${C.tint})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: 20,
          color: '#fff',
        }}
      >
        <Icon name="image" size={24} color="#fff" />
        Scan image
      </div>
    </div>
  );
};

export const Intro: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const phone = spring({ frame: f - 6, fps, config: SPRING.soft });
  const tag = spring({ frame: f - 60, fps, config: SPRING.soft });
  const fadeOut = interpolate(f, [215, 233], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <Bg />
      <AbsoluteFill
        style={{
          flexDirection: portrait ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: portrait ? 42 : 110,
          textAlign: portrait ? 'center' : 'left',
        }}
      >
        {portrait ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
              <Wordmark at={18} size={118} />
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 30,
                  fontWeight: 500,
                  color: C.textSecondary,
                  lineHeight: 1.35,
                  opacity: tag,
                  transform: `translateY(${(1 - tag) * 24}px)`,
                }}
              >
                Offline-first detector for deepfakes
                <br />
                and harmful content.
              </div>
            </div>
            <div
              style={{
                opacity: phone,
                transform: `translateY(${(1 - phone) * 140}px)`,
              }}
            >
              <PhoneFrame width={290}>
                <AppUI />
              </PhoneFrame>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Pill text="ANDROID" at={80} size={22} />
              <Pill text="ON-DEVICE AI" at={90} size={22} />
              <Pill text="OFFLINE-FIRST" at={100} size={22} />
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                opacity: phone,
                transform: `translateY(${(1 - phone) * 140}px)`,
              }}
            >
              <PhoneFrame width={330}>
                <AppUI />
              </PhoneFrame>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
              <Wordmark at={18} />
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 34,
                  fontWeight: 500,
                  color: C.textSecondary,
                  lineHeight: 1.35,
                  maxWidth: 560,
                  opacity: tag,
                  transform: `translateY(${(1 - tag) * 24}px)`,
                }}
              >
                Offline-first detector for deepfakes
                <br />
                and harmful content.
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                <Pill text="ANDROID" at={80} />
                <Pill text="ON-DEVICE AI" at={90} />
                <Pill text="OFFLINE-FIRST" at={100} />
              </div>
            </div>
          </>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
