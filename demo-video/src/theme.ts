import { loadFont } from '@remotion/google-fonts/Inter';
import { useVideoConfig } from 'remotion';

const { fontFamily } = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
});

export const FONT = fontFamily;

// Mirrors src/theme.ts (dark) in the app.
export const C = {
  bg: '#0E0E12',
  card: '#1C1C22',
  text: '#F2F2F5',
  textSecondary: '#9A9AA3',
  border: '#2E2E38',
  tint: '#70B7FF',
  blue: '#0A65C7',
  danger: '#FF8885',
  dangerDeep: '#E5484D',
  success: '#66BB6A',
  warning: '#FFA726',
};

export const SPRING = {
  pop: { damping: 12, stiffness: 200, mass: 0.6 },
  soft: { damping: 20, stiffness: 120, mass: 1 },
  slam: { damping: 10, stiffness: 260, mass: 0.9 },
};

export const usePortrait = () => {
  const { width, height } = useVideoConfig();
  return height > width;
};
