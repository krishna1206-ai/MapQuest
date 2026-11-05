// Expo Go stand-in for the native MapLibre map: MapLibre GL JS with the same OpenFreeMap style, inside a WebView.
// Expo Go has no MapLibre native module; the installed app uses native.tsx instead.
import * as Location from 'expo-location';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  type ComponentRef,
  type ReactNode,
  type Ref,
} from 'react';
import { StyleSheet, View, useColorScheme, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { Poi } from '../../api/pois';
import type { MapView as MapHandle } from './native';
import { STREETS_URL, useStreetStyle } from './mapStyle';
import { NAME_PEEK_MS, PLACE_LAYERS, placesGeoJson } from './placeLayers';

type LatLng = { latitude: number; longitude: number };
type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };
type Msg = { type: string } & Record<string, unknown>;

const SATELLITE = {
  version: 8,
  sources: {
    imagery: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagery © Esri',
    },
  },
  layers: [{ id: 'imagery', type: 'raster', source: 'imagery' }],
};

const zoomFor = (r: Region) => Math.max(1, Math.min(19, Math.log2(360 / Math.max(r.longitudeDelta, 1e-6))));

type Registry = {
  send: (m: Msg) => void;
  onMarkerPress: (id: string, fn: (() => void) | undefined) => void;
  onPlacePress: (fn: ((id: string) => void) | undefined) => void;
};
const MapContext = createContext<Registry | null>(null);

type MapViewProps = {
  ref?: Ref<MapHandle>;
  style?: StyleProp<ViewStyle>;
  initialRegion?: Region;
  showsUserLocation?: boolean;
  mapType?: 'standard' | 'hybrid' | 'satellite';
  onRegionChangeComplete?: (r: Region) => void;
  onPress?: () => void;
  children?: ReactNode;
};

