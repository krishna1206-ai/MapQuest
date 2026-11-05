import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Place } from '../api';

const STORAGE_KEY = 'recents:v1';
const MAX = 10;

export function useRecents() {
  const [recents, setRecents] = useState<Place[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => raw && setRecents(JSON.parse(raw)))
      .catch(() => {});
  }, []);

  const save = (next: Place[]) => {
    setRecents(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const addRecent = useCallback((p: Place) => {
    setRecents((prev) => {
      const next = [{ ...p, distanceMiles: undefined }, ...prev.filter((r) => r.id !== p.id)].slice(0, MAX);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clearRecents = useCallback(() => save([]), []);

  return { recents, addRecent, clearRecents };
}
