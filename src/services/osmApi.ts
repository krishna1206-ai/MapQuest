/**
 * Free, key-less providers built on OpenStreetMap data. Used automatically
 * when no MapQuest key is configured.
 *
 *  - Nearby places: Overpass API (with mirror fail-over)
 *  - Autocomplete:  Photon (komoot)
 *  - Directions:    OSRM on routing.openstreetmap.de (car / bike / foot)
 *
 * These are community services with fair-use limits; for production traffic
 * use MapQuest or self-hosted instances.
 */
import { Platform } from 'react-native';
import { CATEGORIES, classifyCategory, type CategoryId } from '../utils/categories';
import { haversineMeters, type LngLat } from '../utils/geo';
import { abortError, ApiError, isAbortError } from './errors';
import type { Maneuver, Place, Route, TravelMode } from './types';

// Overpass rejects some default HTTP-client user agents. Browsers don't allow
// overriding it (and their own UA is accepted), so only set it on native.
const UA_HEADERS: Record<string, string> =
  Platform.OS === 'web' ? {} : { 'User-Agent': 'MapQuestMobile/1.0 (Expo app)' };

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, outer?: AbortSignal) {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  outer?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onAbort);
  }
}

/* ------------------------------------------------------------------ */
/* Overpass – nearby places                                            */
/* ------------------------------------------------------------------ */

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
let preferredMirror = 0;

/** OSM tag filters for each category. */
const OSM_FILTERS: Record<CategoryId, string[]> = {
  restaurant: ['["amenity"~"^(restaurant|fast_food|food_court)$"]'],
  cafe: ['["amenity"="cafe"]'],
  fuel: ['["amenity"="fuel"]'],
  hospital: ['["amenity"~"^(hospital|clinic)$"]'],
  atm: ['["amenity"~"^(atm|bank)$"]'],
  hotel: ['["tourism"~"^(hotel|motel|guest_house|hostel)$"]'],
  shopping: ['["shop"~"^(mall|supermarket|department_store)$"]'],
  pharmacy: ['["amenity"="pharmacy"]'],
  default: [],
};

type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function categoryFromTags(tags: Record<string, string>): CategoryId {
  const v = tags.amenity ?? tags.tourism ?? tags.shop ?? '';
  if (/^(restaurant|fast_food|food_court)$/.test(v)) return 'restaurant';
  if (v === 'cafe') return 'cafe';
  if (v === 'fuel') return 'fuel';
  if (/^(hospital|clinic)$/.test(v)) return 'hospital';
  if (/^(atm|bank)$/.test(v)) return 'atm';
  if (/^(hotel|motel|guest_house|hostel)$/.test(v)) return 'hotel';
  if (v === 'pharmacy') return 'pharmacy';
  if (tags.shop) return 'shopping';
  return 'default';
}

function osmAddress(t: Record<string, string>): string {
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const region = [t['addr:state'], t['addr:postcode']].filter(Boolean).join(' ');
  return [street, t['addr:city'], region].filter(Boolean).join(', ');
}

function elementToPlace(el: OsmElement): Place | null {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  const t = el.tags ?? {};
  if (lat == null || lon == null) return null;
  const category = categoryFromTags(t);
  const name = t.name ?? t.brand ?? t.operator ?? CATEGORIES[category].singular;
  return {
    id: `osm-${el.type}-${el.id}`,
    name,
    category,
    coordinate: [lon, lat],
    address: osmAddress(t),
    phone: t.phone ?? t['contact:phone'],
  };
}

