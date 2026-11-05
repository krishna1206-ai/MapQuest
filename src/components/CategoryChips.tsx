import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { CATEGORIES, useTheme } from '../theme';

type Props = {
  onDirections: () => void;
  onPick: (label: string, query: string) => void;
};

export function CategoryChips({ onDirections, onPick }: Props) {
  const t = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        onPress={onDirections}
        style={({ pressed }) => [styles.chip, styles.directions, { backgroundColor: t.primary, opacity: pressed ? 0.85 : 1 }]}
      >
        <MaterialIcons name="directions" size={20} color={t.onPrimary} />
        <Text style={[styles.label, styles.directionsLabel, { color: t.onPrimary }]}>Directions</Text>
      </Pressable>
      {CATEGORIES.map((c) => (
        <Pressable
          key={c.label}
          onPress={() => onPick(c.label, c.query)}
          style={({ pressed }) => [styles.chip, { backgroundColor: pressed ? t.surface : t.bg }]}
        >
          <MaterialIcons name={c.icon} size={20} color={c.color} />
          <Text style={[styles.label, { color: t.text }]}>{c.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 10, paddingRight: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  directions: { paddingHorizontal: 18 },
  label: { fontSize: 15, fontWeight: '600' },
  directionsLabel: { fontWeight: '700' },
});
