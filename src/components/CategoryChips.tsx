import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { CATEGORIES, FILTER_CATEGORIES, type CategoryId } from '../utils/categories';

type Props = {
  value: CategoryId | 'all';
  onChange: (v: CategoryId | 'all') => void;
};

export function CategoryChips({ value, onChange }: Props) {
  const t = useAppTheme();
  const items: { id: CategoryId | 'all'; label: string; icon: any; color: string }[] = [
    { id: 'all', label: 'All', icon: 'map-marker-multiple', color: t.colors.primary },
    ...FILTER_CATEGORIES.map((id) => ({
      id,
      label: CATEGORIES[id].label,
      icon: CATEGORIES[id].icon,
      color: CATEGORIES[id].color,
    })),
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {items.map((it) => {
        const active = value === it.id;
        return (
          <Pressable
            key={it.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(active && it.id !== 'all' ? 'all' : it.id)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: active ? it.color : t.colors.surface,
                borderColor: active ? it.color : t.colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <MaterialCommunityIcons name={it.icon} size={16} color={active ? '#fff' : it.color} />
            <Text style={[styles.label, { color: active ? '#fff' : t.colors.text }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, gap: 8, paddingVertical: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  label: { fontSize: 13, fontWeight: '600' },
});
