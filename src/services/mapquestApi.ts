import { CONFIG, hasApiKey } from '../utils/config';
import { CATEGORIES, classifyCategory, type CategoryId } from '../utils/categories';
import type { LngLat } from '../utils/geo';
import { abortError, ApiError } from './errors';
import type { Maneuver, Place, Route, TravelMode } from './types';

export { ApiError };

const BASE = 'https://www.mapquestapi.com';

function ensureKey() {
  if (!hasApiKey()) {
    throw new ApiError('MapQuest API key missing. Add EXPO_PUBLIC_MAPQUEST_API_KEY to your .env file.');
  }
}

async function getJson<T>(path: string, params: Record<string, string | number | undefined>, signal?: AbortSignal): Promise<T> {
  ensureKey();
  const qs = Object.entries({ ...params, key: CONFIG.mapquestKey })
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}?${qs}`, { signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new ApiError('Network error. Check your internet connection.');
  }
  if (res.status === 401 || res.status === 403) throw new ApiError('MapQuest rejected the API key.', res.status);
  if (res.status === 429) throw new ApiError('Too many requests. Please wait a moment.', 429);
  if (!res.ok) throw new ApiError(`MapQuest request failed (${res.status}).`, res.status);
  return (await res.json()) as T;
}

/* ------------------------------------------------------------------ */
/* Search API v4 – nearby places                                       */
/* ------------------------------------------------------------------ */

type SearchV4Result = {
  id?: string;
  name?: string;
  displayString?: string;
  slug?: string;
  place?: {
    geometry?: { coordinates?: [number, number] };
    properties?: {
      street?: string;
      city?: string;
      stateCode?: string;
      state?: string;
      postalCode?: string;
      countryCode?: string;
      type?: string;
      phone?: string;
    };
  };
  phone?: string;
};

function addressFrom(r: SearchV4Result): string {
  const p = r.place?.properties;
  if (p) {
    const line = [p.street, p.city, [p.stateCode ?? p.state, p.postalCode].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', ');
    if (line) return line;
  }
  // displayString looks like "Name, 123 Main St, City, ST 00000, US"
  const ds = r.displayString ?? '';
  return r.name && ds.startsWith(r.name) ? ds.slice(r.name.length).replace(/^,\s*/, '') : ds;
}

function toPlace(r: SearchV4Result, fallbackCategory?: CategoryId): Place | null {
  const c = r.place?.geometry?.coordinates;
  if (!c || c.length < 2) return null;
  const name = r.name ?? r.displayString?.split(',')[0] ?? 'Unnamed place';
  const category =
    fallbackCategory ?? classifyCategory(name, r.place?.properties?.type, r.displayString);
  return {
    id: r.id ?? r.slug ?? `${c[0]},${c[1]},${name}`,
    name,
    category,
    coordinate: [c[0], c[1]],
    address: addressFrom(r),
    phone: r.place?.properties?.phone ?? r.phone,
  };
}

/** Small in-memory cache so panning back and forth doesn't refetch. */
const cache = new Map<string, { at: number; data: Place[] }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function searchNearby(
  center: LngLat,
  category: CategoryId,
  opts: { pageSize?: number; signal?: AbortSignal } = {},
): Promise<Place[]> {
  const pageSize = opts.pageSize ?? 20;
  // Round to ~100 m so tiny pans hit the cache.
  const key = `${category}:${center[0].toFixed(3)},${center[1].toFixed(3)}:${pageSize}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.data;

  const json = await getJson<{ results?: SearchV4Result[] }>(
    '/search/v4/place',
    {
      location: `${center[0]},${center[1]}`, // lng,lat
      sort: 'distance',
      feedback: 'false',
      q: CATEGORIES[category].query,
      pageSize,
    },
    opts.signal,
  );

  const data = (json.results ?? []).map((r) => toPlace(r, category)).filter((p): p is Place => !!p);
  cache.set(key, { at: Date.now(), data });
  return data;
}

