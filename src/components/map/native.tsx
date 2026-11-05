// Native map built on MapLibre with OpenFreeMap's Google-like vector style (no Google SDK, no Google logo).
// Exposes the small MapView / Marker / Polyline API the app uses, so screens don't depend on the engine.
// The browser build uses index.web.tsx instead.
import { MaterialIcons } from '@expo/vector-icons';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker as MLMarker,
  NativeUserLocation,
  type CameraRef,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native';
import { useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme, type StyleProp, type ViewStyle } from 'react-native';
import type { Poi } from '../../api/pois';
import { useStreetStyle } from './mapStyle';
import { NAME_PEEK_MS, PLACE_LAYERS, placesGeoJson } from './placeLayers';

type LatLng = { latitude: number; longitude: number };
type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };
type Padding = { top: number; right: number; bottom: number; left: number };

// Same name as the component so screens can write useRef<MapView>, as with react-native-maps.
export type MapView = {
  animateToRegion: (r: Region, durationMs?: number) => void;
  fitToCoordinates: (coords: LatLng[], opts?: { edgePadding?: Padding; animated?: boolean }) => void;
  animateCamera: (
    camera: { center?: LatLng; zoom?: number; heading?: number; pitch?: number },
    opts?: { duration?: number },
  ) => void;
  zoomBy: (delta: number) => void;
};

const SATELLITE: StyleSpecification = {
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

type MapViewProps = {
  ref?: Ref<MapView>;
  style?: StyleProp<ViewStyle>;
  initialRegion?: Region;
  showsUserLocation?: boolean;
  mapType?: 'standard' | 'hybrid' | 'satellite';
  onRegionChangeComplete?: (r: Region) => void;
  onPress?: () => void;
  children?: ReactNode;
};

// eslint-disable-next-line @typescript-eslint/no-redeclare
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
  const camera = useRef<CameraRef>(null);
  const zoom = useRef(4);
  const dark = useColorScheme() === 'dark';
  const streets = useStreetStyle(dark);
  const mapStyle = mapType === 'standard' ? (streets as string | StyleSpecification) : SATELLITE;

  useImperativeHandle(
    ref,
    () => ({
      animateToRegion: (r, durationMs = 500) =>
        camera.current?.flyTo({ center: [r.longitude, r.latitude], zoom: zoomFor(r), duration: durationMs }),
      fitToCoordinates: (coords, opts) => {
        if (coords.length === 0) return;
        const lngs = coords.map((c) => c.longitude);
        const lats = coords.map((c) => c.latitude);
        camera.current?.fitBounds(
          [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
          { padding: opts?.edgePadding, duration: opts?.animated === false ? 0 : 600 },
        );
      },
      animateCamera: (cam, opts) => {
        if (!cam.center) return;
        camera.current?.easeTo({
          center: [cam.center.longitude, cam.center.latitude],
          zoom: cam.zoom,
          bearing: cam.heading,
          pitch: cam.pitch,
          duration: opts?.duration ?? 500,
        });
      },
      zoomBy: (delta) => camera.current?.zoomTo(Math.max(1, Math.min(20, zoom.current + delta)), { duration: 250 }),
    }),
    [],
  );

  const start = initialRegion ?? { latitude: 39.5, longitude: -98.35, latitudeDelta: 30, longitudeDelta: 30 };

  return (
    <Map
      style={style}
      mapStyle={mapStyle}
      logo={false}
      attribution
      attributionPosition={{ bottom: 8, right: 8 }}
      compass
      compassPosition={{ top: 190, left: 18 }}
      scaleBar
      scaleBarPosition={{ bottom: 12, left: 12 }}
      onPress={() => onPress?.()}
      onRegionDidChange={(e) => {
        const { center, bounds } = e.nativeEvent;
        zoom.current = e.nativeEvent.zoom;
        onRegionChangeComplete?.({
          latitude: center[1],
          longitude: center[0],
          latitudeDelta: bounds[3] - bounds[1],
          longitudeDelta: bounds[2] - bounds[0],
        });
      }}
    >
      <Camera ref={camera} initialViewState={{ center: [start.longitude, start.latitude], zoom: zoomFor(start) }} />
      {showsUserLocation && <NativeUserLocation mode="heading" />}
      {children}
    </Map>
  );
}

type MarkerProps = {
  coordinate: LatLng;
  title?: string;
  description?: string;
  pinColor?: string;
  onPress?: () => void;
};

export function Marker({ coordinate, title, pinColor = '#EA4335', onPress }: MarkerProps) {
  return (
    <MLMarker lngLat={[coordinate.longitude, coordinate.latitude]} anchor="bottom" onPress={() => onPress?.()}>
      <View accessibilityLabel={title} style={styles.pin}>
        <MaterialIcons name="place" size={40} color={pinColor} style={styles.pinShadow} />
      </View>
    </MLMarker>
  );
}

type PolylineProps = {
  coordinates: LatLng[];
  strokeColor?: string;
  strokeWidth?: number;
  lineCap?: string;
};

export function Polyline({ coordinates, strokeColor = '#1A73E8', strokeWidth = 6 }: PolylineProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const data = useMemo<GeoJSON.Feature>(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coordinates.map((c) => [c.longitude, c.latitude]) },
    }),
    [coordinates],
  );
  if (coordinates.length < 2) return null;

  // A darker casing under the line gives the Google-style route look.
  return (
    <GeoJSONSource id={`route-${id}`} data={data}>
      <Layer
        id={`route-casing-${id}`}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': '#0B57D0', 'line-width': strokeWidth + 3 }}
      />
      <Layer
        id={`route-line-${id}`}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': strokeColor, 'line-width': strokeWidth }}
      />
    </GeoJSONSource>
  );
}

