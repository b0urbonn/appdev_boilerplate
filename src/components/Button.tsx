import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, type PressableProps } from 'react-native';
import { useTheme } from '@/theme';
import { SmoothPressable } from './SmoothPressable';

type Icon = React.ComponentProps<typeof Ionicons>['name'];
type Variant = 'primary' | 'secondary' | 'destructive' | 'destructiveSecondary';

export function Button({
  label,
  variant = 'primary',
  icon,
  loading = false,
  disabled,
  style,
  ...props
}: Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: Variant;
  icon?: Icon;
  loading?: boolean;
  style?: PressableProps['style'];
}) {
  const theme = useTheme();
  const secondary = variant === 'secondary' || variant === 'destructiveSecondary';
  const foreground = variant === 'destructiveSecondary' ? theme.danger : secondary ? theme.text : '#FFFFFF';
  const background = secondary ? theme.buttonSecondary : variant === 'destructive' ? theme.buttonDanger : theme.buttonPrimary;
  return (
    <SmoothPressable
      {...props}
      disabled={disabled || loading}
      accessibilityLabel={props.accessibilityLabel ?? label}
      accessibilityState={{ ...props.accessibilityState, busy: loading }}
      style={(state) => [
        styles.button,
        { backgroundColor: background, opacity: disabled ? 0.5 : state.pressed ? 0.88 : 1 },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {loading ? <ActivityIndicator color={foreground} /> : icon ? <Ionicons name={icon} size={20} color={foreground} accessible={false} /> : null}
      <Text style={[styles.label, { color: foreground }]}>{label}</Text>
    </SmoothPressable>
  );
}

export function IconButton({ icon, label, variant = 'secondary', loading = false, style, ...props }: Omit<PressableProps, 'children'> & {
  icon: Icon;
  label: string;
  variant?: 'primary' | 'secondary' | 'destructive';
  loading?: boolean;
}) {
  const theme = useTheme();
  const background = variant === 'primary' ? theme.buttonPrimary : variant === 'destructive' ? theme.buttonDanger : theme.buttonSecondary;
  const foreground = variant === 'secondary' ? theme.text : '#FFFFFF';
  return (
    <SmoothPressable
      {...props}
      accessibilityLabel={label}
      disabled={props.disabled || loading}
      accessibilityState={{ ...props.accessibilityState, busy: loading }}
      hitSlop={4}
      style={(state) => [styles.iconButton, { backgroundColor: background, opacity: props.disabled ? 0.5 : state.pressed ? 0.85 : 1 }, typeof style === 'function' ? style(state) : style]}
    >
      {loading ? <ActivityIndicator color={foreground} /> : <Ionicons name={icon} size={22} color={foreground} accessible={false} />}
    </SmoothPressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, minWidth: 48, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontSize: 16, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  iconButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
