import type { CategoryId } from '../utils/categories';
import type { LngLat } from '../utils/geo';

export type Place = {
  id: string;
  name: string;
  category: CategoryId;
  coordinate: LngLat; // [lng, lat]
  address: string;
  phone?: string;
};

export type TravelMode = 'car' | 'walk' | 'bike';

export type Maneuver = {
  narrative: string;
  distanceMeters: number;
};

export type Route = {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: LngLat[];
  maneuvers: Maneuver[];
};
