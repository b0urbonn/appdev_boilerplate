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

const Bubble: React.FC<{
  text: string;
  at: number;
  mine?: boolean;
  accent?: string;
}> = ({ text, at, mine, accent }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: SPRING.pop });
  return (
    <div
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '82%',
        background: mine ? C.blue : C.card,
        border: mine ? 'none' : `1.5px solid ${C.border}`,
        borderRadius: 18,
        borderBottomRightRadius: mine ? 4 : 18,
        borderBottomLeftRadius: mine ? 18 : 4,
        padding: '14px 18px',
        fontFamily: FONT,
        fontSize: 19,
        fontWeight: 500,
        lineHeight: 1.45,
        color: C.text,
        opacity: s,
        transform: `translateY(${(1 - s) * 26}px) scale(${0.85 + s * 0.15})`,
        transformOrigin: mine ? 'bottom right' : 'bottom left',
      }}
    >
      {accent ? (
        <>
          <span style={{ color: accent, fontWeight: 800 }}>{accent}</span> {text}
        </>
      ) : (
        text
      )}
    </div>
  );
};

const Typing: React.FC<{ at: number; until: number }> = ({ at, until }) => {
  const f = useCurrentFrame();
  if (f < at || f > until) return null;
  return (
    <div
      style={{
        alignSelf: 'flex-start',
        background: C.card,
        border: `1.5px solid ${C.border}`,
        borderRadius: 18,
        borderBottomLeftRadius: 4,
        padding: '14px 18px',
        display: 'flex',
        gap: 7,
      }}
    >
      {[0, 1, 2].map((i) => {
        const b = Math.sin(f * 0.3 + i * 1.1) * 0.5 + 0.5;
        return (
          <div
            key={i}
            style={{
              width: 9,
              height: 9,
              borderRadius: 5,
              background: C.textSecondary,
              opacity: 0.35 + b * 0.65,
              transform: `translateY(${-b * 5}px)`,
            }}
          />
        );
      })}
    </div>
  );
};

export const Chat: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: SPRING.soft });
  const badge = spring({ frame: f - 50, fps, config: SPRING.pop });
  const badgePulse = 0.6 + Math.sin(f * 0.2) * 0.4;
  const fadeOut = interpolate(f, [152, 168], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const portrait = usePortrait();
  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <Bg accent={C.blue} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ opacity: enter, transform: `scale(${0.9 + enter * 0.1})`, position: 'relative' }}>
          <PhoneFrame width={portrait ? 420 : 380} tilt={0}>
            <div
              style={{
                flex: 1,
                padding: '18px 16px 26px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div
                style={{
                  fontFamily: FONT,
                  fontWeight: 700,
                  fontSize: 20,
                  color: C.text,
                  textAlign: 'center',
                  paddingBottom: 8,
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                assistant
              </div>
              <Bubble text="Is this clip AI-generated?" at={25} mine />
              <Typing at={48} until={84} />
              <Bubble
                text="The lip-sync artifacts and audio spectrum suggest it's synthetic. Risk: 82%."
                accent="Likely fake —"
                at={85}
              />
              <Bubble text="Can I share the report?" at={118} mine />
            </div>
          </PhoneFrame>
          {/* offline badge */}
          <div
            style={{
              position: 'absolute',
              top: -26,
              right: -46,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: C.card,
              border: `2px solid ${C.success}`,
              borderRadius: 999,
              padding: '12px 26px',
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 24,
              letterSpacing: 3,
              color: C.success,
              opacity: badge,
              transform: `scale(${0.6 + badge * 0.4})`,
              boxShadow: `0 0 ${30 * badgePulse}px ${C.success}55`,
            }}
          >
            <Icon name="wifiOff" size={28} color={C.success} />
            OFFLINE
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
