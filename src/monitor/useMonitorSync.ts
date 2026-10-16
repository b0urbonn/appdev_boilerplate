// Keeps the native monitor service's SharedPreferences config in sync with
// the persisted settings (protected apps, master switch, provider rate).
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { setMonitorConfig } from '@/monitor/native';
import { useSettings } from '@/settings/SettingsContext';

export function useMonitorSync() {
  const { settings, ready } = useSettings();

  useEffect(() => {
    if (!ready || Platform.OS !== 'android') return;
    const apps = settings.monitoredApps;
    setMonitorConfig({
      enabled: settings.onboarded && settings.monitoringEnabled && apps.length > 0,
      packages: apps.map((a) => a.packageName),
      labels: Object.fromEntries(apps.map((a) => [a.packageName, a.label])),
      minIntervalMs: settings.provider === 'local' ? 15000 : 8000,
    });
  }, [
    ready,
    settings.onboarded,
    settings.monitoringEnabled,
    settings.monitoredApps,
    settings.provider,
  ]);
}
