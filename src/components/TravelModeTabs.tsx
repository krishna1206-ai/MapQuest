import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import type { TravelMode } from '../services/types';
import type { IconName } from '../utils/categories';

const MODES: { id: TravelMode; label: string; icon: IconName }[] = [
  { id: 'car', label: 'Drive', icon: 'car' },
  { id: 'walk', label: 'Walk', icon: 'walk' },
  { id: 'bike', label: 'Bike', icon: 'bike' },
];

export function TravelModeTabs({ value, onChange }: { value: TravelMode; onChange: (m: TravelMode) => void }) {
  const t = useAppTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: t.colors.surfaceAlt }]}>
      {MODES.map((m) => {
        const active = m.id === value;
        return (
          <Pressable
            key={m.id}
            onPress={() => onChange(m.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.tab, active && { backgroundColor: t.colors.surface, ...styles.activeShadow }]}
          >
            <MaterialCommunityIcons name={m.icon} size={20} color={active ? t.colors.primary : t.colors.textMuted} />
            <Text style={[styles.label, { color: active ? t.colors.primary : t.colors.textMuted }]}>{m.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', borderRadius: 12, padding: 4 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 9,
  },
  activeShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  label: { fontSize: 14, fontWeight: '600' },
});
