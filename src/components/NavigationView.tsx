import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Maneuver } from '../api';
import { maneuverIcon, useTheme } from '../theme';
import { formatClock, formatDistance, formatDuration } from '../utils/geo';

type Props = {
  next?: Maneuver;
  distanceToNext: number;
  remainingMiles: number;
  remainingSeconds: number;
  muted: boolean;
  onToggleMute: () => void;
  onEnd: () => void;
};

/** Turn banner on top + trip bar at the bottom while navigating. */
export function NavigationView({ next, distanceToNext, remainingMiles, remainingSeconds, muted, onToggleMute, onEnd }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  const eta = new Date(now + remainingSeconds * 1000);

  return (
    <>
      <View style={[styles.banner, { top: insets.top + 8, backgroundColor: t.primary }]}>
        <MaterialIcons name={next ? maneuverIcon(next.turnType) : 'flag'} size={44} color={t.onPrimary} />
        <View style={styles.bannerTexts}>
          {next && <Text style={[styles.bannerDist, { color: t.onPrimary }]}>{formatDistance(distanceToNext)}</Text>}
          <Text style={[styles.bannerText, { color: t.onPrimary }]} numberOfLines={2}>
            {next?.narrative ?? 'Continue to your destination'}
          </Text>
        </View>
      </View>

      <View style={[styles.bar, { paddingBottom: insets.bottom + 12, backgroundColor: t.bg }]}>
        <Pressable
          onPress={onToggleMute}
          accessibilityLabel={muted ? 'Unmute voice' : 'Mute voice'}
          style={[styles.round, { backgroundColor: t.surface }]}
        >
          <MaterialIcons name={muted ? 'volume-off' : 'volume-up'} size={22} color={t.text} />
        </Pressable>
        <View style={styles.tripTexts}>
          <Text style={[styles.tripTime, { color: t.text }]}>{formatDuration(remainingSeconds)}</Text>
          <Text style={{ color: t.muted }}>
            {formatDistance(remainingMiles)} · Arrive {formatClock(eta)}
          </Text>
        </View>
        <Pressable onPress={onEnd} style={[styles.end, { backgroundColor: t.danger }]}>
          <Text style={styles.endText}>End</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  bannerTexts: { flex: 1 },
  bannerDist: { fontSize: 26, fontWeight: '800' },
  bannerText: { fontSize: 17, fontWeight: '600', marginTop: 2 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
  },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tripTexts: { flex: 1 },
  tripTime: { fontSize: 22, fontWeight: '700' },
  end: { height: 44, paddingHorizontal: 24, borderRadius: 22, justifyContent: 'center' },
  endText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
