/**
 * Central place for runtime configuration read from `.env`.
 * Expo inlines any `EXPO_PUBLIC_*` variable at build time.
 */
export type Units = 'imperial' | 'metric';

export const CONFIG = {
  mapquestKey: process.env.EXPO_PUBLIC_MAPQUEST_API_KEY ?? '',
  units: (process.env.EXPO_PUBLIC_UNITS === 'metric' ? 'metric' : 'imperial') as Units,
  tileUrlLight:
    process.env.EXPO_PUBLIC_TILE_URL_LIGHT ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileUrlDark:
    process.env.EXPO_PUBLIC_TILE_URL_DARK ??
    'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  /** Used until we know where the user is (or if permission is denied). [lng, lat] */
  fallbackCenter: [-73.9857, 40.7484] as [number, number],
  /** Delay before region changes trigger a nearby-places request. */
  regionDebounceMs: 800,
  /** Delay before typed text triggers an autocomplete request. */
  searchDebounceMs: 300,
};

export const hasApiKey = () =>
  CONFIG.mapquestKey.length > 0 && CONFIG.mapquestKey !== 'YOUR_MAPQUEST_API_KEY';
