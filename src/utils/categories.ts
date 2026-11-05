import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type CategoryId =
  | 'restaurant'
  | 'cafe'
  | 'fuel'
  | 'hospital'
  | 'atm'
  | 'hotel'
  | 'shopping'
  | 'pharmacy'
  | 'default';

export type Category = {
  id: CategoryId;
  label: string; // chip label (plural)
  singular: string; // shown in the bottom sheet
  icon: IconName;
  color: string;
  /** Search term sent to the MapQuest Search API. */
  query: string;
  /** Keywords used to classify search/autocomplete results. */
  keywords: string[];
};

export const CATEGORIES: Record<CategoryId, Category> = {
  restaurant: {
    id: 'restaurant',
    label: 'Restaurants',
    singular: 'Restaurant',
    icon: 'silverware-fork-knife',
    color: '#E8590C',
    query: 'restaurant',
    keywords: ['restaurant', 'fast_food', 'food_court', 'diner', 'grill', 'pizza', 'burger', 'food', 'eatery', 'bistro', 'kitchen', 'sushi', 'taco'],
  },
  cafe: {
    id: 'cafe',
    label: 'Cafes',
    singular: 'Cafe',
    icon: 'coffee',
    color: '#8B5A2B',
    query: 'coffee',
    keywords: ['cafe', 'café', 'coffee', 'espresso', 'starbucks', 'tea', 'bakery'],
  },
  fuel: {
    id: 'fuel',
    label: 'Fuel',
    singular: 'Gas station',
    icon: 'gas-station',
    color: '#2F9E44',
    query: 'gas station',
    keywords: ['gas', 'fuel', 'petrol', 'shell', 'exxon', 'chevron', 'mobil', 'bp', 'sunoco', 'citgo'],
  },
  hospital: {
    id: 'hospital',
    label: 'Hospitals',
    singular: 'Hospital',
    icon: 'hospital-box',
    color: '#E03131',
    query: 'hospital',
    keywords: ['hospital', 'medical center', 'clinic', 'emergency', 'urgent care', 'health'],
  },
  atm: {
    id: 'atm',
    label: 'ATMs',
    singular: 'ATM / Bank',
    icon: 'bank',
    color: '#1971C2',
    query: 'atm',
    keywords: ['atm', 'bank', 'credit union', 'chase', 'wells fargo', 'citibank'],
  },
  hotel: {
    id: 'hotel',
    label: 'Hotels',
    singular: 'Hotel',
    icon: 'bed',
    color: '#7048E8',
    query: 'hotel',
    keywords: ['hotel', 'motel', 'inn', 'suites', 'resort', 'lodge', 'hostel'],
  },
  shopping: {
    id: 'shopping',
    label: 'Shopping',
    singular: 'Shopping',
    icon: 'shopping',
    color: '#D6336C',
    query: 'shopping',
    keywords: ['shop', 'store', 'mall', 'market', 'outlet', 'boutique', 'walmart', 'target'],
  },
  pharmacy: {
    id: 'pharmacy',
    label: 'Pharmacies',
    singular: 'Pharmacy',
    icon: 'pill',
    color: '#0CA678',
    query: 'pharmacy',
    keywords: ['pharmacy', 'drugstore', 'cvs', 'walgreens', 'rite aid', 'chemist'],
  },
  default: {
    id: 'default',
    label: 'Places',
    singular: 'Place',
    icon: 'map-marker',
    color: '#495057',
    query: '',
    keywords: [],
  },
};

/** Chips shown at the top of the map, in order. */
export const FILTER_CATEGORIES: CategoryId[] = ['restaurant', 'cafe', 'fuel', 'hospital', 'atm', 'hotel'];

/** Guess a category from free text (name, type, display string). */
export function classifyCategory(...texts: (string | undefined | null)[]): CategoryId {
  const haystack = texts.filter(Boolean).join(' ').toLowerCase();
  if (!haystack) return 'default';
  // Check more specific categories before generic ones (e.g. pharmacy before shopping).
  const order: CategoryId[] = ['pharmacy', 'hospital', 'fuel', 'cafe', 'atm', 'hotel', 'restaurant', 'shopping'];
  for (const id of order) {
    if (CATEGORIES[id].keywords.some((k) => new RegExp(`\\b${k}\\b`).test(haystack))) return id;
  }
  return 'default';
}
