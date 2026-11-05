import { CONFIG } from './config';

/**
 * MapLibre style JSON with both a light (OpenStreetMap) and a dark (CARTO)
 * raster basemap. Theme switching just toggles layer visibility, so the
 * route layer and markers survive a light/dark change.
 */
export function buildMapStyle(dark: boolean) {
  return {
    version: 8,
    sources: {
      'base-light': {
        type: 'raster',
        tiles: [CONFIG.tileUrlLight],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© OpenStreetMap contributors',
      },
      'base-dark': {
        type: 'raster',
        tiles: [CONFIG.tileUrlDark],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© OpenStreetMap contributors © CARTO',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': dark ? '#0B1220' : '#F2EFE9' } },
      { id: 'base-light', type: 'raster', source: 'base-light', layout: { visibility: dark ? 'none' : 'visible' } },
      { id: 'base-dark', type: 'raster', source: 'base-dark', layout: { visibility: dark ? 'visible' : 'none' } },
    ],
  };
}
