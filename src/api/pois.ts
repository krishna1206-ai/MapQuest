// Every named place in a map area (hotels, hospitals, schools, food, shops…), from OpenStreetMap via Overpass.
// Used to put an icon on the map for each place, the way mapquest.com does. The public server is for light use only.
import { Platform } from 'react-native';
import type { IconName } from '../theme';
import type { LatLng } from '../utils/geo';
import type { Place } from './types';

export type PoiKind =
  | 'hotel'
  | 'health'
  | 'food'
  | 'cafe'
  | 'fuel'
  | 'grocery'
  | 'shop'
  | 'money'
  | 'education'
  | 'worship'
  | 'fun'
  | 'park'
  | 'civic'
  | 'transit';

export type Poi = Place & {
  coord: LatLng;
  kind: PoiKind;
  /** Icon name in the map style's sprite sheet (native and Expo Go maps). */
  sprite: string;
  /** Same icon from MaterialIcons (browser map and app UI). */
  icon: IconName;
};

export type Bounds = { south: number; west: number; north: number; east: number };

const OVERPASS = 'https://overpass-api.de/api/interpreter';
const MAX_PLACES = 2000;

type Def = [kind: PoiKind, sprite: string, icon: IconName];

// OSM key → value → how that place is drawn.
const DEFS: Record<string, Record<string, Def>> = {
  tourism: {
    hotel: ['hotel', 'lodging', 'hotel'],
    motel: ['hotel', 'lodging', 'hotel'],
    guest_house: ['hotel', 'lodging', 'hotel'],
    hostel: ['hotel', 'lodging', 'hotel'],
    attraction: ['fun', 'attraction', 'star'],
    museum: ['fun', 'museum', 'museum'],
    zoo: ['fun', 'zoo', 'pets'],
  },
  amenity: {
    hospital: ['health', 'hospital', 'local-hospital'],
    clinic: ['health', 'doctors', 'medical-services'],
    doctors: ['health', 'doctors', 'medical-services'],
    dentist: ['health', 'dentist', 'medical-services'],
    pharmacy: ['health', 'pharmacy', 'local-pharmacy'],
    restaurant: ['food', 'restaurant', 'restaurant'],
    fast_food: ['food', 'fast_food', 'fastfood'],
    food_court: ['food', 'restaurant', 'restaurant'],
    ice_cream: ['food', 'ice_cream', 'icecream'],
    bar: ['food', 'bar', 'local-bar'],
    cafe: ['cafe', 'cafe', 'local-cafe'],
    fuel: ['fuel', 'fuel', 'local-gas-station'],
    bank: ['money', 'bank', 'account-balance'],
    atm: ['money', 'bank', 'atm'],
    school: ['education', 'school', 'school'],
    kindergarten: ['education', 'school', 'child-care'],
    college: ['education', 'college', 'account-balance'],
    university: ['education', 'college', 'account-balance'],
    library: ['education', 'library', 'local-library'],
    place_of_worship: ['worship', 'place_of_worship', 'place'],
    cinema: ['fun', 'cinema', 'local-movies'],
    theatre: ['fun', 'theatre', 'theater-comedy'],
    police: ['civic', 'police', 'local-police'],
    fire_station: ['civic', 'fire_station', 'local-fire-department'],
    post_office: ['civic', 'post', 'local-post-office'],
    townhall: ['civic', 'town_hall', 'account-balance'],
    bus_station: ['transit', 'bus', 'directions-bus'],
  },
  shop: {
    supermarket: ['grocery', 'grocery', 'local-grocery-store'],
    convenience: ['grocery', 'grocery', 'local-grocery-store'],
    greengrocer: ['grocery', 'grocery', 'local-grocery-store'],
    bakery: ['food', 'bakery', 'bakery-dining'],
    mall: ['shop', 'shop', 'local-mall'],
    department_store: ['shop', 'shop', 'local-mall'],
    clothes: ['shop', 'clothing_store', 'checkroom'],
    electronics: ['shop', 'shop', 'devices'],
    mobile_phone: ['shop', 'shop', 'smartphone'],
    jewelry: ['shop', 'shop', 'diamond'],
  },
  leisure: {
    park: ['park', 'park', 'park'],
    stadium: ['fun', 'stadium', 'stadium'],
    playground: ['park', 'playground', 'toys'],
  },
  railway: { station: ['transit', 'railway', 'train'] },
};

function buildQuery(b: Bounds): string {
  const box = `(${b.south},${b.west},${b.north},${b.east})`;
  const parts = Object.entries(DEFS).map(
    ([key, values]) => `nwr["${key}"~"^(${Object.keys(values).join('|')})$"]["name"]${box};`,
  );
  return `[out:json][timeout:25];(${parts.join('')});out center tags ${MAX_PLACES};`;
}

type Element = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function defOf(tags: Record<string, string>): Def | undefined {
  for (const [key, values] of Object.entries(DEFS)) {
    const d = tags[key] && values[tags[key]];
    if (d) return d;
  }
  return undefined;
}

function addressOf(tags: Record<string, string>): string {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const parts = [street, tags['addr:suburb'], tags['addr:city'], tags['addr:postcode']].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Address not available';
}

// Browsers send their own user agent; on native, Overpass rejects requests without one.
const HEADERS: Record<string, string> =
  Platform.OS === 'web' ? {} : { 'User-Agent': 'MapQuestApp/1.0 (React Native)', Accept: 'application/json' };

/** Places in the area; `truncated` means the area held more than the server returns at once. */
export async function fetchPois(b: Bounds, signal?: AbortSignal): Promise<{ places: Poi[]; truncated: boolean }> {
  const res = await fetch(`${OVERPASS}?data=${encodeURIComponent(buildQuery(b))}`, { headers: HEADERS, signal });
  if (!res.ok) throw new Error(`Places service is busy (${res.status}).`);
  const data = (await res.json()) as { elements?: Element[] };
  const out: Poi[] = [];
  for (const e of data.elements ?? []) {
    const tags = e.tags ?? {};
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    const def = defOf(tags);
    if (lat == null || lon == null || !def || !tags.name) continue;
    out.push({
      id: `${e.type}${e.id}`,
      name: tags['name:en'] ?? tags.name,
      address: addressOf(tags),
      coord: { latitude: lat, longitude: lon },
      kind: def[0],
      sprite: def[1],
      icon: def[2],
    });
  }
  return { places: out, truncated: (data.elements?.length ?? 0) >= MAX_PLACES };
}
