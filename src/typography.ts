import { StyleSheet } from 'react-native';

/** Shared system-font scale; no screen-specific font family. */
export const typography = StyleSheet.create({
  screenTitle: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  cardTitle: { fontSize: 17, lineHeight: 23, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 21 },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18 },
  chip: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  statistic: { fontSize: 26, lineHeight: 32, fontWeight: '700', fontVariant: ['tabular-nums'] },
});

/** Match React Native Text when rendering a native HTML control on web. */
export const webSystemFontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
