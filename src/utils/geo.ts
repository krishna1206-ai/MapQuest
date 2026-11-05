export type LatLng = { latitude: number; longitude: number };

/** Geographic center of the contiguous US, used before we know the user's location. */
export const US_REGION = {
  latitude: 39.5,
  longitude: -98.35,
  latitudeDelta: 30,
  longitudeDelta: 30,
};

const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distance from a point to the nearest vertex of a dense polyline. */
export function distanceToPath(p: LatLng, path: LatLng[]): number {
  let min = Infinity;
  for (const q of path) {
    const d = haversineMiles(p, q);
    if (d < min) min = d;
  }
  return min;
}

export function formatDistance(miles: number): string {
  if (miles < 0.1) return `${Math.max(50, Math.round((miles * 5280) / 50) * 50)} ft`;
  return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

export function spokenDistance(miles: number): string {
  if (miles < 0.1) return `${Math.max(50, Math.round((miles * 5280) / 50) * 50)} feet`;
  const v = miles.toFixed(miles < 10 ? 1 : 0);
  return `${v} ${v === '1.0' ? 'mile' : 'miles'}`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