export function MapView({
  ref,
  style,
  initialRegion,
  showsUserLocation,
  mapType = 'standard',
  onRegionChangeComplete,
  onPress,
  children,
}: MapViewProps) {
  const web = useRef<ComponentRef<typeof WebView>>(null);
  const ready = useRef(false);
  const queue = useRef<Msg[]>([]);
  const markerPress = useRef(new Map<string, () => void>());
  const placePress = useRef<((id: string) => void) | undefined>(undefined);
  const callbacks = useRef({ onRegionChangeComplete, onPress });
  useEffect(() => {
    callbacks.current = { onRegionChangeComplete, onPress };
  });

  const send = useCallback((m: Msg) => {
    if (!ready.current) {
      queue.current.push(m);
      return;
    }
    web.current?.injectJavaScript(`window.app && window.app.handle(${JSON.stringify(m)}); true;`);
  }, []);

  const registry = useMemo<Registry>(
    () => ({
      send,
      onMarkerPress: (id, fn) => {
        if (fn) markerPress.current.set(id, fn);
        else markerPress.current.delete(id);
      },
      onPlacePress: (fn) => {
        placePress.current = fn;
      },
    }),
    [send],
  );

  const dark = useColorScheme() === 'dark';
  const streets = useStreetStyle(dark);
  useEffect(() => {
    send({ type: 'style', style: mapType === 'standard' ? streets : SATELLITE });
  }, [mapType, streets, send]);

  useEffect(() => {
    if (!showsUserLocation) return;
    let sub: Location.LocationSubscription | undefined;
    let cancelled = false;
    Location.getForegroundPermissionsAsync()
      .then(({ granted }) =>
        granted
          ? Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 5 }, (l) =>
              send({ type: 'user', lng: l.coords.longitude, lat: l.coords.latitude }),
            )
          : undefined,
      )
      .then((s) => {
        if (cancelled) s?.remove();
        else sub = s;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [showsUserLocation, send]);

  useImperativeHandle(
    ref,
    () => ({
      animateToRegion: (r, durationMs = 500) =>
        send({ type: 'flyTo', center: [r.longitude, r.latitude], zoom: zoomFor(r), duration: durationMs }),
      fitToCoordinates: (coords, opts) => {
        if (coords.length === 0) return;
        const lngs = coords.map((c) => c.longitude);
        const lats = coords.map((c) => c.latitude);
        send({
          type: 'fit',
          bounds: [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          padding: opts?.edgePadding ?? 40,
          duration: opts?.animated === false ? 0 : 600,
        });
      },
      animateCamera: (cam, opts) => {
        if (!cam.center) return;
        send({
          type: 'ease',
          center: [cam.center.longitude, cam.center.latitude],
          zoom: cam.zoom,
          bearing: cam.heading,
          pitch: cam.pitch,
          duration: opts?.duration ?? 500,
        });
      },
      zoomBy: (delta) => send({ type: 'zoomBy', delta }),
    }),
    [send],
  );

  const start = initialRegion ?? { latitude: 39.5, longitude: -98.35, latitudeDelta: 30, longitudeDelta: 30 };
  // Built once; later style changes go through messages so the map is never reloaded.
  const html = useMemo(
    () => buildHtml(STREETS_URL, [start.longitude, start.latitude], zoomFor(start)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onMessage = (e: WebViewMessageEvent) => {
    let m: { type: string; id?: string; lat?: number; lng?: number; latDelta?: number; lngDelta?: number };
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (m.type === 'ready') {
      ready.current = true;
      const pending = queue.current;
      queue.current = [];
      pending.forEach(send);
    } else if (m.type === 'marker' && m.id) {
      markerPress.current.get(m.id)?.();
    } else if (m.type === 'place' && m.id) {
      placePress.current?.(m.id);
    } else if (m.type === 'press') {
      callbacks.current.onPress?.();
    } else if (m.type === 'move' && m.lat != null && m.lng != null) {
      callbacks.current.onRegionChangeComplete?.({
        latitude: m.lat,
        longitude: m.lng,
        latitudeDelta: m.latDelta ?? 0,
        longitudeDelta: m.lngDelta ?? 0,
      });
    }
  };

  return (
    <View style={style}>
      <WebView
        ref={web}
        style={StyleSheet.absoluteFill}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://app.mapquest.local/' }}
        onMessage={onMessage}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
      />
      <MapContext.Provider value={registry}>{children}</MapContext.Provider>
    </View>
  );
}

type MarkerProps = {
  coordinate: LatLng;
  title?: string;
  description?: string;
  pinColor?: string;
  onPress?: () => void;
};

export function Marker({ coordinate, pinColor = '#EA4335', onPress }: MarkerProps) {
  const reg = useContext(MapContext);
  const id = useId();
  const { latitude, longitude } = coordinate;

  useEffect(() => {
    reg?.onMarkerPress(id, onPress);
  }, [reg, id, onPress]);

  useEffect(() => {
    reg?.send({ type: 'marker', id, lngLat: [longitude, latitude], color: pinColor });
  }, [reg, id, latitude, longitude, pinColor]);

  useEffect(
    () => () => {
      reg?.send({ type: 'unmarker', id });
      reg?.onMarkerPress(id, undefined);
    },
    [reg, id],
  );

  return null;
}

type PolylineProps = {
  coordinates: LatLng[];
  strokeColor?: string;
  strokeWidth?: number;
  lineCap?: string;
};

export function Polyline({ coordinates, strokeColor = '#1A73E8', strokeWidth = 6 }: PolylineProps) {
  const reg = useContext(MapContext);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');

  useEffect(() => {
    if (!reg || coordinates.length < 2) return;
    reg.send({
      type: 'line',
      id,
      coords: coordinates.map((c) => [c.longitude, c.latitude]),
      color: strokeColor,
      width: strokeWidth,
    });
    return () => reg.send({ type: 'unline', id });
  }, [reg, id, coordinates, strokeColor, strokeWidth]);

  return null;
}

type PlacesProps = {
  places: Poi[];
  onPress?: (place: Poi) => void;
};

/**
 * An icon for every place in view. Tapping an icon shows its name for a few seconds (inside the WebView);
 * tapping the name opens the place.
 */
export function Places({ places, onPress }: PlacesProps) {
  const reg = useContext(MapContext);
  const press = useRef(onPress);
  const byId = useRef(new Map<string, Poi>());
  useEffect(() => {
    press.current = onPress;
    byId.current = new Map(places.map((p) => [p.id, p]));
  });

  useEffect(() => {
    if (!reg) return;
    reg.onPlacePress((id) => {
      const p = byId.current.get(id);
      if (p) press.current?.(p);
    });
    return () => reg.onPlacePress(undefined);
  }, [reg]);

  useEffect(() => {
    reg?.send({ type: 'places', data: placesGeoJson(places), layers: PLACE_LAYERS, peekMs: NAME_PEEK_MS });
  }, [reg, places]);

  useEffect(() => () => reg?.send({ type: 'places', data: null }), [reg]);

  return null;
}

function buildHtml(style: string, center: [number, number], zoom: number): string {
  return `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"/>
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<style>
  html, body, #map { margin: 0; height: 100%; width: 100%; }
  .me { width: 18px; height: 18px; border-radius: 50%; background: #4285F4; border: 3px solid #fff;
        box-shadow: 0 0 0 6px rgba(66,133,244,.25), 0 1px 4px rgba(0,0,0,.4); box-sizing: border-box; }
  .pin { width: 30px; height: 40px; cursor: pointer; filter: drop-shadow(0 1px 2px rgba(0,0,0,.4)); }
  .peek { max-width: 220px; padding: 7px 12px; border-radius: 10px; background: #fff; color: #202124;
          font: 600 14px/1.25 system-ui, sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,.25); cursor: pointer; }
</style>
</head><body><div id="map"></div>
<script>
(function () {
  var post = function (m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  var map = new maplibregl.Map({
    container: 'map', style: ${JSON.stringify(style)}, center: ${JSON.stringify(center)}, zoom: ${zoom},
    attributionControl: { compact: true }
  });
  map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-left');

  var markers = {}, lines = {}, me = null, currentStyle = JSON.stringify(${JSON.stringify(style)});

  var pinHtml = function (color) {
    return '<svg class="pin" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill="' + color + '"/>' +
      '<circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>';
  };

  var removeLine = function (id) {
    ['line-', 'case-'].forEach(function (p) { if (map.getLayer(p + id)) map.removeLayer(p + id); });
    if (map.getSource('src-' + id)) map.removeSource('src-' + id);
  };
  var drawLine = function (id) {
    var l = lines[id];
    if (!l || !map.isStyleLoaded()) return;
    try {
      removeLine(id);
      map.addSource('src-' + id, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: l.coords } } });
      var layout = { 'line-cap': 'round', 'line-join': 'round' };
      map.addLayer({ id: 'case-' + id, type: 'line', source: 'src-' + id, layout: layout, paint: { 'line-color': '#0B57D0', 'line-width': l.width + 3 } });
      map.addLayer({ id: 'line-' + id, type: 'line', source: 'src-' + id, layout: layout, paint: { 'line-color': l.color, 'line-width': l.width } });
    } catch (e) {}
  };
  // A style change wipes custom layers, so redraw routes once the new style is in.
  var places = null;
  var PLACE_IDS = ['places-badge', 'places-icon'];
  var peek = null, peekTimer = null;
  var hidePeek = function () { if (peek) { peek.remove(); peek = null; } clearTimeout(peekTimer); };
  var showPeek = function (f) {
    hidePeek();
    var el = document.createElement('div');
    el.className = 'peek';
    el.textContent = f.properties.name;
    var id = f.properties.id;
    el.addEventListener('click', function (e) { e.stopPropagation(); hidePeek(); post({ type: 'place', id: id }); });
    peek = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -14] }).setLngLat(f.geometry.coordinates).addTo(map);
    peekTimer = setTimeout(hidePeek, (places && places.peekMs) || 3000);
  };
  var drawPlaces = function () {
    if (!map.isStyleLoaded()) return;
    try {
      PLACE_IDS.forEach(function (id) { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource('places')) map.removeSource('places');
      // Satellite imagery has no icon sheet, so places only show on the street map.
      if (!places || !map.getStyle().sprite) return;
      map.addSource('places', { type: 'geojson', data: places.data });
      var l = places.layers;
      [['places-badge', l.badge], ['places-icon', l.icon]].forEach(function (x) {
        map.addLayer(Object.assign({ id: x[0], source: 'places' }, x[1]));
      });
    } catch (e) {}
  };
  map.on('style.load', function () { Object.keys(lines).forEach(drawLine); drawPlaces(); });

  map.on('moveend', function () {
    var c = map.getCenter(), b = map.getBounds();
    post({ type: 'move', lat: c.lat, lng: c.lng, latDelta: b.getNorth() - b.getSouth(), lngDelta: b.getEast() - b.getWest() });
  });
  map.on('click', function (e) {
    var hit = map.getLayer('places-badge')
      ? map.queryRenderedFeatures([[e.point.x - 12, e.point.y - 12], [e.point.x + 12, e.point.y + 12]], { layers: PLACE_IDS })
      : [];
    if (hit.length) showPeek(hit[0]);
    else { hidePeek(); post({ type: 'press' }); }
  });

  window.app = { handle: function (m) {
    switch (m.type) {
      case 'style':
        var next = JSON.stringify(m.style);
        if (next !== currentStyle) { currentStyle = next; map.setStyle(m.style); }
        break;
      case 'user':
        if (!me) { var el = document.createElement('div'); el.className = 'me'; me = new maplibregl.Marker({ element: el }).setLngLat([m.lng, m.lat]).addTo(map); }
        else me.setLngLat([m.lng, m.lat]);
        break;
      case 'marker':
        if (markers[m.id]) markers[m.id].remove();
        var pin = document.createElement('div');
        pin.innerHTML = pinHtml(m.color);
        pin.addEventListener('click', function (e) { e.stopPropagation(); post({ type: 'marker', id: m.id }); });
        markers[m.id] = new maplibregl.Marker({ element: pin, anchor: 'bottom' }).setLngLat(m.lngLat).addTo(map);
        break;
      case 'unmarker':
        if (markers[m.id]) { markers[m.id].remove(); delete markers[m.id]; }
        break;
      case 'line': lines[m.id] = m; drawLine(m.id); break;
      case 'unline': delete lines[m.id]; removeLine(m.id); break;
      case 'places':
        if (places && m.data && map.getSource('places')) { places.data = m.data; map.getSource('places').setData(m.data); }
        else { places = m.data ? m : null; drawPlaces(); }
        break;
      case 'flyTo': map.flyTo({ center: m.center, zoom: m.zoom, duration: m.duration }); break;
      case 'fit': map.fitBounds(m.bounds, { padding: m.padding, duration: m.duration, maxZoom: 17 }); break;
      case 'ease':
        var opts = { center: m.center, duration: m.duration };
        if (m.zoom != null) opts.zoom = m.zoom;
        if (m.bearing != null) opts.bearing = m.bearing;
        if (m.pitch != null) opts.pitch = m.pitch;
        map.easeTo(opts);
        break;
      case 'zoomBy': map.zoomTo(map.getZoom() + m.delta, { duration: 250 }); break;
    }
  } };

  map.on('load', function () { post({ type: 'ready' }); });
})();
</script></body></html>`;
}
