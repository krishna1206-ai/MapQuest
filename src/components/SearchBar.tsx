import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentRef, Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '../theme';

type Props = {
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
  value: string;
  placeholder?: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  onFocus: () => void;
  onBack?: () => void;
  onClear: () => void;
};

/** Search field with a green search button on the right, styled after mapquest.com. */
export function SearchBar({ inputRef, value, placeholder, onChangeText, onSubmit, onFocus, onBack, onClear }: Props) {
  const t = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: t.bg, borderColor: t.primary }]}>
      {onBack && (
        <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Back" style={styles.back}>
          <MaterialIcons name="arrow-back" size={24} color={t.text} />
        </Pressable>
      )}
      <TextInput
        ref={inputRef}
        style={[styles.input, { color: t.text }, !onBack && styles.inputPad]}
        placeholder={placeholder ?? 'Search places, addresses or categories'}
        placeholderTextColor={t.muted}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        onFocus={onFocus}
        returnKeyType="search"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <Pressable onPress={onClear} hitSlop={10} accessibilityLabel="Clear search" style={styles.clear}>
          <MaterialIcons name="close" size={22} color={t.muted} />
        </Pressable>
      )}
      <Pressable
        onPress={onSubmit}
        accessibilityLabel="Search"
        style={({ pressed }) => [styles.go, { backgroundColor: t.primary, opacity: pressed ? 0.85 : 1 }]}
      >
        <MaterialIcons name="search" size={26} color={t.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  back: { paddingLeft: 14, paddingRight: 6 },
  input: { flex: 1, fontSize: 16, paddingVertical: 0 },
  inputPad: { paddingLeft: 20 },
  clear: { paddingHorizontal: 8 },
  go: { width: 60, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
});
