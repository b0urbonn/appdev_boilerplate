import { BlurTargetView, BlurView } from 'expo-blur';
import React, { createContext, useContext, useRef, useSyncExternalStore, type RefObject } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSettings } from '@/settings/SettingsContext';
import { useTheme } from '@/theme';
import { dismissConfirmation, getConfirmation, showMessage, subscribeConfirmation } from '@/utils/confirm';
import { useReduceMotion } from './AccessibilityPreferences';
import { Button } from './Button';

const BlurTargetContext = createContext<RefObject<View | null>>({ current: null });

/** One shared Android blur target; popup content stays sharp above it. */
export function PopupProvider({ children }: { children: React.ReactNode }) {
  const target = useRef<View | null>(null);
  return (
    <BlurTargetContext.Provider value={target}>
      <BlurTargetView ref={target} style={styles.flex}>{children}</BlurTargetView>
      <ConfirmationHost />
    </BlurTargetContext.Provider>
  );
}

export function Popup({ visible, onClose, children, style, label }: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  label: string;
}) {
  const target = useContext(BlurTargetContext);
  const theme = useTheme();
  const { settings } = useSettings();
  const reduceMotion = useReduceMotion();
  return (
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <BlurView pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" blurTarget={target} blurMethod="dimezisBlurView" intensity={65} tint={settings.theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Pressable accessibilityRole="button" accessibilityLabel={`Dismiss ${label}`} onPress={onClose} style={[StyleSheet.absoluteFill, styles.scrim]} />
        <View accessibilityViewIsModal accessibilityLabel={label} style={[styles.sheet, { backgroundColor: theme.card }, style]}>{children}</View>
      </View>
    </Modal>
  );
}

function ConfirmationHost() {
  const request = useSyncExternalStore(subscribeConfirmation, getConfirmation, getConfirmation);
  const theme = useTheme();
  if (!request) return null;
  const close = () => dismissConfirmation(request.id);
  const confirm = () => {
    close();
    void Promise.resolve().then(request.onConfirm).catch((error) => showMessage('Unable to complete action', error instanceof Error ? error.message : 'Please try again.'));
  };
  return (
    <Popup visible onClose={close} label={request.title}>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{request.title}</Text>
      <Text style={[styles.message, { color: theme.textSecondary }]}>{request.message}</Text>
      <View style={styles.actions}>
        {request.cancelable && <Button label="Cancel" variant="secondary" onPress={close} style={styles.flex} />}
        <Button label={request.confirmLabel} variant={request.destructive ? 'destructive' : 'primary'} onPress={confirm} style={styles.flex} />
      </View>
    </Popup>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', padding: 24 },
  scrim: { backgroundColor: 'rgba(0,0,0,0.14)' },
  sheet: { width: '100%', maxHeight: '80%', borderRadius: 18, padding: 18 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 10 },
  message: { fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
});
