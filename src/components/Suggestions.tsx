import { MaterialIcons } from '@expo/vector-icons';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Place } from '../api';
import { useTheme, type IconName } from '../theme';
import { formatDistance } from '../utils/geo';

type Props = {
  items: Place[];
  showingRecents: boolean;
  message?: string;
  onPick: (p: Place) => void;
  onClearRecents: () => void;
};

export function Suggestions({ items, showingRecents, message, onPick, onClearRecents }: Props) {
  const t = useTheme();
  if (items.length === 0) {
    if (!message) return null;
    return (
      <View style={[styles.card, { backgroundColor: t.bg }]}>
        <Text style={[styles.message, { color: t.muted }]}>{message}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: t.bg }]}>
      {showingRecents && (
        <View style={styles.header}>
          <Text style={[styles.headerText, { color: t.muted }]}>Recent</Text>
          <Pressable onPress={onClearRecents} hitSlop={8}>
            <Text style={{ color: t.primary, fontWeight: '600' }}>Clear</Text>
          </Pressable>
        </View>
      )}
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const icon: IconName = showingRecents ? 'history' : item.isCategory ? 'category' : 'place';
          return (
            <Pressable
              onPress={() => onPick(item)}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.surface }]}
            >
              <MaterialIcons name={icon} size={22} color={t.muted} />
              <View style={styles.texts}>
                <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                {!item.isCategory && (
                  <Text style={[styles.addr, { color: t.muted }]} numberOfLines={1}>
                    {item.address}
                  </Text>
                )}
              </View>
              {item.distanceMiles != null && (
                <Text style={[styles.addr, { color: t.muted }]}>{formatDistance(item.distanceMiles)}</Text>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    borderRadius: 16,
    maxHeight: 420,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  message: { padding: 16, fontSize: 14 },
  headerText: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 },
  texts: { flex: 1 },
  name: { fontSize: 16, fontWeight: '500' },
  addr: { fontSize: 13, marginTop: 2 },
});
