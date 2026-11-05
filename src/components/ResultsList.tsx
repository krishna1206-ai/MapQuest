import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Place } from '../api';
import { CATEGORIES, useTheme } from '../theme';
import { formatDistance, formatDuration } from '../utils/geo';
import { PanelHeader } from './PanelHeader';
import { Sheet } from './Sheet';

// Rough city driving speed, only for the "~min drive" hint in the list.
const CITY_MPH = 25;

type Props = {
  title: string;
  results: Place[];
  loading: boolean;
  error?: string;
  onPick: (p: Place) => void;
  onDirections: (p: Place) => void;
  onClose: () => void;
};

export function ResultsList({ title, results, loading, error, onPick, onDirections, onClose }: Props) {
  const t = useTheme();
  const icon = CATEGORIES.find((c) => c.label === title)?.icon ?? 'place';

  return (
    <Sheet>
      <PanelHeader
        title={title}
        subtitle={loading ? 'Searching nearby…' : `${results.length} places · nearest first`}
        onClose={onClose}
      />
      {loading && <ActivityIndicator color={t.primary} style={styles.status} />}
      {!loading && error && <Text style={[styles.status, { color: t.danger }]}>{error}</Text>}
      {!loading && !error && results.length === 0 && (
        <Text style={[styles.status, { color: t.muted }]}>No places found nearby.</Text>
      )}
      <FlatList
        data={results}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPick(item)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: pressed ? t.surface : t.bg, borderColor: t.border },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: t.surface }]}>
              <MaterialIcons name={icon} size={22} color={t.primary} />
            </View>

            <View style={styles.texts}>
              <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.addr, { color: t.muted }]} numberOfLines={2}>
                {item.address}
              </Text>
              {item.distanceMiles != null && (
                <View style={styles.meta}>
                  <View style={[styles.pill, { backgroundColor: t.surface }]}>
                    <MaterialIcons name="near-me" size={13} color={t.primary} />
                    <Text style={[styles.pillText, { color: t.text }]}>{formatDistance(item.distanceMiles)}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: t.surface }]}>
                    <MaterialIcons name="directions-car" size={13} color={t.primary} />
                    <Text style={[styles.pillText, { color: t.text }]}>
                      ~{formatDuration((item.distanceMiles / CITY_MPH) * 3600)}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <Pressable
              onPress={() => onDirections(item)}
              hitSlop={8}
              accessibilityLabel={`Directions to ${item.name}`}
              style={({ pressed }) => [styles.go, { backgroundColor: t.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <MaterialIcons name="directions" size={22} color={t.onPrimary} />
            </Pressable>
          </Pressable>
        )}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  status: { paddingVertical: 16, textAlign: 'center' },
  list: { gap: 10, paddingBottom: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700' },
  addr: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  meta: { flexDirection: 'row', gap: 6, marginTop: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pillText: { fontSize: 12, fontWeight: '600' },
  go: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
