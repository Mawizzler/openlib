import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { providersRegistryRepository } from '@/src/infrastructure/providers/ProvidersRegistryRepository';
import { appStorage, storageKeys } from '@/src/infrastructure/storage/PersistentStorage';

type ActiveLibraryContextValue = {
  activeLibraryId: string | null;
  activeLibrary: OpacappNormalizedProvider | null;
  isLoading: boolean;
  setActiveLibraryId: (id: string | null) => Promise<void>;
};

const ActiveLibraryContext = createContext<ActiveLibraryContextValue | null>(null);

export function ActiveLibraryProvider({ children }: { children: React.ReactNode }) {
  const [activeLibraryId, setActiveLibraryIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    appStorage
      .getItem(storageKeys.activeLibraryId)
      .then((storedId) => {
        if (!isMounted) return;
        if (storedId) {
          setActiveLibraryIdState(storedId);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const activeLibrary = useMemo(() => {
    if (!activeLibraryId) return null;
    return providersRegistryRepository.getProviderById(activeLibraryId);
  }, [activeLibraryId]);

  const setActiveLibraryId = async (id: string | null) => {
    setActiveLibraryIdState(id);
    if (id) {
      await appStorage.setItem(storageKeys.activeLibraryId, id);
    } else {
      await appStorage.removeItem(storageKeys.activeLibraryId);
    }
  };

  const value = useMemo(
    () => ({ activeLibraryId, activeLibrary, isLoading, setActiveLibraryId }),
    [activeLibraryId, activeLibrary, isLoading],
  );

  return <ActiveLibraryContext.Provider value={value}>{children}</ActiveLibraryContext.Provider>;
}

export function useActiveLibrary(): ActiveLibraryContextValue {
  const context = useContext(ActiveLibraryContext);
  if (!context) {
    throw new Error('useActiveLibrary must be used within ActiveLibraryProvider');
  }
  return context;
}
