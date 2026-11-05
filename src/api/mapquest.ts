import { haversineMiles, type LatLng } from '../utils/geo';
import type { Place, Route, RouteOptions } from './types';

const BASE = 'https://www.mapquestapi.com';
export const MAPQUEST_KEY = process.env.EXPO_PUBLIC_MAPQUEST_KEY ?? '';
const KEY = MAPQUEST_KEY;

type RawResult = {
  id: string;
  name: string;
  displayString: string;
  slug?: string;
  recordType?: string;
  place?: {
    geometry?: { coordinates?: [number, number] };
    properties?: { street?: string; city?: string; stateCode?: string; postalCode?: string };
  };
};

async function get<T>(path: string, params: URLSearchParams): Promise<T> {
  if (!KEY) {
    throw new Error('Missing MapQuest API key. Add EXPO_PUBLIC_MAPQUEST_KEY to your .env file.');
  }
  params.set('key', KEY);
  const res = await fetch(`${BASE}${path}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`MapQuest request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

const lngLat = (p: LatLng) => `${p.longitude},${p.latitude}`;

function toPlace(r: RawResult, near?: LatLng | null): Place {
  const c = r.place?.geometry?.coordinates;
  const coord = c ? { latitude: c[1], longitude: c[0] } : undefined;
  const props = r.place?.properties;
  const address =
    [props?.street, props?.city, [props?.stateCode, props?.postalCode].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', ') || r.displayString;
  return {
    id: r.id,
    name: r.name,
    address,
    coord,
    slug: r.slug,
    isCategory: r.recordType === 'category' || !coord,
    distanceMiles: coord && near ? haversineMiles(near, coord) : undefined,
  };
}

/** Autocomplete for the search bar (Search Ahead API). */
export async function searchAhead(q: string, near?: LatLng | null): Promise<Place[]> {
  const params = new URLSearchParams({
    q,
    collection: 'address,poi,franchise,airport,adminArea,category',
    limit: '8',
    countryCode: 'US',
  });
  if (near) params.set('location', lngLat(near));
  const data = await get<{ results?: RawResult[] }>('/search/v3/prediction', params);
  return (data.results ?? []).map((r) => toPlace(r, near));
}

/** Places matching a query or category, nearest first (Place Search API). */
export async function searchNearby(q: string, near: LatLng): Promise<Place[]> {
  const params = new URLSearchParams({
    q,
    location: lngLat(near),
    sort: 'distance',
    pageSize: '20',
  });
  const data = await get<{ results?: RawResult[] }>('/search/v4/place', params);
  return (data.results ?? []).map((r) => toPlace(r, near)).filter((p) => p.coord);
}

/** Route between two points (Directions API). */
export async function getRoute(from: LatLng, to: LatLng, opts: RouteOptions): Promise<Route> {
  const params = new URLSearchParams({
    from: `${from.latitude},${from.longitude}`,
    to: `${to.latitude},${to.longitude}`,
    routeType: opts.mode,
    unit: 'm',
    fullShape: 'true',
    doReverseGeocode: 'false',
    useTraffic: opts.mode === 'fastest' ? 'true' : 'false',
  });
  if (opts.mode === 'fastest') {
    if (opts.avoidTolls) params.append('avoids', 'Toll Road');
    if (opts.avoidHighways) params.append('avoids', 'Limited Access');
  }

  type RawRoute = {
    info: { statuscode: number; messages?: string[] };
    route: {
      distance: number;
      time: number;
      realTime?: number;
      hasTollRoad?: boolean;
      shape?: { shapePoints?: number[] };
      legs?: {
        maneuvers: {
          narrative: string;
          distance: number;
          time: number;
          turnType: number;
          startPoint: { lat: number; lng: number };
        }[];
      }[];
    };
  };

  const data = await get<RawRoute>('/directions/v2/route', params);
  if (data.info.statuscode !== 0) {
    throw new Error(data.info.messages?.[0] ?? 'No route found.');
  }

  const pts = data.route.shape?.shapePoints ?? [];
  const shape: LatLng[] = [];
  for (let i = 0; i + 1 < pts.length; i += 2) {
    shape.push({ latitude: pts[i], longitude: pts[i + 1] });
  }

  const maneuvers = (data.route.legs ?? []).flatMap((leg) =>
    leg.maneuvers.map((m) => ({
      narrative: m.narrative,
      distance: m.distance,
      time: m.time,
      turnType: m.turnType,
      start: { latitude: m.startPoint.lat, longitude: m.startPoint.lng },
    })),
  );

  // MapQuest returns a huge sentinel value when no traffic estimate exists.
  const realTime = data.route.realTime;
  return {
    distance: data.route.distance,
    time: data.route.time,
    realTime: realTime && realTime < 1e7 ? realTime : undefined,
    hasTollRoad: !!data.route.hasTollRoad,
    shape,
    maneuvers,
  };
}
