import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  defaultReminderPreferences,
  type ReminderPreferences,
} from '@/src/domain/models/reminders';
import { readJson, storageKeys, writeJson } from '@/src/infrastructure/storage/PersistentStorage';

type ReminderPreferencesContextValue = {
  preferences: ReminderPreferences;
  isLoading: boolean;
  updatePreferences: (patch: Partial<ReminderPreferences>) => void;
  setPreferences: (preferences: ReminderPreferences) => void;
};

const ReminderPreferencesContext = createContext<ReminderPreferencesContextValue | null>(null);

const sanitizePreferences = (input: ReminderPreferences): ReminderPreferences => ({
  enabled: Boolean(input.enabled),
  loanDueLeadDays:
    typeof input.loanDueLeadDays === 'number' && input.loanDueLeadDays >= 0
      ? input.loanDueLeadDays
      : defaultReminderPreferences.loanDueLeadDays,
  reservationPickupLeadHours:
    typeof input.reservationPickupLeadHours === 'number' &&
    input.reservationPickupLeadHours >= 0
      ? input.reservationPickupLeadHours
      : defaultReminderPreferences.reservationPickupLeadHours,
});

export function ReminderPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferencesState] = useState<ReminderPreferences>(
    defaultReminderPreferences,
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    readJson<ReminderPreferences>(storageKeys.reminderPreferences, defaultReminderPreferences)
      .then((stored) => {
        if (!isMounted) return;
        setPreferencesState(sanitizePreferences(stored));
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const persist = useCallback(async (next: ReminderPreferences) => {
    await writeJson(storageKeys.reminderPreferences, next);
  }, []);

  const setPreferences = useCallback(
    (next: ReminderPreferences) => {
      const sanitized = sanitizePreferences(next);
      setPreferencesState(sanitized);
      void persist(sanitized);
    },
    [persist],
  );

  const updatePreferences = useCallback(
    (patch: Partial<ReminderPreferences>) => {
      setPreferencesState((current) => {
        const next = sanitizePreferences({ ...current, ...patch });
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const value = useMemo(
    () => ({ preferences, isLoading, updatePreferences, setPreferences }),
    [preferences, isLoading, updatePreferences, setPreferences],
  );

  return (
    <ReminderPreferencesContext.Provider value={value}>
      {children}
    </ReminderPreferencesContext.Provider>
  );
}

export function useReminderPreferences(): ReminderPreferencesContextValue {
  const context = useContext(ReminderPreferencesContext);
  if (!context) {
    throw new Error('useReminderPreferences must be used within ReminderPreferencesProvider');
  }
  return context;
}
