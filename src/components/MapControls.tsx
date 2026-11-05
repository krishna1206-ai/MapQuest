import { MaterialIcons } from '@expo/vector-icons';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme, type IconName } from '../theme';

type Props = {
  satellite: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleSatellite: () => void;
  onRecenter: () => void;
  onShare: () => void;
};

/** One vertical card of map tools, like the control strip on mapquest.com. */
export function MapControls({ satellite, onZoomIn, onZoomOut, onToggleSatellite, onRecenter, onShare }: Props) {
  const t = useTheme();
  const items: { icon: IconName; label: string; onPress: () => void; on?: boolean }[] = [
    { icon: 'add', label: 'Zoom in', onPress: onZoomIn },
    { icon: 'remove', label: 'Zoom out', onPress: onZoomOut },
    { icon: 'public', label: 'Satellite view', onPress: onToggleSatellite, on: satellite },
    { icon: 'my-location', label: 'Center on my location', onPress: onRecenter },
    { icon: 'ios-share', label: 'Share this map', onPress: onShare },
  ];

  return (
    <View style={[styles.card, { backgroundColor: t.bg }]}>
      {items.map((it, i) => (
        <Fragment key={it.label}>
          {i > 0 && <View style={[styles.sep, { backgroundColor: t.border }]} />}
          <Pressable
            onPress={it.onPress}
            accessibilityLabel={it.label}
            accessibilityState={{ selected: !!it.on }}
            style={({ pressed }) => [styles.btn, (pressed || it.on) && { backgroundColor: t.surface }]}
          >
            <MaterialIcons name={it.icon} size={24} color={it.on ? t.primary : t.text} />
          </Pressable>
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 46,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  btn: { height: 46, alignItems: 'center', justifyContent: 'center' },
  sep: { height: StyleSheet.hairlineWidth, marginHorizontal: 8 },
});
