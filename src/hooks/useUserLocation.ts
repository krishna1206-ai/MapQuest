import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { LatLng } from '../utils/geo';

export function useUserLocation() {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [heading, setHeading] = useState(0);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let sub: Location.LocationSubscription | undefined;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setDenied(true);
        return;
      }
      const update = (l: Location.LocationObject) => {
        setLocation({ latitude: l.coords.latitude, longitude: l.coords.longitude });
        if (l.coords.heading != null && l.coords.heading >= 0) setHeading(l.coords.heading);
      };
      try {
        update(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      } catch {
        // Fall through to the watcher; it reports as soon as a fix arrives.
      }
      const s = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 10 },
        update,
      );
      if (cancelled) s.remove();
      else sub = s;
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  return { location, heading, denied };
}
