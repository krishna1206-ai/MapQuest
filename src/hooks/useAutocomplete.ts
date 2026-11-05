import { useEffect, useState } from 'react';
import { autocomplete, errorMessage, isAbortError } from '../services/places';
import type { Place } from '../services/types';
import { CONFIG } from '../utils/config';
import type { LngLat } from '../utils/geo';

/** Debounced MapQuest autocomplete for the search bar. */
export function useAutocomplete(query: string, near: LngLat | null) {
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await autocomplete(q, near ?? undefined, ctrl.signal);
        setResults(data);
        setError(null);
      } catch (e) {
        if (!isAbortError(e)) setError(errorMessage(e));
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, CONFIG.searchDebounceMs);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // `near` intentionally excluded: location updates shouldn't re-query while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return { results, loading, error };
}
