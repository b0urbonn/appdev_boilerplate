import React from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

const FONT_FAMILIES: Record<string, string> = {
  normal: 'Manrope_400Regular',
  '400': 'Manrope_400Regular',
  '500': 'Manrope_500Medium',
  '600': 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  '700': 'Manrope_700Bold',
  '800': 'Manrope_800ExtraBold',
  '900': 'Manrope_800ExtraBold',
};

export function FlowText({ style, ...props }: TextProps) {
  const flattened = StyleSheet.flatten(style) as TextStyle | undefined;
  const { fontWeight, ...rest } = flattened ?? {};
  const fontFamily = FONT_FAMILIES[String(fontWeight ?? '400')] ?? FONT_FAMILIES['400'];
  return <Text {...props} style={[rest, { fontFamily }]} />;
}
