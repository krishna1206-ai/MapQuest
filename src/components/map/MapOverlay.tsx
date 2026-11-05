import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../hooks/useAppTheme';

/** Loading spinner / fatal error screen drawn over the map surface. */
export function MapOverlay({ loaded, fatal, onRetry }: { loaded: boolean; fatal: string | null; onRetry: () => void }) {
  const t = useAppTheme();
  if (fatal) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: t.colors.background }]}>
        <MaterialCommunityIcons name="map-marker-off-outline" size={40} color={t.colors.textMuted} />
        <Text style={[styles.text, { color: t.colors.text }]}>{fatal}</Text>
        <Pressable onPress={onRetry} style={[styles.btn, { backgroundColor: t.colors.primary }]}>
          <Text style={{ color: t.colors.primaryText, fontWeight: '700' }}>Try again</Text>
        </Pressable>
      </View>
    );
  }
  if (!loaded) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        <ActivityIndicator size="large" color={t.colors.primary} />
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  text: { fontSize: 15, textAlign: 'center' },
  btn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
});
