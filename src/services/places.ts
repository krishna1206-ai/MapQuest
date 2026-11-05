/**
 * Provider facade used by the hooks.
 * MapQuest is used when EXPO_PUBLIC_MAPQUEST_API_KEY is set; otherwise the
 * free OpenStreetMap-based providers in osmApi.ts.
 */
import type { CategoryId } from '../utils/categories';
import { hasApiKey } from '../utils/config';
import type { LngLat } from '../utils/geo';
import * as mq from './mapquestApi';
import * as osm from './osmApi';
import type { Place, Route, TravelMode } from './types';

export { errorMessage, isAbortError } from './errors';

export const activeProvider = (): 'mapquest' | 'osm' => (hasApiKey() ? 'mapquest' : 'osm');

export function searchNearby(center: LngLat, category: CategoryId, signal?: AbortSignal): Promise<Place[]> {
  return hasApiKey()
    ? mq.searchNearby(center, category, { pageSize: 30, signal })
    : osm.searchNearby(center, [category], signal);
}

export function searchNearbyMany(center: LngLat, categories: CategoryId[], signal?: AbortSignal): Promise<Place[]> {
  return hasApiKey() ? mq.searchNearbyMany(center, categories, signal) : osm.searchNearby(center, categories, signal);
}

export function autocomplete(q: string, near?: LngLat, signal?: AbortSignal): Promise<Place[]> {
  return hasApiKey() ? mq.autocomplete(q, near, signal) : osm.autocomplete(q, near, signal);
}

export function getRoute(from: LngLat, to: LngLat, mode: TravelMode, signal?: AbortSignal): Promise<Route> {
  return hasApiKey() ? mq.getRoute(from, to, mode, signal) : osm.getRoute(from, to, mode, signal);
}
