// Browser stand-in for react-native-maps: the same MapView / Marker / Polyline API the app uses,
// drawn with Leaflet and CARTO Voyager tiles (a Google-like street style).
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { createContext, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { Poi } from '../../api/pois';
import { POI_COLORS } from '../../theme';
import { NAME_PEEK_MS } from './placeLayers';

type LatLng = { latitude: number; longitude: number };
type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };

type MapHandle = {
  animateToRegion: (r: Region, durationMs?: number) => void;
  fitToCoordinates: (
    coords: LatLng[],
    opts?: { edgePadding?: { top: number; right: number; bottom: number; left: number }; animated?: boolean },
  ) => void;
  animateCamera: (camera: { center?: LatLng; zoom?: number }, opts?: { duration?: number }) => void;
  zoomBy: (delta: number) => void;
};

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

const STREETS = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const IMAGERY = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const USER_BLUE = '#4285F4';

const MapContext = createContext<L.Map | null>(null);

const zoomFor = (r: Region) => Math.max(2, Math.min(18, Math.round(Math.log2(360 / Math.max(r.longitudeDelta, 1e-6)))));

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
  const [map, setMap] = useState<L.Map | null>(null);
  const callbacks = useRef({ onRegionChangeComplete, onPress });
  useEffect(() => {
    callbacks.current = { onRegionChangeComplete, onPress };
  });

  // Create the Leaflet map once the container div is in the DOM.
  const attach = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const m = L.map(node, { zoomControl: false });
    m.attributionControl.setPrefix(false);
    L.control.scale({ position: 'bottomleft', imperial: true, metric: false }).addTo(m);
    const r = initialRegion ?? { latitude: 39.5, longitude: -98.35, latitudeDelta: 30, longitudeDelta: 30 };
    m.setView([r.latitude, r.longitude], zoomFor(r));
    m.on('moveend', () => {
      const c = m.getCenter();
      const b = m.getBounds();
      callbacks.current.onRegionChangeComplete?.({
        latitude: c.lat,
        longitude: c.lng,
        latitudeDelta: b.getNorth() - b.getSouth(),
        longitudeDelta: b.getEast() - b.getWest(),
      });
    });
    m.on('click', () => callbacks.current.onPress?.());
    setMap(m);
    return () => {
      m.remove();
      setMap(null);
    };
    // The initial region only applies on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map) return;
    const layer =
      mapType === 'standard'
        ? L.tileLayer(STREETS, {
            subdomains: 'abcd',
            maxZoom: 20,
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
          })
        : L.tileLayer(IMAGERY, { maxZoom: 19, attribution: 'Imagery &copy; Esri' });
    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, mapType]);

  useEffect(() => {
    if (!map || !showsUserLocation || !navigator.geolocation) return;
    let dot: L.CircleMarker | undefined;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const at: L.LatLngExpression = [p.coords.latitude, p.coords.longitude];
        if (dot) dot.setLatLng(at);
        else
          dot = L.circleMarker(at, {
            radius: 8,
            color: '#FFFFFF',
            weight: 3,
            fillColor: USER_BLUE,
            fillOpacity: 1,
            interactive: false,
          }).addTo(map);
      },
      () => {},
      { enableHighAccuracy: true },
    );
    return () => {
      navigator.geolocation.clearWatch(id);
      dot?.remove();
    };
  }, [map, showsUserLocation]);

  useImperativeHandle(
    ref,
    () => ({
      animateToRegion: (r) => map?.flyTo([r.latitude, r.longitude], zoomFor(r), { duration: 0.6 }),
      fitToCoordinates: (coords, opts) => {
        if (!map || coords.length === 0) return;
        const p = opts?.edgePadding;
        map.fitBounds(L.latLngBounds(coords.map((c) => [c.latitude, c.longitude] as L.LatLngTuple)), {
          paddingTopLeft: [p?.left ?? 0, p?.top ?? 0],
          paddingBottomRight: [p?.right ?? 0, p?.bottom ?? 0],
          maxZoom: 17,
        });
      },
      animateCamera: (camera) => {
        if (map && camera.center) {
          map.setView([camera.center.latitude, camera.center.longitude], camera.zoom ?? map.getZoom(), { animate: true });
        }
      },
      zoomBy: (delta) => map?.setZoom(map.getZoom() + delta),
    }),
    [map],
  );

  return (
    <View style={style}>
      {/* zIndex 0 keeps Leaflet's panes underneath the app's overlays. */}
      <div ref={attach} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
      <MapContext.Provider value={map}>{children}</MapContext.Provider>
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

const pinSvg = (color: string) =>
  `<svg width="27" height="43" viewBox="0 0 27 43" xmlns="http://www.w3.org/2000/svg">
     <path d="M13.5 0C6 0 0 6 0 13.5 0 23.6 13.5 43 13.5 43S27 23.6 27 13.5C27 6 21 0 13.5 0z" fill="${color}" stroke="rgba(0,0,0,.25)"/>
     <circle cx="13.5" cy="13.5" r="5" fill="#fff"/>
   </svg>`;

export function Marker({ coordinate, title, pinColor = '#EA4335', onPress }: MarkerProps) {
  const map = useContext(MapContext);
  const press = useRef(onPress);
  useEffect(() => {
    press.current = onPress;
  });

  const { latitude, longitude } = coordinate;
  useEffect(() => {
    if (!map) return;
    const icon = L.divIcon({ className: '', html: pinSvg(pinColor), iconSize: [27, 43], iconAnchor: [13.5, 43] });
    const marker = L.marker([latitude, longitude], { icon, title }).addTo(map);
    marker.on('click', () => press.current?.());
    return () => {
      marker.remove();
    };
  }, [map, latitude, longitude, pinColor, title]);

  return null;
}

// Place icons: a white badge ringed in the category color with a MaterialIcons glyph (the app's icon font).
const PLACE_CSS = `
.mq-poi { width: 22px; height: 22px; border-radius: 50%; background: #fff; border: 2px solid; box-sizing: border-box;
  display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,.35);
  font-family: material; font-size: 13px; line-height: 1; cursor: pointer; }
.mq-peek { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); max-width: 220px; width: max-content;
  padding: 7px 12px; border-radius: 10px; background: #fff; color: #202124; cursor: pointer;
  font: 600 14px/1.25 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
`;
let placeCssAdded = false;

function placeIcon(p: Poi): L.DivIcon {
  const color = POI_COLORS[p.kind];
  const glyph = String.fromCharCode(Number(MaterialIcons.glyphMap[p.icon] ?? 0xe55f));
  return L.divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<div class="mq-poi" style="border-color:${color};color:${color}">${glyph}</div>`,
  });
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

type PlacesProps = {
  places: Poi[];
  onPress?: (place: Poi) => void;
};

/**
 * An icon for every place in view. Tapping an icon shows its name for a few seconds;
 * tapping the name opens the place.
 */
export function Places({ places, onPress }: PlacesProps) {
  const map = useContext(MapContext);
  const press = useRef(onPress);
  useEffect(() => {
    press.current = onPress;
  });

  useEffect(() => {
    if (!map) return;
    if (!placeCssAdded) {
      const el = document.createElement('style');
      el.textContent = PLACE_CSS;
      document.head.appendChild(el);
      placeCssAdded = true;
    }
    const shown = new Map<string, L.Marker>();
    let peek: L.Marker | undefined;
    let peekTimer: ReturnType<typeof setTimeout> | undefined;
    const hidePeek = () => {
      peek?.remove();
      peek = undefined;
      clearTimeout(peekTimer);
    };
    const showPeek = (p: Poi) => {
      hidePeek();
      const icon = L.divIcon({
        className: '',
        iconSize: [0, 0],
        iconAnchor: [0, 16],
        html: `<div class="mq-peek">${escapeHtml(p.name)}</div>`,
      });
      const m = L.marker([p.coord.latitude, p.coord.longitude], { icon, zIndexOffset: 1000 });
      m.on('click', () => {
        hidePeek();
        press.current?.(p);
      });
      peek = m.addTo(map);
      peekTimer = setTimeout(hidePeek, NAME_PEEK_MS);
    };

    // Only places on screen get DOM markers, so a whole city of icons stays smooth to pan.
    const sync = () => {
      const view = map.getBounds().pad(0.2);
      const keep = new Set<string>();
      for (const p of places) {
        if (!view.contains([p.coord.latitude, p.coord.longitude])) continue;
        keep.add(p.id);
        if (shown.has(p.id)) continue;
        const m = L.marker([p.coord.latitude, p.coord.longitude], { icon: placeIcon(p), title: p.name, zIndexOffset: -1000 });
        m.on('click', () => showPeek(p));
        shown.set(p.id, m.addTo(map));
      }
      shown.forEach((m, id) => {
        if (!keep.has(id)) {
          m.remove();
          shown.delete(id);
        }
      });
    };

    sync();
    map.on('moveend', sync);
    return () => {
      map.off('moveend', sync);
      hidePeek();
      shown.forEach((m) => m.remove());
    };
  }, [map, places]);

  return null;
}


type PolylineProps = {
  coordinates: LatLng[];
  strokeColor?: string;
  strokeWidth?: number;
  lineCap?: string;
};

export function Polyline({ coordinates, strokeColor = USER_BLUE, strokeWidth = 5 }: PolylineProps) {
  const map = useContext(MapContext);
  useEffect(() => {
    if (!map || coordinates.length < 2) return;
    const line = L.polyline(
      coordinates.map((c) => [c.latitude, c.longitude] as L.LatLngTuple),
      { color: strokeColor, weight: strokeWidth, opacity: 0.9 },
    ).addTo(map);
    return () => {
      line.remove();
    };
  }, [map, coordinates, strokeColor, strokeWidth]);
  return null;
}
