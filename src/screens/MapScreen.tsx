import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CategoryChips } from '../components/CategoryChips';
import { IconButton } from '../components/IconButton';
import { MapWebView, type MapHandle, type MapMarker } from '../components/map/MapWebView';
import { PlaceBottomSheet } from '../components/PlaceBottomSheet';
import { SearchBar } from '../components/SearchBar';
import { StatusPill } from '../components/StatusPill';
import { useAppTheme } from '../hooks/useAppTheme';
import { useNearbyPlaces } from '../hooks/useNearbyPlaces';
import { useUserLocation } from '../hooks/useUserLocation';
import type { Place } from '../services/types';
import { CATEGORIES, type CategoryId } from '../utils/categories';
import { CONFIG } from '../utils/config';

export function MapScreen() {
  const router = useRouter();
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const camera = useRef<MapHandle>(null);

  const { permission, coordinate: userLocation, requestOrOpenSettings } = useUserLocation();
  const [filter, setFilter] = useState<CategoryId | 'all'>('all');
  const { places, loading, error, searched, onRegionChanged, retry } = useNearbyPlaces(filter);
  const [selected, setSelected] = useState<Place | null>(null);
  const [searchResult, setSearchResult] = useState<Place | null>(null);

  // Center on the user the first time we get a fix.
  const centeredOnce = useRef(false);
  useEffect(() => {
    if (userLocation && !centeredOnce.current) {
      centeredOnce.current = true;
      camera.current?.flyTo({ center: userLocation, zoom: 14, duration: 1200 });
    }
  }, [userLocation]);

  const recenter = useCallback(() => {
    if (userLocation) {
      camera.current?.flyTo({ center: userLocation, zoom: 15, bearing: 0, duration: 800 });
    } else {
      requestOrOpenSettings();
    }
  }, [userLocation, requestOrOpenSettings]);

  const selectPlace = useCallback((p: Place) => {
    setSelected(p);
    camera.current?.easeTo({ center: p.coordinate, duration: 500 });
  }, []);

  const onSearchSelect = useCallback(
    (p: Place) => {
      setSearchResult(p);
      setSelected(p);
      camera.current?.flyTo({ center: p.coordinate, zoom: 15, duration: 1000 });
    },
    [],
  );

  // Filter visible markers by chip (search result is always shown).
  const visible = useMemo(() => {
    const list = filter === 'all' ? places : places.filter((p) => p.category === filter);
    if (searchResult && !list.some((p) => p.id === searchResult.id)) return [...list, searchResult];
    return list;
  }, [places, filter, searchResult]);

  const markers = useMemo<MapMarker[]>(
    () =>
      visible.map((p) => ({
        id: p.id,
        lngLat: p.coordinate,
        color: CATEGORIES[p.category].color,
        icon: CATEGORIES[p.category].icon,
        selected: selected?.id === p.id,
      })),
    [visible, selected],
  );

  const onMarkerPress = useCallback(
    (id: string) => {
      const p = visible.find((x) => x.id === id);
      if (p) selectPlace(p);
    },
    [visible, selectPlace],
  );

  const status = (() => {
    if (permission === 'denied')
      return (
        <StatusPill
          kind="info"
          text="Location is off. Showing a default area."
          actionLabel="Enable"
          onAction={requestOrOpenSettings}
        />
      );
    if (permission === 'unavailable')
      return <StatusPill kind="info" text="Turn on location services to see places near you." />;
    if (loading) return <StatusPill kind="loading" text="Finding places nearby…" />;
    if (error) return <StatusPill kind="error" text={error} onAction={retry} />;
    if (searched && visible.length === 0) {
      const what = filter === 'all' ? 'places' : CATEGORIES[filter].label.toLowerCase();
      return <StatusPill kind="empty" text={`No ${what} found nearby. Try moving the map.`} />;
    }
    return null;
  })();

  return (
    <View style={[styles.flex, { backgroundColor: t.colors.background }]}>
      <MapWebView
        ref={camera}
        initialCenter={CONFIG.fallbackCenter}
        initialZoom={12}
        markers={markers}
        userLocation={permission === 'granted' ? userLocation : null}
        controlsTop={insets.top + 150}
        onMarkerPress={onMarkerPress}
        onPress={() => {
          Keyboard.dismiss();
          setSelected(null);
        }}
        onRegionDidChange={(r) => onRegionChanged(r.center)}
      />

      {/* Top overlay: search + chips + status */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.searchWrap}>
          <SearchBar userLocation={userLocation} onSelect={onSearchSelect} />
        </View>
        <View style={{ marginTop: 10 }}>
          <CategoryChips value={filter} onChange={setFilter} />
        </View>
        <View style={{ marginTop: 10 }} pointerEvents="box-none">
          {status}
        </View>
      </View>

      {/* Recenter */}
      {!selected && (
        <IconButton
          icon="crosshairs-gps"
          active={!!userLocation}
          accessibilityLabel="Recenter on my location"
          onPress={recenter}
          style={[styles.fab, { bottom: insets.bottom + 32 }]}
        />
      )}

      <PlaceBottomSheet
        place={selected}
        userLocation={userLocation}
        onClose={() => setSelected(null)}
        onDirections={(place) =>
          router.push({
            pathname: '/directions',
            params: {
              place: JSON.stringify(place),
              ...(userLocation ? { olng: String(userLocation[0]), olat: String(userLocation[1]) } : {}),
            },
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  searchWrap: { paddingHorizontal: 12 },
  fab: { position: 'absolute', right: 16 },
});
