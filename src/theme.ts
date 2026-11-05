import { useColorScheme } from 'react-native';
import type { ComponentProps } from 'react';
import type { MaterialIcons } from '@expo/vector-icons';
import type { PoiKind } from './api/pois';

export type IconName = ComponentProps<typeof MaterialIcons>['name'];

// MapQuest-style palette: brand green for actions, blue for the route line.
const light = {
  bg: '#FFFFFF',
  surface: '#EEF5EF',
  text: '#1A1A1A',
  muted: '#5F6B63',
  border: '#D9E2DB',
  primary: '#1B7F3B',
  onPrimary: '#FFFFFF',
  route: '#1A73E8',
  danger: '#D93025',
};

const dark: typeof light = {
  bg: '#1C211E',
  surface: '#28312B',
  text: '#F1F5F2',
  muted: '#A3B1A7',
  border: '#39443C',
  primary: '#4CC26F',
  onPrimary: '#0B1A10',
  route: '#6AA8FF',
  danger: '#F28B82',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

// Same order as the chip row on mapquest.com; each icon has its own color like the site's chips.
export const CATEGORIES: { label: string; query: string; icon: IconName; color: string }[] = [
  { label: 'Coffee', query: 'coffee', icon: 'local-cafe', color: '#8D5B3E' },
  { label: 'Food', query: 'restaurants', icon: 'restaurant', color: '#E8710A' },
  { label: 'Gas', query: 'gas stations', icon: 'local-gas-station', color: '#1A73E8' },
  { label: 'Grocery', query: 'grocery stores', icon: 'local-grocery-store', color: '#C5221F' },
  { label: 'Shopping', query: 'shopping', icon: 'shopping-bag', color: '#F9AB00' },
  { label: 'Hotels', query: 'hotels', icon: 'hotel', color: '#3367D6' },
  { label: 'Parking', query: 'parking', icon: 'local-parking', color: '#1967D2' },
  { label: 'Pharmacy', query: 'pharmacy', icon: 'local-pharmacy', color: '#D93025' },
  { label: 'ATMs', query: 'atm', icon: 'atm', color: '#188038' },
  { label: 'EV charging', query: 'electric vehicle charging', icon: 'ev-station', color: '#12B5CB' },
];

/** Ring color of each kind of place's map icon, so categories are easy to tell apart. */
export const POI_COLORS: Record<PoiKind, string> = {
  hotel: '#3367D6',
  health: '#D93025',
  food: '#E8710A',
  cafe: '#8D5B3E',
  fuel: '#1A73E8',
  grocery: '#C5221F',
  shop: '#E37400',
  money: '#188038',
  education: '#7B5E3B',
  worship: '#5F6368',
  fun: '#9334E6',
  park: '#188038',
  civic: '#3C4043',
  transit: '#0B57D0',
};

/** MapQuest maneuver turnType → icon. */
export function maneuverIcon(turnType: number): IconName {
  const icons: Record<number, IconName> = {
    0: 'straight',
    1: 'turn-slight-right',
    2: 'turn-right',
    3: 'turn-sharp-right',
    4: 'u-turn-left',
    5: 'turn-sharp-left',
    6: 'turn-left',
    7: 'turn-slight-left',
    8: 'u-turn-right',
    9: 'u-turn-left',
    10: 'merge',
    11: 'merge',
    12: 'ramp-right',
    13: 'ramp-left',
    14: 'ramp-right',
    15: 'ramp-left',
    16: 'fork-right',
    17: 'fork-left',
    18: 'straight',
  };
  return icons[turnType] ?? 'navigation';
}
