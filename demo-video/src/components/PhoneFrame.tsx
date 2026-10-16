import React from 'react';
import { C } from '../theme';

export const PhoneFrame: React.FC<{
  width?: number;
  tilt?: number;
  glow?: string;
  children?: React.ReactNode;
}> = ({ width = 360, tilt = -6, glow = 'rgba(10,101,199,0.35)', children }) => {
  const h = width * 2.05;
  return (
    <div
      style={{
        width,
        height: h,
        borderRadius: width * 0.11,
        background: '#050507',
        border: `3px solid ${C.border}`,
        boxShadow: `0 40px 90px rgba(0,0,0,0.6), 0 0 80px ${glow}`,
        transform: `perspective(1400px) rotateY(${tilt}deg)`,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* notch */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          width: width * 0.32,
          height: 22,
          borderRadius: 12,
          background: '#000',
          border: `1px solid ${C.border}`,
          zIndex: 5,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: C.bg,
          paddingTop: 52,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  );
};

// Minimal inline-SVG icon set (stroke style, no deps).
export const Icon: React.FC<{
  name:
    | 'shield'
    | 'lock'
    | 'cloud'
    | 'chip'
    | 'wifiOff'
    | 'user'
    | 'check'
    | 'share'
    | 'image'
    | 'bell'
    | 'clock'
    | 'book'
    | 'eye'
    | 'play';
  size?: number;
  color?: string;
  strokeWidth?: number;
}> = ({ name, size = 48, color = C.tint, strokeWidth = 2.4 }) => {
  const paths: Record<string, React.ReactNode> = {
    shield: (
      <>
        <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
        <path d="M9 12l2.2 2.2L15.5 10" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 018 0v3" />
      </>
    ),
    cloud: <path d="M7 18a4.5 4.5 0 01-.9-8.9 5.5 5.5 0 0110.8 1.6A4 4 0 0117.5 18H7z" />,
    chip: (
      <>
        <rect x="7" y="7" width="10" height="10" rx="2" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
      </>
    ),
    wifiOff: (
      <>
        <path d="M5 9a11 11 0 014.4-2.6M19 9a11 11 0 00-4-2.4M8.5 12.5a6.5 6.5 0 012.4-1.3M15.5 12.5a6.5 6.5 0 00-2-1.2M12 17.5h.01" />
        <path d="M3 3l18 18" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8.5" r="3.8" />
        <path d="M4.5 20a7.5 7.5 0 0115 0" />
      </>
    ),
    check: <path d="M4 12.5l5.5 5.5L20 6.5" />,
    share: (
      <>
        <circle cx="6" cy="12" r="2.6" />
        <circle cx="17.5" cy="5.5" r="2.6" />
        <circle cx="17.5" cy="18.5" r="2.6" />
        <path d="M8.4 10.8l6.8-4M8.4 13.2l6.8 4" />
      </>
    ),
    image: (
      <>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
        <circle cx="9" cy="10" r="2" />
        <path d="M5 18l5-5 3.5 3.5L16 13l4 4" />
      </>
    ),
    bell: (
      <>
        <path d="M6 9a6 6 0 0112 0c0 4.5 2 6 2 6H4s2-1.5 2-6z" />
        <path d="M10 20a2.2 2.2 0 004 0" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3.5 2.2" />
      </>
    ),
    book: (
      <>
        <path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5v-15z" />
        <path d="M4 20.5A2.5 2.5 0 016.5 18H20" />
      </>
    ),
    eye: (
      <>
        <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    play: <path d="M7.5 4.8L19 12l-11.5 7.2z" fill={color} stroke="none" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
};
