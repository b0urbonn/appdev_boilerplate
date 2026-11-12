import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export interface NetworkState {
  /** False only when we're sure the device has no connectivity. */
  isOnline: boolean;
}

export function useNetwork(): NetworkState {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isInternetReachable can be null while still being determined.
      const online =
        state.isConnected !== false && state.isInternetReachable !== false;
      setIsOnline(online);
    });
    return unsubscribe;
  }, []);

  return { isOnline };
}
