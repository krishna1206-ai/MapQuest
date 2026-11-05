import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, Linking, Pressable, Share, StyleSheet, Text, View, useWindowDimensions, type TextInput } from 'react-native';
import type { ComponentRef } from 'react';
import { MapView, Marker, Places, Polyline } from '../components/map';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { capabilities, getRoute, searchAhead, searchNearby, type Place, type Route, type RouteOptions } from '../api';
import { CategoryChips } from '../components/CategoryChips';
import { DirectionsPanel } from '../components/DirectionsPanel';
import { MapControls } from '../components/MapControls';
import { NavigationView } from '../components/NavigationView';
import { PlaceCard } from '../components/PlaceCard';
import { ResultsList } from '../components/ResultsList';
import { SearchBar } from '../components/SearchBar';
import { Suggestions } from '../components/Suggestions';
import { useDebounced } from '../hooks/useDebounced';
import { usePlacesInView, type Region } from '../hooks/usePlacesInView';
import { useRecents } from '../hooks/useRecents';
import { useTurnByTurn } from '../hooks/useTurnByTurn';
import { useUserLocation } from '../hooks/useUserLocation';
import { useTheme } from '../theme';
import { haversineMiles, US_REGION, type LatLng } from '../utils/geo';

type Mode = 'browse' | 'results' | 'place' | 'directions' | 'navigate';

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.');

