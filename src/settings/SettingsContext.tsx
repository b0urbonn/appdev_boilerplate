import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  resetSettings,
  saveSetting,
  type Settings,
} from './storage';

interface SettingsContextValue {
  settings: Settings;
  ready: boolean;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  /** Erase all settings and return to defaults (which shows onboarding). */
  reset: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  ready: false,
  update: () => {},
  reset: async () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .catch((error) => console.warn('Unable to load settings:', error))
      .finally(() => setReady(true));
  }, []);

  // Update state immediately and persist in the background.
  const update = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
      void saveSetting(key, value);
    },
    []
  );

  const reset = useCallback(async () => {
    await resetSettings();
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, ready, update, reset }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
