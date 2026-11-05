import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import type { IconName } from '../utils/categories';

type Props =
  | { kind: 'loading'; text: string }
  | { kind: 'error' | 'empty' | 'info'; text: string; actionLabel?: string; onAction?: () => void };

/** Compact floating banner for loading / error / empty states over the map. */
export function StatusPill(props: Props) {
  const t = useAppTheme();
  const icon: IconName | null =
    props.kind === 'error'
      ? 'alert-circle-outline'
      : props.kind === 'empty'
        ? 'map-marker-off-outline'
        : props.kind === 'info'
          ? 'crosshairs-gps'
          : null;
  const iconColor = props.kind === 'error' ? t.colors.danger : t.colors.textMuted;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.pill, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}
    >
      {props.kind === 'loading' ? (
        <ActivityIndicator size="small" color={t.colors.primary} />
      ) : (
        icon && <MaterialCommunityIcons name={icon} size={18} color={iconColor} />
      )}
      <Text style={[styles.text, { color: t.colors.text }]} numberOfLines={2}>
        {props.text}
      </Text>
      {props.kind !== 'loading' && props.onAction && (
        <Pressable onPress={props.onAction} hitSlop={8}>
          <Text style={[styles.action, { color: t.colors.primary }]}>{props.actionLabel ?? 'Retry'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    maxWidth: '92%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  text: { fontSize: 13, fontWeight: '500', flexShrink: 1 },
  action: { fontSize: 13, fontWeight: '700' },
});
