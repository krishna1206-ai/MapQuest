// Key-free provider used when no MapQuest key is configured:
// Photon (search and nearby places) and OSRM (routing), both on OpenStreetMap data.
// These public servers are for development and light use only.
import { Platform } from 'react-native';
import { haversineMiles, type LatLng } from '../utils/geo';
import type { Maneuver, Place, Route, RouteOptions } from './types';

const PHOTON = 'https://photon.komoot.io';
const OSRM = 'https://routing.openstreetmap.de';
const METERS_PER_MILE = 1609.344;

// Category chip query → OpenStreetMap tags (Photon's key:value form).
const CATEGORY_TAGS: Record<string, string[]> = {
  'gas stations': ['amenity:fuel'],
  restaurants: ['amenity:restaurant', 'amenity:fast_food'],
  shopping: ['shop:mall', 'shop:department_store', 'shop:clothes'],
  hotels: ['tourism:hotel', 'tourism:motel'],
  coffee: ['amenity:cafe'],
  'grocery stores': ['shop:supermarket', 'shop:grocery'],
  parking: ['amenity:parking'],
  pharmacy: ['amenity:pharmacy'],
  atm: ['amenity:atm'],
  'electric vehicle charging': ['amenity:charging_station'],
};

// Identify the app on native; browsers send their own user agent, and a custom one would trigger a CORS preflight.
const HEADERS: Record<string, string> =
  Platform.OS === 'web'
    ? { Accept: 'application/json' }
    : { 'User-Agent': 'MapQuestApp/1.0 (React Native)', Accept: 'application/json' };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Map service is busy (${res.status}). Try again in a moment.`);
  return res.json() as Promise<T>;
}

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type: string;
    osm_id: number;
    name?: string;
    housenumber?: string;
    street?: string;
    locality?: string;
    district?: string;
    city?: string;
    state?: string;
    postcode?: string;
  };
};

function toPlaces(features: PhotonFeature[], near: LatLng | null | undefined, fallbackName: string): Place[] {
  return features.map((f) => {
    const p = f.properties;
    const coord = { latitude: f.geometry.coordinates[1], longitude: f.geometry.coordinates[0] };
    const street = [p.housenumber, p.street].filter(Boolean).join(' ');
    const area = p.locality ?? p.district;
    const address = [street, area, p.city, [p.state, p.postcode].filter(Boolean).join(' ')]
      .filter((part, i, all) => part && all.indexOf(part) === i)
      .join(', ');
    return {
      id: `${p.osm_type}${p.osm_id}`,
      name: p.name ?? (street || p.city || fallbackName),
      address: address || 'Address not available',
      coord,
      distanceMiles: near ? haversineMiles(near, coord) : undefined,
    };
  });
}

// Not limited to the US so the app can be tested anywhere; results are biased toward `near`.
async function photonSearch(q: string, near: LatLng | null | undefined, limit: number): Promise<Place[]> {
  const params = new URLSearchParams({ q, limit: String(limit), lang: 'en' });
  if (near) {
    params.set('lat', String(near.latitude));
    params.set('lon', String(near.longitude));
  }
  const data = await getJson<{ features?: PhotonFeature[] }>(`${PHOTON}/api/?${params}`);
  return toPlaces(data.features ?? [], near, q);
}

/** Nearest places with any of the given tags, closest first. */
async function photonNearby(tags: string[], near: LatLng, radiusKm: number, fallbackName: string): Promise<Place[]> {
  const params = new URLSearchParams({
    lat: String(near.latitude),
    lon: String(near.longitude),
    radius: String(radiusKm),
    limit: '20',
    lang: 'en',
  });
  tags.forEach((t) => params.append('osm_tag', t));
  const data = await getJson<{ features?: PhotonFeature[] }>(`${PHOTON}/reverse?${params}`);
  return toPlaces(data.features ?? [], near, fallbackName).sort(
    (a, b) => (a.distanceMiles ?? 0) - (b.distanceMiles ?? 0),
  );
}

export function searchAhead(q: string, near?: LatLng | null): Promise<Place[]> {
  return photonSearch(q, near, 12).then((r) => r.slice(0, 8));
}

export async function searchNearby(q: string, near: LatLng): Promise<Place[]> {
  const tags = CATEGORY_TAGS[q.toLowerCase()];
  if (!tags) {
    const r = await photonSearch(q, near, 20);
    return r.sort((a, b) => (a.distanceMiles ?? 0) - (b.distanceMiles ?? 0));
  }
  const name = q.charAt(0).toUpperCase() + q.slice(1);
  const close = await photonNearby(tags, near, 5, name);
  return close.length >= 5 ? close : photonNearby(tags, near, 25, name);
}


type OsrmStep = {
  distance: number;
  duration: number;
  name: string;
  ref?: string;
  destinations?: string;
  exits?: string;
  maneuver: { type: string; modifier?: string; location: [number, number]; bearing_after?: number; exit?: number };
  intersections?: { classes?: string[] }[];
};

const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

function turnPhrase(modifier = 'straight'): string {
  if (modifier === 'uturn') return 'Make a U-turn';
  if (modifier === 'straight') return 'Continue straight';
  if (modifier.startsWith('slight')) return `Bear ${modifier.slice(7)}`;
  if (modifier.startsWith('sharp')) return `Make a sharp ${modifier.slice(6)}`;
  return `Turn ${modifier}`;
}

function narrative(s: OsrmStep): string {
  const { type, modifier, bearing_after, exit } = s.maneuver;
  const road = s.name || s.ref || '';
  const onto = road ? ` onto ${road}` : '';
  const side = modifier?.includes('left') ? 'left' : 'right';
  switch (type) {
    case 'depart':
      return `Head ${COMPASS.at(Math.round((bearing_after ?? 0) / 45) % 8)}${road ? ` on ${road}` : ''}`;
    case 'arrive':
      return 'Arrive at your destination';
    case 'merge':
      return `Merge ${side}${onto}`;
    case 'on ramp':
      return `Take the ramp on the ${side}${s.destinations ? ` toward ${s.destinations}` : onto}`;
    case 'off ramp':
      return `Take exit${s.exits ? ` ${s.exits}` : ''} on the ${side}${s.destinations ? ` toward ${s.destinations}` : onto}`;
    case 'fork':
      return `Keep ${side} at the fork${onto}`;
    case 'roundabout':
    case 'rotary':
      return `At the roundabout, take the ${ordinal(exit ?? 1)} exit${onto}`;
    case 'new name':
    case 'continue':
      return modifier === 'uturn' ? `Make a U-turn${onto}` : `Continue${onto || ' straight'}`;
    default:
      return `${turnPhrase(modifier)}${onto}`;
  }
}

function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'].at(n % 10) ?? 'th'}`;
}

