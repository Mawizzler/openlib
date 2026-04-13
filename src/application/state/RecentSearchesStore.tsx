import { useCallback, useEffect, useMemo, useState } from 'react';

import { useActiveLibrary } from '@/src/application/state/ActiveLibraryStore';
import { readJson, storageKeys, writeJson, removeKey } from '@/src/infrastructure/storage/PersistentStorage';

export type RecentSearchEntry = {
  query: string;
  searchedAt: string;
};

const MAX_RECENT_SEARCHES = 8;

const normalizeQuery = (query: string) => query.trim();

const sanitizeRecentSearches = (entries: RecentSearchEntry[]) =>
  entries
    .filter((entry) => typeof entry?.query === 'string' && entry.query.trim().length > 0)
    .map((entry) => ({
      query: entry.query.trim(),
      searchedAt:
        typeof entry.searchedAt === 'string' && entry.searchedAt
          ? entry.searchedAt
          : new Date().toISOString(),
    }));

const buildNextSearches = (query: string, current: RecentSearchEntry[]) => {
  const trimmed = normalizeQuery(query);
  if (!trimmed) {
    return current;
  }
  const lowered = trimmed.toLowerCase();
  const filtered = current.filter((entry) => entry.query.toLowerCase() !== lowered);
  return [
    { query: trimmed, searchedAt: new Date().toISOString() },
    ...filtered,
  ].slice(0, MAX_RECENT_SEARCHES);
};

export const useRecentSearches = () => {
  const { activeLibraryId } = useActiveLibrary();
  const [recentSearches, setRecentSearches] = useState<RecentSearchEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (!activeLibraryId) {
      setRecentSearches([]);
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setIsLoading(true);
    readJson<RecentSearchEntry[]>(storageKeys.recentSearches(activeLibraryId), [])
      .then((stored) => {
        if (!isMounted) return;
        setRecentSearches(sanitizeRecentSearches(stored));
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeLibraryId]);

  const persist = useCallback(
    async (next: RecentSearchEntry[]) => {
      if (!activeLibraryId) return;
      await writeJson(storageKeys.recentSearches(activeLibraryId), next);
    },
    [activeLibraryId],
  );

  const addSearch = useCallback(
    (query: string) => {
      if (!activeLibraryId) return;
      setRecentSearches((current) => {
        const next = buildNextSearches(query, current);
        void persist(next);
        return next;
      });
    },
    [activeLibraryId, persist],
  );

  const clearSearches = useCallback(() => {
    if (!activeLibraryId) return;
    setRecentSearches([]);
    void removeKey(storageKeys.recentSearches(activeLibraryId));
  }, [activeLibraryId]);

  const value = useMemo(
    () => ({ recentSearches, addSearch, clearSearches, isLoading }),
    [recentSearches, addSearch, clearSearches, isLoading],
  );

  return value;
};