const cache = new Map<string, { at: number; data: Place[] }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function searchNearby(
  center: LngLat,
  categories: CategoryId[],
  signal?: AbortSignal,
): Promise<Place[]> {
  const key = `${categories.join('|')}:${center[0].toFixed(3)},${center[1].toFixed(3)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.data;

  // Single category → wider radius; "All" → tighter radius to keep it fast.
  const radius = categories.length > 1 ? 1500 : 3000;
  const around = `(around:${radius},${center[1]},${center[0]})`;
  const parts = categories.flatMap((c) => OSM_FILTERS[c].map((f) => `nwr${f}${around};`)).join('');
  const query = `[out:json][timeout:20];(${parts});out center tags 200;`;

  let lastErr: unknown = null;
  for (let i = 0; i < OVERPASS_MIRRORS.length; i++) {
    const idx = (preferredMirror + i) % OVERPASS_MIRRORS.length;
    if (signal?.aborted) throw abortError();
    try {
      const res = await fetchWithTimeout(
        OVERPASS_MIRRORS[idx],
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...UA_HEADERS },
          body: `data=${encodeURIComponent(query)}`,
        },
        12000,
        signal,
      );
      if (!res.ok) throw new ApiError(`Places server busy (${res.status}).`, res.status);
      const json = (await res.json()) as { elements?: OsmElement[] };
      preferredMirror = idx;

      const data = (json.elements ?? [])
        .map(elementToPlace)
        .filter((p): p is Place => !!p)
        .map((p) => ({ p, d: haversineMeters(center, p.coordinate) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, categories.length > 1 ? 80 : 40)
        .map((x) => x.p);
      cache.set(key, { at: Date.now(), data });
      return data;
    } catch (e) {
      if (signal?.aborted) throw abortError();
      lastErr = e; // timeout / busy / network → try next mirror
    }
  }
  if (isAbortError(lastErr)) throw new ApiError('Places server timed out. Please try again.');
  throw lastErr instanceof ApiError ? lastErr : new ApiError('Could not reach the places server.');
}

/* ------------------------------------------------------------------ */
/* Photon – autocomplete                                               */
/* ------------------------------------------------------------------ */

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | number | undefined>;
};

export async function autocomplete(q: string, near?: LngLat, signal?: AbortSignal): Promise<Place[]> {
  if (q.trim().length < 2) return [];
  const params = new URLSearchParams({ q: q.trim(), limit: '8' });
  if (near) {
    params.set('lon', String(near[0]));
    params.set('lat', String(near[1]));
  }
  let res: Response;
  try {
    res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal, headers: UA_HEADERS });
  } catch (e) {
    if (isAbortError(e)) throw e;
    throw new ApiError('Network error. Check your internet connection.');
  }
  if (!res.ok) throw new ApiError(`Search failed (${res.status}).`, res.status);
  const json = (await res.json()) as { features?: PhotonFeature[] };

  return (json.features ?? []).map((f) => {
    const p = f.properties;
    const s = (k: string) => (p[k] != null ? String(p[k]) : undefined);
    const street = [s('housenumber'), s('street')].filter(Boolean).join(' ');
    const address = [street, s('city') ?? s('district'), [s('state'), s('postcode')].filter(Boolean).join(' '), s('country')]
      .filter(Boolean)
      .join(', ');
    const name = s('name') ?? (street || s('city') || 'Unnamed place');
    return {
      id: `osm-${s('osm_type')}-${s('osm_id')}`,
      name,
      category: classifyCategory(s('osm_value'), s('osm_key') === 'shop' ? 'shop' : undefined, name),
      coordinate: [f.geometry.coordinates[0], f.geometry.coordinates[1]] as LngLat,
      address: name === address ? '' : address,
    };
  });
}

/* ------------------------------------------------------------------ */
/* OSRM – directions                                                   */
/* ------------------------------------------------------------------ */

const OSRM_PROFILE: Record<TravelMode, string> = { car: 'routed-car', walk: 'routed-foot', bike: 'routed-bike' };

type OsrmStep = {
  name?: string;
  distance: number;
  maneuver: { type: string; modifier?: string; exit?: number };
};

function narrative(step: OsrmStep, isLast: boolean): string {
  const { type, modifier, exit } = step.maneuver;
  const onto = step.name ? ` onto ${step.name}` : '';
  const dir = modifier ? modifier.replace('uturn', 'U-turn') : '';
  switch (type) {
    case 'depart':
      return `Head ${dir || 'out'}${step.name ? ` on ${step.name}` : ''}`;
    case 'arrive':
      return isLast ? 'Arrive at your destination' : 'Arrive at waypoint';
    case 'roundabout':
    case 'rotary':
      return `At the roundabout, take exit ${exit ?? ''}${onto}`.replace('  ', ' ');
    case 'merge':
      return `Merge ${dir}${onto}`;
    case 'on ramp':
      return `Take the ramp${onto}`;
    case 'off ramp':
      return `Take the exit${onto}`;
    case 'fork':
      return `Keep ${dir} at the fork${onto}`;
    case 'end of road':
      return `At the end of the road, turn ${dir}${onto}`;
    case 'continue':
    case 'new name':
      return `Continue${dir && dir !== 'straight' ? ` ${dir}` : ''}${onto}`;
    default:
      return dir === 'straight' ? `Go straight${onto}` : `Turn ${dir}${onto}`;
  }
}

export async function getRoute(from: LngLat, to: LngLat, mode: TravelMode, signal?: AbortSignal): Promise<Route> {
  const url =
    `https://routing.openstreetmap.de/${OSRM_PROFILE[mode]}/route/v1/driving/` +
    `${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson&steps=true`;
  let res: Response;
  try {
    res = await fetchWithTimeout(url, { headers: UA_HEADERS }, 20000, signal);
  } catch (e) {
    if (signal?.aborted) throw abortError();
    throw new ApiError(isAbortError(e) ? 'Routing server timed out.' : 'Network error. Check your internet connection.');
  }
  if (!res.ok) throw new ApiError(`Routing failed (${res.status}).`, res.status);
  const json = (await res.json()) as {
    code: string;
    message?: string;
    routes?: { distance: number; duration: number; geometry: { coordinates: LngLat[] }; legs: { steps: OsrmStep[] }[] }[];
  };
  const r = json.routes?.[0];
  if (json.code !== 'Ok' || !r) throw new ApiError(json.message || 'No route found for this travel mode.');

  const steps = r.legs.flatMap((l) => l.steps);
  const maneuvers: Maneuver[] = steps.map((s, i) => ({
    narrative: narrative(s, i === steps.length - 1),
    distanceMeters: s.distance,
  }));
  return {
    distanceMeters: r.distance,
    durationSeconds: r.duration,
    coordinates: r.geometry.coordinates,
    maneuvers,
  };
}
