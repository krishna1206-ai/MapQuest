// The OpenFreeMap "bright" style, tuned to read like mapquest.com: golden main roads, dark bold road
// names that show from lower zooms, and darker place names. Shared by the native and Expo Go maps.
import { useEffect, useState } from 'react';

export const STREETS_URL = 'https://tiles.openfreemap.org/styles/bright';
export const STREETS_DARK_URL = 'https://tiles.openfreemap.org/styles/dark';

type Json = Record<string, unknown>;
type StyleLayer = { id: string; type: string; minzoom?: number; layout?: Json; paint?: Json };
type Style = { layers: StyleLayer[] } & Json;

const ROAD_COLORS: Record<string, string> = {
  motorway: '#F4A62A',
  'motorway-link': '#F7BE5C',
  trunk: '#F9C74F',
  primary: '#F9C74F',
  'trunk-primary': '#F9C74F',
  'secondary-tertiary': '#FCE08A',
  link: '#FCE08A',
};

const NAME_SIZE = ['interpolate', ['linear'], ['zoom'], 12, 12, 15, 13.5, 18, 16];

function tune(style: Style): Style {
  const layers = style.layers.map((src) => {
    const l: StyleLayer = { ...src, layout: { ...src.layout }, paint: { ...src.paint } };

    // Road fills (also on bridges and in tunnels), not their casings.
    const road = /^(highway|bridge|tunnel)-(.+)$/.exec(l.id);
    if (l.type === 'line' && road && ROAD_COLORS[road[2]]) l.paint!['line-color'] = ROAD_COLORS[road[2]];

    if (l.type === 'symbol' && l.id.startsWith('highway-name')) {
      const major = l.id === 'highway-name-major';
      l.minzoom = major ? 11.5 : l.id === 'highway-name-minor' ? 13.5 : 15;
      l.layout!['text-size'] = NAME_SIZE;
      l.layout!['text-font'] = [major ? 'Noto Sans Bold' : 'Noto Sans Regular'];
      l.paint!['text-color'] = major ? '#202124' : '#3C4043';
      l.paint!['text-halo-color'] = '#FFFFFF';
      l.paint!['text-halo-width'] = 2;
    }

    if (l.type === 'symbol' && /^poi_r\d+$/.test(l.id)) {
      l.minzoom = Math.min(l.minzoom ?? 14, 14);
      l.paint!['text-color'] = '#444B4F';
      l.paint!['text-halo-width'] = 1.5;
    }
    return l;
  });
  return { ...style, layers };
}

let tuned: Promise<Style> | undefined;

function loadStreets(): Promise<Style> {
  tuned ??= fetch(STREETS_URL)
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<Style>;
    })
    .then(tune)
    .catch((e) => {
      tuned = undefined; // retry next time
      throw e;
    });
  return tuned;
}

/** The street style to show: the tuned light style once loaded, else the plain style URL. */
export function useStreetStyle(dark: boolean): string | object {
  const [style, setStyle] = useState<object>();
  useEffect(() => {
    if (dark) return;
    let live = true;
    loadStreets()
      .then((s) => live && setStyle(s))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [dark]);
  if (dark) return STREETS_DARK_URL;
  return style ?? STREETS_URL;
}
