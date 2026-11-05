import { useEffect, useRef } from 'react';
import { Animated, Linking, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import type { Place } from '../services/types';
import { CATEGORIES, type IconName } from '../utils/categories';
import { formatDistance, haversineMeters, type LngLat } from '../utils/geo';

type Props = {
  place: Place | null;
  userLocation: LngLat | null;
  onClose: () => void;
  onDirections: (place: Place) => void;
};

const HIDDEN_OFFSET = 420;

/** Lightweight animated bottom sheet; drag down or tap ✕ to dismiss. */
export function PlaceBottomSheet({ place, userLocation, onClose, onDirections }: Props) {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(HIDDEN_OFFSET)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: place ? 0 : HIDDEN_OFFSET,
      useNativeDriver: true,
      damping: 20,
      stiffness: 180,
    }).start();
  }, [place, translateY]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderMove: (_, g) => g.dy > 0 && translateY.setValue(g.dy),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.8) onCloseRef.current();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const cat = place ? CATEGORIES[place.category] : CATEGORIES.default;
  const distance = place && userLocation ? formatDistance(haversineMeters(userLocation, place.coordinate)) : null;

  return (
    <Animated.View
      pointerEvents={place ? 'auto' : 'none'}
      style={[
        styles.sheet,
        {
          backgroundColor: t.colors.surface,
          borderColor: t.colors.border,
          paddingBottom: insets.bottom + 16,
          transform: [{ translateY }],
        },
      ]}
      {...pan.panHandlers}
    >
      <View style={[styles.handle, { backgroundColor: t.colors.border }]} />
      {place && (
        <>
          <View style={styles.header}>
            <View style={[styles.badge, { backgroundColor: cat.color }]}>
              <MaterialCommunityIcons name={cat.icon} size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: t.colors.text }]} numberOfLines={2}>
                {place.name}
              </Text>
              <Text style={[styles.category, { color: cat.color }]}>{cat.singular}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <MaterialCommunityIcons name="close" size={24} color={t.colors.textMuted} />
            </Pressable>
          </View>

          <InfoRow icon="map-marker" text={place.address || 'Address not available'} />
          <InfoRow icon="map-marker-distance" text={distance ? `${distance} away` : 'Distance unavailable'} />
          <InfoRow
            icon="phone"
            text={place.phone || 'Phone not available'}
            onPress={place.phone ? () => Linking.openURL(`tel:${place.phone!.replace(/[^\d+]/g, '')}`) : undefined}
          />

          <Pressable
            onPress={() => onDirections(place)}
            style={({ pressed }) => [styles.cta, { backgroundColor: t.colors.primary, opacity: pressed ? 0.9 : 1 }]}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="directions" size={22} color={t.colors.primaryText} />
            <Text style={[styles.ctaText, { color: t.colors.primaryText }]}>Directions</Text>
          </Pressable>
        </>
      )}
    </Animated.View>
  );

  function InfoRow({ icon, text, onPress }: { icon: IconName; text: string; onPress?: () => void }) {
    const content = (
      <View style={styles.row}>
        <MaterialCommunityIcons name={icon} size={20} color={t.colors.textMuted} />
        <Text style={[styles.rowText, { color: onPress ? t.colors.primary : t.colors.text }]}>{text}</Text>
      </View>
    );
    return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
  }
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '700' },
  category: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  rowText: { flex: 1, fontSize: 15, lineHeight: 20 },
  cta: {
    marginTop: 14,
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: { fontSize: 16, fontWeight: '700' },
});
