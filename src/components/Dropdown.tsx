import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { Theme } from '@/theme';
import { Popup } from './Popup';
import { IconButton } from './Button';
import { SmoothPressable } from './SmoothPressable';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

export function Dropdown<T extends string>({ label, value, options, onChange, theme }: {
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  theme: Theme;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <View style={styles.block}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <SmoothPressable accessibilityLabel={`${label}: ${selected?.label ?? value}`} accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} style={[styles.field, { backgroundColor: theme.buttonSecondary }]}>
        <Text style={[styles.flex, { color: theme.text, fontSize: 16, fontWeight: '500' }]}>{selected?.label ?? value}</Text>
        <Ionicons name="chevron-down" size={18} color={theme.textSecondary} accessible={false} />
      </SmoothPressable>
      <Popup visible={open} onClose={() => setOpen(false)} label={label} style={styles.sheet}>
            <View style={styles.heading}>
              <Text accessibilityRole="header" style={[styles.sheetTitle, styles.flex, { color: theme.text }]}>{label}</Text>
              <IconButton icon="close" label="Close options" onPress={() => setOpen(false)} />
            </View>
            <FlatList data={options} keyExtractor={(option) => option.value} renderItem={({ item }) => {
              const checked = item.value === value;
              return (
                <SmoothPressable accessibilityRole="radio" accessibilityLabel={item.description ? `${item.label}. ${item.description}` : item.label} accessibilityState={{ checked }} onPress={() => { onChange(item.value); setOpen(false); }} style={[styles.option, { backgroundColor: checked ? theme.buttonSecondary : theme.card }]}>
                  <View style={styles.flex}>
                    <Text style={{ color: theme.text, fontSize: 16, fontWeight: checked ? '600' : '400' }}>{item.label}</Text>
                    {item.description && <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 4 }}>{item.description}</Text>}
                  </View>
                  {checked && <Ionicons name="checkmark" size={22} color={theme.tint} accessible={false} />}
                </SmoothPressable>
              );
            }} />
      </Popup>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 4, marginBottom: 8 },
  flex: { flex: 1 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  field: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  sheet: { borderRadius: 18, padding: 12, maxHeight: '75%' },
  heading: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '600', paddingHorizontal: 4 },
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginVertical: 3, gap: 10 },
});