export function MapScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const mapRef = useRef<MapView>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const { location, heading, denied } = useUserLocation();
  const { recents, addRecent, clearRecents } = useRecents();

  const [mode, setMode] = useState<Mode>('browse');
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  // Set by the Directions chip: the next place picked goes straight to directions.
  const [pickingDestination, setPickingDestination] = useState(false);
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [suggestError, setSuggestError] = useState<string>();

  const [results, setResults] = useState<Place[]>([]);
  const [resultsTitle, setResultsTitle] = useState('');
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState<string>();

  const [selected, setSelected] = useState<Place | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [routeOpts, setRouteOpts] = useState<RouteOptions>({ mode: 'fastest', avoidTolls: false, avoidHighways: false });
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string>();

  const [satellite, setSatellite] = useState(false);
  const [muted, setMuted] = useState(false);
  const [region, setRegion] = useState<Region | null>(null);
  // Label every hotel, hospital, shop… in view while browsing, like mapquest.com.
  const places = usePlacesInView(region, !satellite && (mode === 'browse' || mode === 'results' || mode === 'place'));

  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);
  const mapCenter = useRef<LatLng>({ latitude: US_REGION.latitude, longitude: US_REGION.longitude });
  const centeredOnce = useRef(false);
  const searchSeq = useRef(0);

  const debouncedQuery = useDebounced(query.trim());

  // Jump to the user the first time we get a fix.
  useEffect(() => {
    if (location && !centeredOnce.current) {
      centeredOnce.current = true;
      mapRef.current?.animateToRegion({ ...location, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 600);
    }
  }, [location]);

  // Autocomplete while typing.
  useEffect(() => {
    if (!searchFocused || debouncedQuery.length < 2) return;
    let stale = false;
    searchAhead(debouncedQuery, locationRef.current ?? mapCenter.current)
      .then((r) => {
        if (stale) return;
        setSuggestions(r);
        setSuggestError(r.length ? undefined : 'No matches. Press search to look nearby.');
      })
      .catch((e) => {
        if (stale) return;
        setSuggestions([]);
        setSuggestError(errorMessage(e));
      });
    return () => {
      stale = true;
    };
  }, [debouncedQuery, searchFocused]);

  const fitTo = useCallback(
    (coords: LatLng[]) => {
      if (coords.length === 0) return;
      if (coords.length === 1) {
        const p = coords[0];
        // Nudge the point up so it sits above the bottom sheet.
        mapRef.current?.animateToRegion(
          { latitude: p.latitude - 0.004, longitude: p.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
          500,
        );
        return;
      }
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: insets.top + 140, right: 70, bottom: height * 0.5, left: 40 },
        animated: true,
      });
    },
    [height, insets.top],
  );

  const clearAll = () => {
    searchSeq.current++;
    setQuery('');
    setSuggestions([]);
    setResults([]);
    setResultsError(undefined);
    setSelected(null);
    setRoute(null);
    setMode('browse');
  };

  const runSearch = async (title: string, q: string) => {
    Keyboard.dismiss();
    setSearchFocused(false);
    setQuery(title);
    setSelected(null);
    setRoute(null);
    setResults([]);
    setResultsTitle(title);
    setResultsError(undefined);
    setResultsLoading(true);
    setMode('results');

    const seq = ++searchSeq.current;
    try {
      const r = await searchNearby(q, locationRef.current ?? mapCenter.current);
      if (seq !== searchSeq.current) return;
      setResults(r);
      fitTo(r.flatMap((p) => (p.coord ? [p.coord] : [])));
    } catch (e) {
      if (seq === searchSeq.current) setResultsError(errorMessage(e));
    } finally {
      if (seq === searchSeq.current) setResultsLoading(false);
    }
  };

  const selectPlace = (p: Place, fromSearch = false) => {
    Keyboard.dismiss();
    setSearchFocused(false);
    if (p.isCategory || !p.coord) {
      runSearch(p.name, p.name);
      return;
    }
    addRecent(p);
    if (fromSearch) {
      setQuery(p.name);
      setResults([]);
    }
    const here = locationRef.current;
    setSelected(here ? { ...p, distanceMiles: haversineMiles(here, p.coord) } : p);
    setRoute(null);
    if (pickingDestination) {
      setPickingDestination(false);
      setMode('directions');
    } else {
      setMode('place');
      fitTo([p.coord]);
    }
  };

  const startDirections = () => {
    setPickingDestination(true);
    setSearchFocused(true);
    inputRef.current?.focus();
  };

  const shareMap = () => {
    const c = locationRef.current ?? mapCenter.current;
    const lat = c.latitude.toFixed(5);
    const lng = c.longitude.toFixed(5);
    Share.share({ message: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}` }).catch(() => {});
  };

  // Fetch (and re-fetch on option change) the route while the directions panel is open.
  const hasLocation = location != null;
  useEffect(() => {
    if (mode !== 'directions' || !selected?.coord) return;
    const from = locationRef.current;
    if (!from) {
      setRouteError(denied ? 'Allow location access to get directions.' : 'Finding your location…');
      return;
    }
    const to = selected.coord;
    let stale = false;
    setRouteLoading(true);
    setRouteError(undefined);
    getRoute(from, to, routeOpts)
      .then((r) => {
        if (stale) return;
        setRoute(r);
        fitTo(r.shape.length > 1 ? r.shape : [from, to]);
      })
      .catch((e) => {
        if (stale) return;
        setRoute(null);
        setRouteError(errorMessage(e));
      })
      .finally(() => !stale && setRouteLoading(false));
    return () => {
      stale = true;
    };
  }, [mode, selected, routeOpts, hasLocation, denied, fitTo]);

  const endNavigation = useCallback(() => {
    setMode('directions');
  }, []);

  const arrive = useCallback(() => {
    setRoute(null);
    setMode('place');
  }, []);

  const reroute = useCallback(() => {
    const from = locationRef.current;
    if (!from || !selected?.coord) return;
    getRoute(from, selected.coord, routeOpts)
      .then(setRoute)
      .catch(() => {});
  }, [selected, routeOpts]);

  const nav = useTurnByTurn({
    route,
    location,
    active: mode === 'navigate',
    muted,
    onOffRoute: reroute,
    onArrive: arrive,
  });

  // Follow the user with a tilted camera while navigating, and keep the screen on.
  useEffect(() => {
    if (mode !== 'navigate' || !location) return;
    mapRef.current?.animateCamera(
      { center: location, heading, pitch: 50, zoom: 17 },
      { duration: 600 },
    );
  }, [mode, location, heading]);

  useEffect(() => {
    if (mode !== 'navigate') return;
    activateKeepAwakeAsync('navigation').catch(() => {});
    return () => {
      deactivateKeepAwake('navigation').catch(() => {});
    };
  }, [mode]);

  const goBack = (): boolean => {
    if (searchFocused) {
      Keyboard.dismiss();
      setSearchFocused(false);
      setPickingDestination(false);
      return true;
    }
    switch (mode) {
      case 'navigate':
        endNavigation();
        return true;
      case 'directions':
        setRoute(null);
        setRouteError(undefined);
        setMode('place');
        if (selected?.coord) fitTo([selected.coord]);
        return true;
      case 'place':
        setSelected(null);
        if (results.length) {
          setMode('results');
          setQuery(resultsTitle);
        } else {
          clearAll();
        }
        return true;
      case 'results':
        clearAll();
        return true;
      default:
        return false;
    }
  };

  const backRef = useRef(goBack);
  useEffect(() => {
    backRef.current = goBack;
  });
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => backRef.current());
    return () => sub.remove();
  }, []);

  const recenter = () => {
    const here = locationRef.current;
    if (here) mapRef.current?.animateToRegion({ ...here, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500);
    else if (denied) Linking.openSettings();
  };

  const showSearch = mode === 'browse' || mode === 'results' || mode === 'place';
  const showRoute = (mode === 'directions' || mode === 'navigate') && route;
  const markers = mode === 'results' || mode === 'place' ? results : [];
  const showSelectedMarker = selected?.coord && !markers.some((m) => m.id === selected.id);

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={US_REGION}
        showsUserLocation
        mapType={satellite ? 'hybrid' : 'standard'}
        onRegionChangeComplete={(r) => {
          mapCenter.current = { latitude: r.latitude, longitude: r.longitude };
          setRegion(r);
        }}
        onPress={() => searchFocused && goBack()}
      >
        <Places places={places} onPress={(p) => selectPlace(p)} />
        {markers.map((p) =>
          p.coord ? (
            <Marker
              key={p.id}
              coordinate={p.coord}
              title={p.name}
              description={p.address}
              pinColor={selected?.id === p.id ? t.danger : t.primary}
              onPress={() => selectPlace(p)}
            />
          ) : null,
        )}
        {showSelectedMarker && selected?.coord && (
          <Marker coordinate={selected.coord} title={selected.name} pinColor={t.danger} />
        )}
        {showRoute && <Polyline coordinates={route.shape} strokeColor={t.route} strokeWidth={6} lineCap="round" />}
      </MapView>

      {showSearch && (
        <View style={[styles.top, { top: insets.top + 8 }]}>
          <SearchBar
            inputRef={inputRef}
            placeholder={pickingDestination ? 'Where to? Search a destination' : undefined}
            value={query}
            onChangeText={setQuery}
            onSubmit={() => query.trim() && runSearch(query.trim(), query.trim())}
            onFocus={() => setSearchFocused(true)}
            onBack={searchFocused || mode !== 'browse' ? goBack : undefined}
            onClear={() => {
              setQuery('');
              if (mode !== 'browse') clearAll();
            }}
          />
          {searchFocused ? (
            <Suggestions
              items={query.trim().length < 2 ? recents : suggestions}
              showingRecents={query.trim().length < 2}
              message={query.trim().length < 2 ? undefined : suggestError}
              onPick={(p) => selectPlace(p, true)}
              onClearRecents={clearRecents}
            />
          ) : (
            mode !== 'place' && <CategoryChips onDirections={startDirections} onPick={runSearch} />
          )}
        </View>
      )}

      {mode !== 'navigate' && !searchFocused && (
        <View style={[styles.controls, { top: insets.top + (showSearch ? 132 : 16) }]}>
          <MapControls
            satellite={satellite}
            onZoomIn={() => mapRef.current?.zoomBy(1)}
            onZoomOut={() => mapRef.current?.zoomBy(-1)}
            onToggleSatellite={() => setSatellite((v) => !v)}
            onRecenter={recenter}
            onShare={shareMap}
          />
        </View>
      )}

      {mode === 'browse' && denied && !searchFocused && (
        <Pressable
          onPress={() => Linking.openSettings()}
          style={[styles.notice, { bottom: insets.bottom + 16, backgroundColor: t.bg }]}
        >
          <Text style={{ color: t.text }}>
            Location is off. <Text style={{ color: t.primary, fontWeight: '600' }}>Turn it on in Settings</Text>
          </Text>
        </Pressable>
      )}

      {mode === 'results' && !searchFocused && (
        <ResultsList
          title={resultsTitle}
          results={results}
          loading={resultsLoading}
          error={resultsError}
          onPick={(p) => selectPlace(p)}
          onDirections={(p) => {
            selectPlace(p);
            setMode('directions');
          }}
          onClose={clearAll}
        />
      )}

      {mode === 'place' && selected && !searchFocused && (
        <PlaceCard place={selected} onDirections={() => setMode('directions')} onClose={goBack} />
      )}

      {mode === 'directions' && selected && (
        <DirectionsPanel
          destination={selected}
          route={route}
          options={routeOpts}
          canAvoid={capabilities.avoidOptions}
          loading={routeLoading}
          error={routeError}
          onChangeOptions={setRouteOpts}
          onStart={() => setMode('navigate')}
          onClose={goBack}
        />
      )}

      {mode === 'navigate' && (
        <NavigationView
          next={nav.next}
          distanceToNext={nav.distanceToNext}
          remainingMiles={nav.remainingMiles}
          remainingSeconds={nav.remainingSeconds}
          muted={muted}
          onToggleMute={() => setMuted((v) => !v)}
          onEnd={endNavigation}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { position: 'absolute', left: 16, right: 16 },
  controls: { position: 'absolute', right: 16 },
  notice: {
    position: 'absolute',
    left: 16,
    right: 16,
    padding: 14,
    borderRadius: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
});
