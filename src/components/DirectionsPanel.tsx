import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Place, Route, RouteOptions, TravelMode } from '../api';
import { maneuverIcon, useTheme, type IconName } from '../theme';
import { formatDistance, formatDuration } from '../utils/geo';
import { PanelHeader } from './PanelHeader';
import { Sheet } from './Sheet';

const MODES: { mode: TravelMode; icon: IconName; label: string }[] = [
  { mode: 'fastest', icon: 'directions-car', label: 'Drive' },
  { mode: 'pedestrian', icon: 'directions-walk', label: 'Walk' },
  { mode: 'bicycle', icon: 'directions-bike', label: 'Bike' },
];

type Props = {
  destination: Place;
  route: Route | null;
  options: RouteOptions;
  canAvoid: boolean;
  loading: boolean;
  error?: string;
  onChangeOptions: (o: RouteOptions) => void;
  onStart: () => void;
  onClose: () => void;
};

export function DirectionsPanel({ destination, route, options, canAvoid, loading, error, onChangeOptions, onStart, onClose }: Props) {
  const t = useTheme();
  const seconds = route ? (route.realTime ?? route.time) : 0;
  const trafficDelay = route?.realTime ? route.realTime - route.time : 0;

  const toggle = (label: string, on: boolean, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      accessibilityState={{ checked: on }}
      style={[styles.toggle, { borderColor: on ? t.primary : t.border, backgroundColor: on ? t.surface : t.bg }]}
    >
      {on && <MaterialIcons name="check" size={16} color={t.primary} />}
      <Text style={{ color: on ? t.primary : t.text, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );

  return (
    <Sheet maxHeight="65%">
      <PanelHeader title={`To ${destination.name}`} subtitle={destination.address} onClose={onClose} />

      <View style={[styles.modes, { backgroundColor: t.surface }]}>
        {MODES.map((m) => {
          const on = options.mode === m.mode;
          return (
            <Pressable
              key={m.mode}
              onPress={() => onChangeOptions({ ...options, mode: m.mode })}
              accessibilityLabel={m.label}
              accessibilityState={{ selected: on }}
              style={[styles.mode, on && { backgroundColor: t.bg }]}
            >
              <MaterialIcons name={m.icon} size={20} color={on ? t.primary : t.muted} />
              <Text style={{ color: on ? t.primary : t.muted, fontWeight: '600' }}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {canAvoid && options.mode === 'fastest' && (
        <View style={styles.toggles}>
          {toggle('Avoid tolls', options.avoidTolls, () => onChangeOptions({ ...options, avoidTolls: !options.avoidTolls }))}
          {toggle('Avoid highways', options.avoidHighways, () =>
            onChangeOptions({ ...options, avoidHighways: !options.avoidHighways }),
          )}
        </View>
      )}

      {loading && <ActivityIndicator color={t.primary} style={styles.status} />}
      {!loading && error && <Text style={[styles.status, { color: t.danger }]}>{error}</Text>}

      {!loading && !error && route && (
        <>
          <View style={styles.summary}>
            <View style={styles.summaryTexts}>
              <Text style={[styles.time, { color: t.text }]}>{formatDuration(seconds)}</Text>
              <Text style={{ color: t.muted, marginTop: 2 }}>
                {formatDistance(route.distance)}
                {trafficDelay > 60 ? ` · ${formatDuration(trafficDelay)} traffic delay` : ''}
                {route.hasTollRoad ? ' · Tolls' : ''}
              </Text>
            </View>
            <Pressable
              onPress={onStart}
              style={({ pressed }) => [styles.start, { backgroundColor: t.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <MaterialIcons name="navigation" size={20} color={t.onPrimary} />
              <Text style={[styles.startText, { color: t.onPrimary }]}>Start</Text>
            </Pressable>
          </View>

          <FlatList
            data={route.maneuvers}
            keyExtractor={(_, i) => String(i)}
            ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: t.border }]} />}
            renderItem={({ item, index }) => (
              <View style={styles.step}>
                <MaterialIcons
                  name={index === route.maneuvers.length - 1 ? 'flag' : maneuverIcon(item.turnType)}
                  size={22}
                  color={t.text}
                />
                <Text style={[styles.stepText, { color: t.text }]}>{item.narrative}</Text>
                {item.distance > 0 && (
                  <Text style={{ color: t.muted, fontSize: 13 }}>{formatDistance(item.distance)}</Text>
                )}
              </View>
            )}
          />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  modes: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 10 },
  mode: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 9,
  },
  toggles: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
  },
  status: { paddingVertical: 16, textAlign: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  summaryTexts: { flex: 1 },
  time: { fontSize: 24, fontWeight: '700' },
  start: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 48, paddingHorizontal: 24, borderRadius: 24 },
  startText: { fontSize: 16, fontWeight: '700' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  stepText: { flex: 1, fontSize: 15 },
  sep: { height: StyleSheet.hairlineWidth },
});
