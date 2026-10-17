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
  loadError: string | null;
  retryLoad: () => void;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  /** Erase all settings and return to defaults (which shows onboarding). */
  reset: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  ready: false,
  loadError: null,
  retryLoad: () => {},
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
  const persistedSettings = useRef(settings);
  const pendingWrites = useRef(new Map<keyof Settings, Promise<void>>());
  const writeVersions = useRef(new Map<keyof Settings, number>());
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const retryLoad = useCallback(() => {
    setLoadError(null);
    setLoadAttempt(attempt => attempt + 1);
  }, []);
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
    // Never substitute unlocked defaults when saved security settings cannot be read.
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Settings load timed out.')), 12000);
    });
    Promise.race([loadSettings(), timeout])
      .then((loaded) => {
        if (!active) return;
        if (loaded.onboarded && !loaded.joinedAt) {
          loaded.joinedAt = Date.now();
          saveSetting('joinedAt', loaded.joinedAt).catch(() => {});
        }
        persistedSettings.current = loaded;
        settingsRef.current = loaded;
        setSettings(loaded);
        setReady(true);
      })
      .catch((error) => {
        if (__DEV__) console.warn('Unable to open saved settings:', error);
        if (active) setLoadError('Your saved settings could not be opened. Try again to safely continue.');
      })
      .finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); };
  }, [loadAttempt]);

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

  // Serialize writes per key so rapid toggles cannot persist out of order.
  // Security and explicit Save actions only take effect after durable storage succeeds.
  const update = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      if (settingsRef.current[key] === value && !pendingWrites.current.has(key)) return Promise.resolve();
      const version = (writeVersions.current.get(key) ?? 0) + 1;
      writeVersions.current.set(key, version);
      const durable = key === 'systemPrompt' || key === 'appLockEnabled' || key === 'appLockTimeout';
      const apply = (next: Settings[K]) => {
        settingsRef.current = { ...settingsRef.current, [key]: next };
        setSettings(settingsRef.current);
      };
      if (!durable) apply(value);
      if (key === 'provider' && value === 'local') setLocalDevice(previous => previous.state === 'ready'
        ? { ...previous, refreshing: true, refreshError: undefined }
        : { state: 'checking' });
      const preceding = pendingWrites.current.get(key) ?? Promise.resolve();
      const saved = preceding.catch(() => {}).then(() => saveSetting(key, value)).then(() => {
        persistedSettings.current = { ...persistedSettings.current, [key]: value };
        if (durable) apply(value);
      }).catch(error => {
        if (!durable && writeVersions.current.get(key) === version) apply(persistedSettings.current[key]);
        throw error;
      }).finally(() => {
        if (pendingWrites.current.get(key) === saved) pendingWrites.current.delete(key);
      });
      pendingWrites.current.set(key, saved);
      // Preserve rejection for awaiting callers while handling fire-and-forget updates.
      saved.catch(() => console.warn(`Unable to save setting "${String(key)}".`));
      return saved;
    }, []
  );

  const reset = useCallback(async () => {
    // A failed erase must not be reported as success or remove the in-memory lock.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async () => {
          await Promise.allSettled([...pendingWrites.current.values()]);
          await resetSettings();
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Settings erase timed out. Please try again.')), 8000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    persistedSettings.current = DEFAULT_SETTINGS;
    settingsRef.current = DEFAULT_SETTINGS;
    setSettings(DEFAULT_SETTINGS);
    lastDeviceReport.current = null;
    setLocalDevice({ state: 'idle' });
  }, []);

  const settingsValue = useMemo(() => ({ settings, ready, loadError, retryLoad, update, reset }), [settings, ready, loadError, retryLoad, update, reset]);
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
