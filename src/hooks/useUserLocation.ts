import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import type { LngLat } from '../utils/geo';

export type PermissionState = 'checking' | 'granted' | 'denied' | 'unavailable';

/**
 * Requests foreground location permission (iOS "When In Use" / Android
 * fine+coarse) and keeps the user's coordinate up to date.
 */
export function useUserLocation() {
  const [permission, setPermission] = useState<PermissionState>('checking');
  const [coordinate, setCoordinate] = useState<LngLat | null>(null);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const sub = useRef<Location.LocationSubscription | null>(null);

  const startWatching = useCallback(async () => {
    try {
      // Not available on every platform (e.g. some browsers) — ignore failures.
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      if (last) setCoordinate([last.coords.longitude, last.coords.latitude]);

      sub.current?.remove();
      sub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 15, timeInterval: 5000 },
        (pos) => setCoordinate([pos.coords.longitude, pos.coords.latitude]),
      );
    } catch {
      setPermission('unavailable');
    }
  }, []);

  const request = useCallback(async () => {
    const enabled = await Location.hasServicesEnabledAsync().catch(() => true);
    if (!enabled) {
      setPermission('unavailable');
      return;
    }
    const res = await Location.requestForegroundPermissionsAsync();
    setCanAskAgain(res.canAskAgain);
    if (res.status === 'granted') {
      setPermission('granted');
      await startWatching();
    } else {
      setPermission('denied');
    }
  }, [startWatching]);

  /** If the user can't be prompted again, send them to system settings. */
  const requestOrOpenSettings = useCallback(async () => {
    if (!canAskAgain && Platform.OS !== 'web') {
      await Linking.openSettings();
    } else {
      await request();
    }
  }, [canAskAgain, request]);

  useEffect(() => {
    request();
    // Re-check when returning from Settings.
    const appSub = AppState.addEventListener('change', async (s) => {
      if (s !== 'active') return;
      const cur = await Location.getForegroundPermissionsAsync();
      if (cur.status === 'granted') {
        setPermission((prev) => {
          if (prev !== 'granted') startWatching();
          return 'granted';
        });
      }
    });
    return () => {
      appSub.remove();
      sub.current?.remove();
    };
  }, [request, startWatching]);

  return { permission, coordinate, requestOrOpenSettings };
}
