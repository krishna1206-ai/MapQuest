import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import type { IconName } from '../utils/categories';

type Props = {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Round floating action button (recenter, back, etc.). */
export function IconButton({ icon, onPress, accessibilityLabel, active, style }: Props) {
  const t = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: t.colors.surface, borderColor: t.colors.border, opacity: pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={24} color={active ? t.colors.primary : t.colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
});