// OSRM maneuver → MapQuest turnType so the same icons work for both providers.
function turnType(s: OsrmStep): number {
  const { type, modifier = 'straight' } = s.maneuver;
  const left = modifier.includes('left');
  if (type === 'merge') return left ? 11 : 10;
  if (type === 'on ramp') return left ? 13 : 12;
  if (type === 'off ramp') return left ? 15 : 14;
  if (type === 'fork') return left ? 17 : 16;
  const byModifier: Record<string, number> = {
    straight: 0,
    'slight right': 1,
    right: 2,
    'sharp right': 3,
    uturn: 4,
    'sharp left': 5,
    left: 6,
    'slight left': 7,
  };
  return byModifier[modifier] ?? 0;
}

export async function getRoute(from: LatLng, to: LatLng, opts: RouteOptions): Promise<Route> {
  const profile = opts.mode === 'pedestrian' ? 'routed-foot' : opts.mode === 'bicycle' ? 'routed-bike' : 'routed-car';
  const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  type OsrmResponse = {
    code: string;
    message?: string;
    routes?: {
      distance: number;
      duration: number;
      geometry: { coordinates: [number, number][] };
      legs: { steps: OsrmStep[] }[];
    }[];
  };
  const data = await getJson<OsrmResponse>(
    `${OSRM}/${profile}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`,
  );
  const r = data.routes?.[0];
  if (data.code !== 'Ok' || !r) throw new Error(data.message ?? 'No route found.');

  const steps = r.legs.flatMap((l) => l.steps);
  const maneuvers: Maneuver[] = steps.map((s) => ({
    narrative: narrative(s),
    distance: s.distance / METERS_PER_MILE,
    time: s.duration,
    turnType: turnType(s),
    start: { latitude: s.maneuver.location[1], longitude: s.maneuver.location[0] },
  }));

  return {
    distance: r.distance / METERS_PER_MILE,
    time: r.duration,
    hasTollRoad: steps.some((s) => s.intersections?.some((i) => i.classes?.includes('toll'))),
    shape: r.geometry.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
    maneuvers,
  };
}
