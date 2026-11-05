import { CONFIG } from './config';

export type LngLat = [number, number];
export type Bounds = [west: number, south: number, east: number, north: number];

const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineMeters(a: LngLat, b: LngLat): number {
  const R = 6371000;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters: number | undefined | null): string {
  if (meters == null || !isFinite(meters)) return '—';
  if (CONFIG.units === 'metric') {
    return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
  }
  const feet = meters * 3.28084;
  if (feet < 1000) return `${Math.round(feet / 10) * 10} ft`;
  const miles = meters / 1609.344;
  return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

export function formatDuration(seconds: number | undefined | null): string {
  if (seconds == null || !isFinite(seconds)) return '—';
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** Arrival clock time, e.g. "4:35 PM". */
export function formatArrival(seconds: number): string {
  const d = new Date(Date.now() + seconds * 1000);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function boundsOf(coords: LngLat[]): Bounds | null {
  if (!coords.length) return null;
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < w) w = lng;
    if (lng > e) e = lng;
    if (lat < s) s = lat;
    if (lat > n) n = lat;
  }
  return [w, s, e, n];
}

/** Radius (m) of the circle that roughly covers the visible bounds, clamped. */
export function radiusForBounds(b: Bounds, min = 500, max = 40000): number {
  const r = haversineMeters([b[0], b[1]], [b[2], b[3]]) / 2;
  return Math.min(max, Math.max(min, r));
}
