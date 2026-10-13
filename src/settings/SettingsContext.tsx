import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { getModelStatus, subscribeModelStatus } from '@/ai/local';
import { refreshLocalDeviceResources, scanLocalDevice, type LocalDeviceCheck, type LocalDeviceReport } from '@/ai/deviceCapabilities';
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
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  /** Erase all settings and return to defaults (which shows onboarding). */
  reset: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  ready: false,
  update: async () => {},
  reset: async () => {},
});

const LocalDeviceContext = createContext<{
  localDevice: LocalDeviceCheck;
  refreshLocalDevice: () => void;
}>({ localDevice: { state: 'idle' }, refreshLocalDevice: () => {} });

export function useLocalDevice() { return useContext(LocalDeviceContext); }

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  const [ready, setReady] = useState(false);
  const [localDevice, setLocalDevice] = useState<LocalDeviceCheck>({ state: 'idle' });
  const [deviceScan, setDeviceScan] = useState(0);
  const lastDeviceReport = useRef<LocalDeviceReport | null>(null);
  const refreshLocalDevice = useCallback(() => {
    setLocalDevice(previous => previous.state === 'ready'
      ? { state: 'ready', report: previous.report, refreshing: true }
      : { state: 'checking' });
    setDeviceScan((scan) => scan + 1);
  }, []);

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .catch((error) => console.warn('Unable to load settings:', error))
      .finally(() => setReady(true));
  }, []);

  // Hardware is scanned on selection; RAM/storage are sampled independently
  // every two seconds in the foreground, without reinitializing GPU drivers.
  useEffect(() => {
    if (!ready || settings.provider !== 'local') return;
    let active = true;
    let foreground = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    let busy = false;
    let queued = false;
    let report: LocalDeviceReport | null = lastDeviceReport.current;
    let scanHardware = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const poll = async () => {
      if (!active || !foreground) return;
      if (busy) { queued = true; return; }
      busy = true;
      try {
        const latest = !scanHardware && report ? await refreshLocalDeviceResources(report) : await scanLocalDevice();
        if (active && foreground) {
          report = latest;
          lastDeviceReport.current = latest;
          scanHardware = false;
          setLocalDevice({ state: 'ready', report: latest });
        }
      } catch (error) {
        if (active && foreground) {
          const message = error instanceof Error ? error.message : 'Hardware check failed.';
          setLocalDevice(report ? { state: 'ready', report, refreshError: message } : { state: 'error', message });
        }
      } finally {
        busy = false;
        if (queued) { queued = false; void poll(); }
      }
    };
    const start = () => {
      if (timer) clearInterval(timer);
      void poll();
      timer = setInterval(() => void poll(), 2000);
    };
    if (foreground) start();
    const appState = AppState.addEventListener('change', (state) => {
      foreground = state === 'active';
      if (foreground) start();
      else { if (timer) clearInterval(timer); timer = undefined; }
    });
    let modelState = getModelStatus().state;
    const unsubscribe = subscribeModelStatus((status) => {
      if (modelState !== status.state) { modelState = status.state; void poll(); }
    });
    return () => { active = false; if (timer) clearInterval(timer); appState.remove(); unsubscribe(); };
  }, [ready, settings.provider, deviceScan]);

  // Update state immediately and persist in the background.
  const update = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      if (settingsRef.current[key] === value) return Promise.resolve();
      if (key === 'systemPrompt') {
        // Explicit Save applies the prompt only after it reaches storage.
        return saveSetting(key, value).then(() => setSettings(prev => ({ ...prev, [key]: value })));
      }
      if (key === 'provider' && value === 'local') setLocalDevice(previous => previous.state === 'ready'
        ? { ...previous, refreshing: true, refreshError: undefined }
        : { state: 'checking' });
      setSettings((prev) => ({ ...prev, [key]: value }));
      return saveSetting(key, value);
    },
    []
  );

  const reset = useCallback(async () => {
    await resetSettings();
    setSettings(DEFAULT_SETTINGS);
    lastDeviceReport.current = null;
    setLocalDevice({ state: 'idle' });
  }, []);

  const settingsValue = useMemo(() => ({ settings, ready, update, reset }), [settings, ready, update, reset]);
  const deviceValue = useMemo(() => ({ localDevice, refreshLocalDevice }), [localDevice, refreshLocalDevice]);
  return (
    <SettingsContext.Provider value={settingsValue}>
      <LocalDeviceContext.Provider value={deviceValue}>{children}</LocalDeviceContext.Provider>
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
