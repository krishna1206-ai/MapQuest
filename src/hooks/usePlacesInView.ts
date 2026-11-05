import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchPois, type Bounds, type Poi } from '../api/pois';
import type { LatLng } from '../utils/geo';

export type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };

// Show places for the whole visible map, down to roughly a whole-city view (about zoom 11+).
const MAX_LAT_DELTA = 0.35;
const DEBOUNCE_MS = 700;
const CACHE_LIMIT = 6000;

const boundsOf = (r: Region, pad = 1): Bounds => ({
  south: r.latitude - (r.latitudeDelta / 2) * pad,
  north: r.latitude + (r.latitudeDelta / 2) * pad,
  west: r.longitude - (r.longitudeDelta / 2) * pad,
  east: r.longitude + (r.longitudeDelta / 2) * pad,
});

const contains = (outer: Bounds, inner: Bounds) =>
  inner.south >= outer.south && inner.north <= outer.north && inner.west >= outer.west && inner.east <= outer.east;

const inBounds = (b: Bounds, p: LatLng) =>
  p.latitude >= b.south && p.latitude <= b.north && p.longitude >= b.west && p.longitude <= b.east;

/**
 * Named places (hotels, hospitals, food, shops…) around the visible map area.
 * Fetches a padded area so small pans reuse what is loaded, and keeps a cache across pans.
 */
export function usePlacesInView(region: Region | null, enabled: boolean): Poi[] {
  const [cache, setCache] = useState<ReadonlyMap<string, Poi>>(new Map());
  const loaded = useRef<Bounds[]>([]);
  const active = enabled && region != null && region.latitudeDelta <= MAX_LAT_DELTA;

  const places = useMemo(() => {
    if (!active || !region) return [];
    const near = boundsOf(region, 2);
    return [...cache.values()].filter((p) => inBounds(near, p.coord));
  }, [active, region, cache]);

  useEffect(() => {
    if (!active || !region) return;
    if (loaded.current.some((b) => contains(b, boundsOf(region)))) return;

    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      const area = boundsOf(region, 1.3);
      fetchPois(area, ctrl.signal)
        .then(({ places: found, truncated }) => {
          setCache((prev) => {
            const full = prev.size + found.length > CACHE_LIMIT;
            // Dropping the cache means earlier areas must be fetched again.
            if (full) loaded.current = [];
            const next = new Map(full ? [] : prev);
            found.forEach((p) => next.set(p.id, p));
            return next;
          });
          // A cut-off result is not complete, so zooming in should fetch the smaller area in full.
          if (!truncated && !loaded.current.includes(area)) loaded.current.push(area);
        })
        .catch(() => {
          // Leave whatever is already shown; the next pan retries.
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [region, active]);

  return places;
}
