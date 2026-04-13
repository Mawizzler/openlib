import type { KeyValueStorage } from '@/src/infrastructure/storage/KeyValueStorage';
import { asyncStorageAdapter } from '@/src/infrastructure/storage/AsyncStorageAdapter';

export type NamespacedStorage = KeyValueStorage & {
  buildKey: (key: string) => string;
};

export const createNamespacedStorage = (
  prefix: string,
  storage: KeyValueStorage = asyncStorageAdapter,
): NamespacedStorage => {
  const buildKey = (key: string) => `${prefix}.${key}`;
  return {
    buildKey,
    getItem: (key) => storage.getItem(buildKey(key)),
    setItem: (key, value) => storage.setItem(buildKey(key), value),
    removeItem: (key) => storage.removeItem(buildKey(key)),
  };
};

export const appStorage = createNamespacedStorage('openlib');

export const storageKeys = {
  activeLibraryId: 'activeLibraryId',
  accountSession: 'accountSession',
  reminderPreferences: 'reminderPreferences',
  reminderState: 'reminderState',
  recentSearches: (libraryId: string) => `recentSearches.${libraryId}`,
};

export const readJson = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const raw = await appStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const writeJson = async <T>(key: string, value: T): Promise<void> => {
  await appStorage.setItem(key, JSON.stringify(value));
};

export const removeKey = async (key: string): Promise<void> => {
  await appStorage.removeItem(key);
};
