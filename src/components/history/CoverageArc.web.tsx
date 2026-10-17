import React, { useEffect, useState } from 'react';
import type { CoverageArcProps } from './CoverageArc';

export function CoverageArc({ radius, color, value, goal, reduceMotion }: CoverageArcProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const fraction = mounted ? Math.max(0, Math.min(1, value / goal)) : 0;
  return <circle cx={80} cy={80} r={radius} stroke={color} strokeWidth={15} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - fraction} transform="rotate(-90 80 80)" style={{ opacity: fraction ? 1 : 0, transition: `stroke-dashoffset ${reduceMotion ? 80 : 1100}ms cubic-bezier(.32,.72,0,1)` }} />;
}
