import React, { createContext, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

const ReduceMotionContext = createContext(true);

export function AccessibilityPreferences({ children }: { children: React.ReactNode }) {
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduceMotion(value);
    }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; listener.remove(); };
  }, []);
  return <ReduceMotionContext.Provider value={reduceMotion}>{children}</ReduceMotionContext.Provider>;
}

export function useReduceMotion() { return useContext(ReduceMotionContext); }
