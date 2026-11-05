import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage, isAbortError, searchNearby, searchNearbyMany } from '../services/places';
import type { Place } from '../services/types';
import { FILTER_CATEGORIES, type CategoryId } from '../utils/categories';
import { CONFIG } from '../utils/config';
import { debounce } from '../utils/debounce';
import { haversineMeters, type LngLat } from '../utils/geo';

/** Skip refetching when the map center moved less than this. */
const MIN_MOVE_METERS = 250;

/**
 * Loads places around the visible map center. Region changes are debounced
 * and in-flight requests are aborted when a newer one starts.
 */
export function useNearbyPlaces(filter: CategoryId | 'all') {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const center = useRef<LngLat | null>(null);
  const lastFetched = useRef<{ center: LngLat; filter: string } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const fetchNow = useCallback(async (force = false) => {
    const c = center.current;
    if (!c) return;
    const f = filterRef.current;
    const prev = lastFetched.current;
    if (!force && prev && prev.filter === f && haversineMeters(prev.center, c) < MIN_MOVE_METERS) return;

    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const data =
        f === 'all'
          ? await searchNearbyMany(c, FILTER_CATEGORIES, ctrl.signal)
          : await searchNearby(c, f, ctrl.signal);
      if (ctrl.signal.aborted) return;
      lastFetched.current = { center: c, filter: f };
      setPlaces(data);
      setSearched(true);
    } catch (e) {
      if (isAbortError(e) || ctrl.signal.aborted) return;
      setError(errorMessage(e));
    } finally {
      if (controller.current === ctrl) setLoading(false);
    }
  }, []);

  const debouncedFetch = useMemo(() => debounce(() => fetchNow(false), CONFIG.regionDebounceMs), [fetchNow]);

  /** Call from the map's onRegionDidChange. */
  const onRegionChanged = useCallback(
    (c: LngLat) => {
      center.current = c;
      debouncedFetch();
    },
    [debouncedFetch],
  );

  // Changing the filter refetches immediately.
  useEffect(() => {
    debouncedFetch.cancel();
    fetchNow(true);
  }, [filter, fetchNow, debouncedFetch]);

  useEffect(
    () => () => {
      debouncedFetch.cancel();
      controller.current?.abort();
    },
    [debouncedFetch],
  );

  const retry = useCallback(() => fetchNow(true), [fetchNow]);

  return { places, loading, error, searched, onRegionChanged, retry };
}
