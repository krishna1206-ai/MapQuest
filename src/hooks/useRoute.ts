import { useCallback, useEffect, useState } from 'react';
import { errorMessage, getRoute, isAbortError } from '../services/places';
import type { Route, TravelMode } from '../services/types';
import type { LngLat } from '../utils/geo';

export function useRoute(from: LngLat | null, to: LngLat, mode: TravelMode) {
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // Only refetch when the origin moves meaningfully (rounded to ~100 m).
  const fromKey = from ? `${from[0].toFixed(3)},${from[1].toFixed(3)}` : null;

  useEffect(() => {
    if (!from) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    getRoute(from, to, mode, ctrl.signal)
      .then((r) => setRoute(r))
      .catch((e) => {
        if (isAbortError(e)) return;
        setRoute(null);
        setError(errorMessage(e));
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromKey, to[0], to[1], mode, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { route, loading, error, retry };
}
