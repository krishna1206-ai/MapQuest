import type { LatLng } from '../utils/geo';

export type Place = {
  id: string;
  name: string;
  address: string;
  coord?: LatLng;
  slug?: string;
  isCategory?: boolean;
  distanceMiles?: number;
};

export type TravelMode = 'fastest' | 'pedestrian' | 'bicycle';

export type RouteOptions = {
  mode: TravelMode;
  avoidTolls: boolean;
  avoidHighways: boolean;
};

export type Maneuver = {
  narrative: string;
  distance: number; // miles
  time: number; // seconds
  start: LatLng;
  turnType: number; // MapQuest turnType codes, see maneuverIcon()
};

export type Route = {
  distance: number; // miles
  time: number; // seconds, free-flow
  realTime?: number; // seconds, with live traffic
  hasTollRoad: boolean;
  shape: LatLng[];
  maneuvers: Maneuver[];
};
