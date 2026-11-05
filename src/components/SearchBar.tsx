import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAutocomplete } from '../hooks/useAutocomplete';
import type { Place } from '../services/types';
import { CATEGORIES } from '../utils/categories';
import { formatDistance, haversineMeters, type LngLat } from '../utils/geo';

type Props = {
  userLocation: LngLat | null;
  onSelect: (place: Place) => void;
};

export function SearchBar({ userLocation, onSelect }: Props) {
  const t = useAppTheme();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const { results, loading, error } = useAutocomplete(query, userLocation);

  const showDropdown = focused && query.trim().length >= 2;

  const select = (p: Place) => {
    setQuery(p.name);
    setFocused(false);
    Keyboard.dismiss();
    onSelect(p);
  };

  return (
    <View>
      <View style={[styles.bar, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
        <MaterialCommunityIcons name="magnify" size={22} color={t.colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search places, addresses, businesses"
          placeholderTextColor={t.colors.textMuted}
          style={[styles.input, { color: t.colors.text }]}
          returnKeyType="search"
          autoCorrect={false}
          onSubmitEditing={() => results[0] && select(results[0])}
          accessibilityLabel="Search"
        />
        {loading ? (
          <ActivityIndicator size="small" color={t.colors.primary} />
        ) : query.length > 0 ? (
          <Pressable hitSlop={10} onPress={() => setQuery('')} accessibilityLabel="Clear search">
            <MaterialCommunityIcons name="close" size={20} color={t.colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {showDropdown && (
        <View style={[styles.dropdown, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
          {error ? (
            <Row icon="alert-circle-outline" color={t.colors.danger} text={error} />
          ) : !loading && results.length === 0 ? (
            <Row icon="map-search-outline" color={t.colors.textMuted} text="No matches found" />
          ) : (
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={results}
              keyExtractor={(p) => p.id}
              ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: t.colors.border }]} />}
              renderItem={({ item }) => {
                const cat = CATEGORIES[item.category];
                const dist = userLocation ? formatDistance(haversineMeters(userLocation, item.coordinate)) : null;
                return (
                  <Pressable
                    onPress={() => select(item)}
                    style={({ pressed }) => [styles.item, pressed && { backgroundColor: t.colors.surfaceAlt }]}
                  >
                    <View style={[styles.itemIcon, { backgroundColor: cat.color }]}>
                      <MaterialCommunityIcons name={cat.icon} size={16} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={[styles.itemTitle, { color: t.colors.text }]}>
                        {item.name}
                      </Text>
                      {!!item.address && (
                        <Text numberOfLines={1} style={[styles.itemSub, { color: t.colors.textMuted }]}>
                          {item.address}
                        </Text>
                      )}
                    </View>
                    {dist && <Text style={[styles.itemSub, { color: t.colors.textMuted }]}>{dist}</Text>}
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      )}
    </View>
  );

  function Row({ icon, color, text }: { icon: any; color: string; text: string }) {
    return (
      <View style={styles.item}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
        <Text style={[styles.itemSub, { color: t.colors.textMuted, flex: 1 }]}>{text}</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 0 },
  dropdown: {
    marginTop: 6,
    maxHeight: 340,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  itemIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 15, fontWeight: '600' },
  itemSub: { fontSize: 13, marginTop: 1 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 56 },
});
