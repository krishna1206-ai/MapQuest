import * as mapquest from './mapquest';
import * as openData from './openData';

export type { Maneuver, Place, Route, RouteOptions, TravelMode } from './types';

/** MapQuest powers search and routing when a key is set; otherwise the app falls back to free OpenStreetMap services. */
const hasKey = mapquest.MAPQUEST_KEY.length > 0;
const provider = hasKey ? mapquest : openData;

export const searchAhead = provider.searchAhead;
export const searchNearby = provider.searchNearby;
export const getRoute = provider.getRoute;

export const capabilities = {
  avoidOptions: hasKey,
};

export const mapquestUrl = (slug?: string) => (slug ? `https://www.mapquest.com${slug}` : undefined);
