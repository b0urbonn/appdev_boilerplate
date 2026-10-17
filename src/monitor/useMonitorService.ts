import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getMonitorServiceStatus } from '@/monitor/native';

/** Android may bind after the app resumes. Keep permission and connection live. */
export function useMonitorService() {
  const [status, setStatus] = useState(getMonitorServiceStatus);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const refresh = () => {
      const next = getMonitorServiceStatus();
      setStatus(previous => previous.enabled === next.enabled && previous.connected === next.connected && previous.sharing === next.sharing ? previous : next);
    };
    const start = () => {
      if (timer) clearInterval(timer);
      refresh();
      timer = setInterval(refresh, 1000);
    };
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') start();
      else { if (timer) clearInterval(timer); timer = undefined; }
    });
    return () => { if (timer) clearInterval(timer); sub.remove(); };
  }, []);
  return status;
}
