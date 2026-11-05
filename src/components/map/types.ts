import type { Ref } from 'react';
import type { Bounds, LngLat } from '../../utils/geo';

export type MapMarker = {
  id: string;
  lngLat: LngLat;
  color: string;
  /** MaterialCommunityIcons / MDI icon name, e.g. "coffee". */
  icon: string;
  selected?: boolean;
};

export type MapRoute = { coords: LngLat[]; color: string; casing: string; dashed?: boolean };

export type Region = { center: LngLat; zoom: number; bearing: number; bounds: Bounds; userInteraction: boolean };

type Padding = number | { top: number; bottom: number; left: number; right: number };
type CameraMove = { center: LngLat; zoom?: number; bearing?: number; duration?: number };

export type MapHandle = {
  flyTo: (o: CameraMove) => void;
  easeTo: (o: CameraMove) => void;
  fitBounds: (bounds: Bounds, o?: { padding?: Padding; duration?: number }) => void;
};

export type MapViewProps = {
  ref?: Ref<MapHandle>;
  initialCenter: LngLat;
  initialZoom: number;
  markers?: MapMarker[];
  userLocation?: LngLat | null;
  route?: MapRoute | null;
  /** Distance from the top of the map to the compass, to clear overlays. */
  controlsTop?: number;
  onRegionDidChange?: (r: Region) => void;
  onMarkerPress?: (id: string) => void;
  onPress?: (lngLat: LngLat) => void;
};
