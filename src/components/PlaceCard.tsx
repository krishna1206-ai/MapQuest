import { MaterialIcons } from '@expo/vector-icons';
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { mapquestUrl, type Place } from '../api';
import { useTheme, type IconName } from '../theme';
import { formatDistance } from '../utils/geo';
import { PanelHeader } from './PanelHeader';
import { Sheet } from './Sheet';

type Props = {
  place: Place;
  onDirections: () => void;
  onClose: () => void;
};

export function PlaceCard({ place, onDirections, onClose }: Props) {
  const t = useTheme();
  const url = mapquestUrl(place.slug);

  const share = () =>
    Share.share({ message: [place.name, place.address, url].filter(Boolean).join('\n') }).catch(() => {});

  const secondary = (icon: IconName, label: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, { borderColor: t.border }, pressed && { backgroundColor: t.surface }]}
    >
      <MaterialIcons name={icon} size={20} color={t.primary} />
      <Text style={[styles.secondaryText, { color: t.primary }]}>{label}</Text>
    </Pressable>
  );

  return (
    <Sheet>
      <PanelHeader title={place.name} subtitle={place.address} onClose={onClose} />
      {place.distanceMiles != null && (
        <Text style={[styles.meta, { color: t.muted }]}>{formatDistance(place.distanceMiles)} away</Text>
      )}
      <View style={styles.actions}>
        <Pressable
          onPress={onDirections}
          style={({ pressed }) => [styles.primary, { backgroundColor: t.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <MaterialIcons name="directions" size={20} color={t.onPrimary} />
          <Text style={[styles.primaryText, { color: t.onPrimary }]}>Directions</Text>
        </Pressable>
        {secondary('share', 'Share', share)}
        {url && secondary('open-in-new', 'Details', () => Linking.openURL(url))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  meta: { fontSize: 14, marginBottom: 12, marginTop: -4 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
  },
  primaryText: { fontSize: 15, fontWeight: '700' },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
  },
  secondaryText: { fontSize: 15, fontWeight: '600' },
});
