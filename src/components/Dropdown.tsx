import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Theme } from '@/theme';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

/** A tappable field that opens a list of options in a modal. */
export function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  theme,
}: {
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  theme: Theme;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.block}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={[styles.field, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}
      >
        <View style={styles.flex}>
          <Text style={{ color: theme.text, fontSize: 15 }}>{selected?.label ?? value}</Text>
          {selected?.description ? (
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{selected.description}</Text>
          ) : null}
        </View>
        <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: theme.card }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  style={[styles.option, { borderColor: theme.border }]}
                >
                  <View style={styles.flex}>
                    <Text style={{ color: theme.text, fontSize: 15 }}>{item.label}</Text>
                    {item.description ? (
                      <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                  {item.value === value && (
                    <Ionicons name="checkmark" size={18} color={theme.tint} />
                  )}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 4, marginBottom: 8 },
  flex: { flex: 1 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: { borderRadius: 14, padding: 12, maxHeight: '70%' },
  sheetTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6, paddingHorizontal: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
});