type PlacesProps = {
  places: Poi[];
  onPress?: (place: Poi) => void;
};

/**
 * An icon for every place in view. Tapping an icon shows its name for a few seconds;
 * tapping the name opens the place.
 */
export function Places({ places, onPress }: PlacesProps) {
  const data = useMemo(() => placesGeoJson(places), [places]);
  const byId = useMemo(() => new globalThis.Map(places.map((p) => [p.id, p])), [places]);
  const [peek, setPeek] = useState<Poi | null>(null);

  useEffect(() => {
    if (!peek) return;
    const t = setTimeout(() => setPeek(null), NAME_PEEK_MS);
    return () => clearTimeout(t);
  }, [peek]);

  return (
    <>
      <GeoJSONSource
        id="places"
        data={data}
        hitbox={{ top: 14, right: 14, bottom: 14, left: 14 }}
        onPress={(e) => {
          const id = e.nativeEvent.features[0]?.properties?.id;
          const p = typeof id === 'string' ? byId.get(id) : undefined;
          if (p) {
            e.stopPropagation();
            setPeek(p);
          }
        }}
      >
        <Layer id="places-badge" {...(PLACE_LAYERS.badge as object)} type="circle" />
        <Layer id="places-icon" {...(PLACE_LAYERS.icon as object)} type="symbol" />
      </GeoJSONSource>
      {peek && (
        <MLMarker key={peek.id} lngLat={[peek.coord.longitude, peek.coord.latitude]} anchor="bottom" offset={[0, -14]}>
          <Pressable
            onPress={() => {
              setPeek(null);
              onPress?.(peek);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${peek.name}, open details`}
            style={styles.bubble}
          >
            <Text style={styles.bubbleText} numberOfLines={2}>
              {peek.name}
            </Text>
          </Pressable>
        </MLMarker>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  pin: { alignItems: 'center', justifyContent: 'flex-end' },
  pinShadow: { textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  bubble: {
    maxWidth: 220,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  bubbleText: { fontSize: 14, fontWeight: '600', color: '#202124' },
});
