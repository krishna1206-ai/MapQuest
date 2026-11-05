import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { IconButton } from '../components/IconButton';
import { MapWebView, type MapHandle, type MapMarker, type MapRoute } from '../components/map/MapWebView';
import { TravelModeTabs } from '../components/TravelModeTabs';
import { useAppTheme } from '../hooks/useAppTheme';
import { useRoute } from '../hooks/useRoute';
import { useUserLocation } from '../hooks/useUserLocation';
import type { Place, TravelMode } from '../services/types';
import { CATEGORIES } from '../utils/categories';
import { boundsOf, formatArrival, formatDistance, formatDuration, type LngLat } from '../utils/geo';

type Params = { place?: string; olng?: string; olat?: string };

function parsePlace(raw?: string): Place | null {
  try {
    const p = raw ? (JSON.parse(raw) as Place) : null;
    return p && Array.isArray(p.coordinate) ? p : null;
  } catch {
    return null;
  }
}

/** Route entry: validates params (e.g. a web refresh on /directions with no place). */
export function DirectionsScreen() {
  const params = useLocalSearchParams<Params>();
  const place = useMemo(() => parsePlace(params.place), [params.place]);
  const initialOrigin = useMemo<LngLat | null>(() => {
    const lng = Number(params.olng), lat = Number(params.olat);
    return params.olng && params.olat && isFinite(lng) && isFinite(lat) ? [lng, lat] : null;
  }, [params.olng, params.olat]);

  if (!place) return <Redirect href="/" />;
  return <Directions place={place} initialOrigin={initialOrigin} />;
}

function Directions({ place, initialOrigin }: { place: Place; initialOrigin: LngLat | null }) {
  const router = useRouter();
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const camera = useRef<MapHandle>(null);

  const { coordinate, permission, requestOrOpenSettings } = useUserLocation();
  const origin = coordinate ?? initialOrigin;
  const [mode, setMode] = useState<TravelMode>('car');
  const { route, loading, error, retry } = useRoute(origin, place.coordinate, mode);

  const line = useMemo<MapRoute | null>(
    () =>
      route
        ? { coords: route.coordinates, color: t.colors.route, casing: t.colors.routeCasing, dashed: mode === 'walk' }
        : null,
    // `mode` is read when `route` changes (a new mode always produces a new route).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [route, t.colors.route, t.colors.routeCasing],
  );

  const destination = useMemo<MapMarker[]>(
    () => [
      {
        id: 'destination',
        lngLat: place.coordinate,
        color: CATEGORIES[place.category].color,
        icon: CATEGORIES[place.category].icon,
        selected: true,
      },
    ],
    [place],
  );

  // Fit the whole route in view whenever it changes.
  useEffect(() => {
    const b = route ? boundsOf(route.coordinates) : null;
    if (!b) return;
    const timer = setTimeout(() => {
      camera.current?.fitBounds(b, {
        padding: { top: insets.top + 90, bottom: 330, left: 40, right: 40 },
        duration: 900,
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [route, insets.top]);

  const noOrigin = !origin;

  return (
    <View style={[styles.flex, { backgroundColor: t.colors.background }]}>
      <MapWebView
        ref={camera}
        initialCenter={place.coordinate}
        initialZoom={13}
        markers={destination}
        userLocation={permission === 'granted' ? coordinate : null}
        route={line}
        controlsTop={insets.top + 80}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <IconButton icon="arrow-left" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={[styles.headerCard, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
          <Text style={[styles.headerLabel, { color: t.colors.textMuted }]}>From: Your location</Text>
          <Text style={[styles.headerTitle, { color: t.colors.text }]} numberOfLines={1}>
            To: {place.name}
          </Text>
        </View>
      </View>

      {/* Bottom panel */}
      <View
        style={[
          styles.panel,
          { backgroundColor: t.colors.surface, borderColor: t.colors.border, paddingBottom: insets.bottom + 12 },
        ]}
      >
        <TravelModeTabs value={mode} onChange={setMode} />

        {noOrigin ? (
          <Message
            icon="crosshairs-gps"
            text="We need your location to get directions."
            action="Enable location"
            onAction={requestOrOpenSettings}
          />
        ) : loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={t.colors.primary} />
            <Text style={[styles.muted, { color: t.colors.textMuted }]}>Calculating route…</Text>
          </View>
        ) : error ? (
          <Message icon="alert-circle-outline" text={error} action="Retry" onAction={retry} danger />
        ) : route ? (
          <>
            <View style={styles.summary}>
              <View>
                <Text style={[styles.eta, { color: t.colors.text }]}>{formatDuration(route.durationSeconds)}</Text>
                <Text style={[styles.muted, { color: t.colors.textMuted }]}>
                  {formatDistance(route.distanceMeters)} · Arrive {formatArrival(route.durationSeconds)}
                </Text>
              </View>
              <MaterialCommunityIcons
                name={mode === 'car' ? 'car' : mode === 'walk' ? 'walk' : 'bike'}
                size={32}
                color={t.colors.primary}
              />
            </View>
            <FlatList
              style={styles.steps}
              data={route.maneuvers}
              keyExtractor={(_, i) => String(i)}
              ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: t.colors.border }]} />}
              renderItem={({ item, index }) => (
                <View style={styles.step}>
                  <View style={[styles.stepNum, { backgroundColor: t.colors.surfaceAlt }]}>
                    <Text style={[styles.stepNumText, { color: t.colors.text }]}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, { color: t.colors.text }]}>{item.narrative}</Text>
                  {item.distanceMeters > 0 && (
                    <Text style={[styles.muted, { color: t.colors.textMuted }]}>{formatDistance(item.distanceMeters)}</Text>
                  )}
                </View>
              )}
            />
          </>
        ) : null}
      </View>
    </View>
  );

  function Message(p: { icon: any; text: string; action: string; onAction: () => void; danger?: boolean }) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name={p.icon} size={28} color={p.danger ? t.colors.danger : t.colors.textMuted} />
        <Text style={[styles.msg, { color: t.colors.text }]}>{p.text}</Text>
        <Pressable onPress={p.onAction} style={[styles.btn, { backgroundColor: t.colors.primary }]}>
          <Text style={{ color: t.colors.primaryText, fontWeight: '700' }}>{p.action}</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  headerCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  headerLabel: { fontSize: 12 },
  headerTitle: { fontSize: 15, fontWeight: '700', marginTop: 1 },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '48%',
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  eta: { fontSize: 26, fontWeight: '800' },
  muted: { fontSize: 13 },
  steps: { flexGrow: 0 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 12, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 14, lineHeight: 19 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 38 },
  center: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  msg: { fontSize: 15, textAlign: 'center' },
  btn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
});
