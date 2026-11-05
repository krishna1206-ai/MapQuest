// Shared MapLibre drawing for place icons, used by the native map and the Expo Go (WebView) map.
// Each place is a white badge ringed in its category color with its icon from the style's sprite sheet.
// Plain style-spec JSON so it can also be sent into the WebView.
import type { Poi } from '../../api/pois';
import { POI_COLORS } from '../../theme';

/** How long a tapped place's name stays up. */
export const NAME_PEEK_MS = 3000;

export function placesGeoJson(places: Poi[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: places.map((p) => ({
      type: 'Feature',
      id: p.id,
      geometry: { type: 'Point', coordinates: [p.coord.longitude, p.coord.latitude] },
      properties: { id: p.id, name: p.name, color: POI_COLORS[p.kind], sprite: p.sprite },
    })),
  };
}

// Smaller when zoomed out to a whole city, full size on a street.
const BADGE_RADIUS = ['interpolate', ['linear'], ['zoom'], 11, 6, 14, 9, 17, 12];
const ICON_SIZE = ['interpolate', ['linear'], ['zoom'], 11, 0.45, 14, 0.7, 17, 0.95];

/** Layer specs (without id/source) in draw order. Every place shows; nothing is hidden when crowded. */
export const PLACE_LAYERS = {
  badge: {
    type: 'circle' as const,
    paint: {
      'circle-radius': BADGE_RADIUS,
      'circle-color': '#FFFFFF',
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 1.5, 15, 2.5],
    },
  },
  icon: {
    type: 'symbol' as const,
    layout: {
      'icon-image': ['get', 'sprite'],
      'icon-size': ICON_SIZE,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  },
};
