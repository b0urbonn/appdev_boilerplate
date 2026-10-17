// Searchable multi-select list of installed launcher apps, like a game
// launcher's picker. Selection is a list of {packageName, label}.
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SmoothPressable } from '@/components/SmoothPressable';
import { getInstalledApps, type InstalledApp } from '@/monitor/native';
import type { MonitoredApp } from '@/settings/storage';
import { useTheme } from '@/theme';

export function AppPicker({
  selected,
  onChange,
}: {
  selected: MonitoredApp[];
  onChange: (apps: MonitoredApp[]) => void;
}) {
  const theme = useTheme();
  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    getInstalledApps()
      .then((list) => { if (active) setApps(list); })
      .catch(() => { if (active) setApps([]); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return apps ?? [];
    return (apps ?? []).filter(
      (a) => a.label.toLowerCase().includes(q) || a.packageName.includes(q)
    );
  }, [apps, query]);

  const toggle = (app: InstalledApp) => {
    const exists = selected.some((s) => s.packageName === app.packageName);
    onChange(
      exists
        ? selected.filter((s) => s.packageName !== app.packageName)
        : [...selected, { packageName: app.packageName, label: app.label }]
    );
  };

  if (apps === null) {
    return <ActivityIndicator color={theme.tint} style={{ marginTop: 32 }} />;
  }

  return (
    <View style={styles.flex}>
      <View
        style={[
          styles.search,
          { backgroundColor: theme.inputBackground, borderColor: theme.border },
        ]}
      >
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          accessibilityLabel="Search apps"
          value={query}
          onChangeText={setQuery}
          placeholder="Search apps"
          placeholderTextColor={theme.textSecondary}
          style={[styles.searchInput, { color: theme.text }]}
        />
      </View>
      <Text style={[styles.count, { color: theme.textSecondary }]}>
        {selected.length} selected
      </Text>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.packageName}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const checked = selected.some((s) => s.packageName === item.packageName);
          return (
            <SmoothPressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              onPress={() => toggle(item)}
              style={[
                styles.row,
                { backgroundColor: checked ? theme.card : 'transparent' },
              ]}
            >
              <Image source={{ uri: item.iconUri }} style={styles.icon} />
              <View style={styles.flex}>
                <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }} numberOfLines={1}>
                  {item.packageName}
                </Text>
              </View>
              <Ionicons
                name={checked ? 'checkbox' : 'square-outline'}
                size={22}
                color={checked ? theme.tint : theme.textSecondary}
              />
            </SmoothPressable>
          );
        }}
        ListEmptyComponent={
          <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 24 }}>
            No apps found.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  count: { fontSize: 13, marginVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  icon: { width: 40, height: 40, borderRadius: 8 },
  label: { fontSize: 15, fontWeight: '500' },
});
