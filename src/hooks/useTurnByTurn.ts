import { useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import type { Route } from '../api';
import { distanceToPath, haversineMiles, spokenDistance, type LatLng } from '../utils/geo';

const ANNOUNCE_MI = 0.25;
const REACHED_MI = 0.02;
const OFF_ROUTE_MI = 0.06;
const REROUTE_COOLDOWN_MS = 15000;

type Args = {
  route: Route | null;
  location: LatLng | null;
  active: boolean;
  muted: boolean;
  onOffRoute: () => void;
  onArrive: () => void;
};

export function useTurnByTurn({ route, location, active, muted, onOffRoute, onArrive }: Args) {
  // Step progress is tied to the route it belongs to, so a new route starts at step 0.
  const [progress, setProgress] = useState({ route, step: 0 });
  let step = progress.route === route ? progress.step : 0;

  let next = route?.maneuvers[step + 1];
  let distanceToNext = next && location ? haversineMiles(location, next.start) : 0;
  if (active && next && location && distanceToNext < REACHED_MI) {
    step += 1;
    next = route?.maneuvers[step + 1];
    distanceToNext = next ? haversineMiles(location, next.start) : 0;
  }
  if (progress.route !== route || progress.step !== step) {
    setProgress({ route, step });
  }

  const announced = useRef({ route, steps: new Set<number>() });
  const lastReroute = useRef(0);

  useEffect(() => {
    if (!active) {
      Speech.stop();
      return;
    }
    if (!muted && route?.maneuvers[0]) Speech.speak(route.maneuvers[0].narrative, { language: 'en-US' });
    // Only on start/stop of navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!active || !route || !location) return;
    const say = (text: string) => {
      if (!muted) Speech.speak(text, { language: 'en-US' });
    };
    if (announced.current.route !== route) announced.current = { route, steps: new Set() };

    const dest = route.shape.at(-1) ?? route.maneuvers.at(-1)?.start;
    if (dest && haversineMiles(location, dest) < REACHED_MI) {
      say('You have arrived at your destination.');
      onArrive();
      return;
    }

    if (next && distanceToNext < ANNOUNCE_MI && !announced.current.steps.has(step + 1)) {
      announced.current.steps.add(step + 1);
      const n = next.narrative;
      say(`In ${spokenDistance(distanceToNext)}, ${n.charAt(0).toLowerCase()}${n.slice(1)}`);
    }

    if (
      route.shape.length > 1 &&
      distanceToPath(location, route.shape) > OFF_ROUTE_MI &&
      Date.now() - lastReroute.current > REROUTE_COOLDOWN_MS
    ) {
      lastReroute.current = Date.now();
      say('Rerouting.');
      onOffRoute();
    }
  }, [location, active, route, step, next, distanceToNext, muted, onArrive, onOffRoute]);

  let remainingMiles = 0;
  let remainingSeconds = 0;
  if (route) {
    const after = route.maneuvers.slice(step + 1).reduce((sum, m) => sum + m.distance, 0);
    remainingMiles = distanceToNext + after;
    const secs = route.realTime ?? route.time;
    remainingSeconds = route.distance > 0 ? (secs * remainingMiles) / route.distance : 0;
  }

  return { step, next, distanceToNext, remainingMiles, remainingSeconds };
}