/** Fetch several categories in parallel and merge (used for the "All" filter). */
export async function searchNearbyMany(
  center: LngLat,
  categories: CategoryId[],
  signal?: AbortSignal,
): Promise<Place[]> {
  const settled = await Promise.allSettled(
    categories.map((c) => searchNearby(center, c, { pageSize: 10, signal })),
  );
  if (signal?.aborted) throw abortError();

  const ok = settled.filter((s): s is PromiseFulfilledResult<Place[]> => s.status === 'fulfilled');
  if (!ok.length) {
    const firstErr = settled.find((s): s is PromiseRejectedResult => s.status === 'rejected');
    throw firstErr?.reason ?? new ApiError('Could not load places.');
  }
  const seen = new Set<string>();
  const merged: Place[] = [];
  for (const s of ok) for (const p of s.value) if (!seen.has(p.id)) (seen.add(p.id), merged.push(p));
  return merged;
}

/* ------------------------------------------------------------------ */
/* Search API v3 – autocomplete / predictions                          */
/* ------------------------------------------------------------------ */

type PredictionResult = SearchV4Result & { recordType?: string };

export async function autocomplete(q: string, near?: LngLat, signal?: AbortSignal): Promise<Place[]> {
  if (q.trim().length < 2) return [];
  const json = await getJson<{ results?: PredictionResult[] }>(
    '/search/v3/prediction',
    {
      q: q.trim(),
      limit: 8,
      collection: 'poi,address,adminArea,airport,franchise,category',
      location: near ? `${near[0]},${near[1]}` : undefined,
    },
    signal,
  );
  return (json.results ?? []).map((r) => toPlace(r)).filter((p): p is Place => !!p);
}

/* ------------------------------------------------------------------ */
/* Directions API v2                                                   */
/* ------------------------------------------------------------------ */

const ROUTE_TYPE: Record<TravelMode, string> = { car: 'fastest', walk: 'pedestrian', bike: 'bicycle' };
const KM = 1000;

type DirectionsResponse = {
  info?: { statuscode?: number; messages?: string[] };
  route?: {
    distance?: number; // in km because we request unit=k
    time?: number; // seconds
    shape?: { shapePoints?: number[] }; // [lat, lng, lat, lng, ...]
    legs?: { maneuvers?: { narrative?: string; distance?: number }[] }[];
    routeError?: { errorCode?: number; message?: string };
  };
};

export async function getRoute(from: LngLat, to: LngLat, mode: TravelMode, signal?: AbortSignal): Promise<Route> {
  const json = await getJson<DirectionsResponse>(
    '/directions/v2/route',
    {
      from: `${from[1]},${from[0]}`, // lat,lng
      to: `${to[1]},${to[0]}`,
      routeType: ROUTE_TYPE[mode],
      unit: 'k',
      fullShape: 'true',
      shapeFormat: 'raw',
      narrativeType: 'text',
      doReverseGeocode: 'false',
    },
    signal,
  );

  const status = json.info?.statuscode ?? 0;
  const r = json.route;
  if (status !== 0 || !r?.shape?.shapePoints?.length) {
    const msg = json.info?.messages?.[0] || r?.routeError?.message || 'No route found for this travel mode.';
    throw new ApiError(msg);
  }

  const pts = r.shape.shapePoints;
  const coordinates: LngLat[] = [];
  for (let i = 0; i + 1 < pts.length; i += 2) coordinates.push([pts[i + 1], pts[i]]);

  const maneuvers: Maneuver[] = (r.legs ?? []).flatMap((l) =>
    (l.maneuvers ?? []).map((m) => ({ narrative: m.narrative ?? '', distanceMeters: (m.distance ?? 0) * KM })),
  );

  return {
    distanceMeters: (r.distance ?? 0) * KM,
    durationSeconds: r.time ?? 0,
    coordinates,
    maneuvers,
  };
}

