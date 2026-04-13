import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAccountSession } from '@/src/application/state/AccountSessionStore';
import { useReminderPreferences } from '@/src/application/state/ReminderPreferencesStore';
import { computeUpcomingReminders } from '@/src/application/services/ReminderScheduler';
import {
  defaultReminderState,
  type ManualReminder,
  type ReminderItem,
  type ReminderState,
} from '@/src/domain/models/reminders';
import { PersistentReminderStore } from '@/src/infrastructure/reminders/PersistentReminderStore';

type ReminderStateContextValue = {
  state: ReminderState;
  isLoading: boolean;
  isGenerating: boolean;
  refreshSchedule: () => Promise<void>;
  toggleReminder: (id: string) => void;
  createManualReminder: (input: { recordId: string; title: string; remindAt: Date }) => void;
};

const ReminderStateContext = createContext<ReminderStateContextValue | null>(null);

const sortByRemindAt = (items: ReminderItem[]) =>
  [...items].sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime());

const mergeSchedule = (next: ReminderItem[], current: ReminderItem[]): ReminderItem[] => {
  const existing = new Map(current.map((item) => [item.id, item]));
  const nextIds = new Set(next.map((item) => item.id));
  const merged = next.map((item) => {
    const prior = existing.get(item.id);
    if (prior && prior.status !== 'scheduled') {
      return { ...item, status: prior.status };
    }
    return item;
  });

  const manual = current.filter((item) => item.kind === 'manual' && !nextIds.has(item.id));
  return sortByRemindAt([...merged, ...manual]);
};

const buildManualReminderId = (recordId: string, remindAt: Date) =>
  `manual-${recordId}-${remindAt.toISOString()}`;

export function ReminderStateProvider({ children }: { children: React.ReactNode }) {
  const { snapshot } = useAccountSession();
  const { preferences, isLoading: preferencesLoading } = useReminderPreferences();
  const store = useMemo(() => new PersistentReminderStore(), []);
  const [state, setState] = useState<ReminderState>(defaultReminderState());
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    let isMounted = true;
    store
      .getState()
      .then((stored) => {
        if (!isMounted) return;
        setState(stored);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [store]);

  const refreshSchedule = useCallback(async () => {
    setIsGenerating(true);
    const result = computeUpcomingReminders({
      now: new Date(),
      loans: snapshot?.loans ?? [],
      reservations: snapshot?.reservations ?? [],
      preferences,
    });

    setState((current) => {
      const merged: ReminderItem[] = mergeSchedule(result.reminders, current.scheduled);
      const next: ReminderState = {
        ...current,
        lastGeneratedAt: result.generatedAt,
        scheduled: merged,
      };
      void store.setState(next);
      return next;
    });
    setIsGenerating(false);
  }, [preferences, snapshot, store]);

  useEffect(() => {
    if (isLoading || preferencesLoading) return;
    void refreshSchedule();
  }, [isLoading, preferencesLoading, refreshSchedule, snapshot]);

  const toggleReminder = useCallback(
    (id: string) => {
      setState((current) => {
        const scheduled: ReminderItem[] = current.scheduled.map((item) => {
          if (item.id !== id) {
            return item;
          }
          const nextStatus: ReminderItem['status'] =
            item.status === 'scheduled' ? 'skipped' : 'scheduled';
          return { ...item, status: nextStatus };
        });
        const next = { ...current, scheduled };
        void store.setState(next);
        return next;
      });
    },
    [store],
  );

  const createManualReminder = useCallback(
    (input: { recordId: string; title: string; remindAt: Date }) => {
      setState((current) => {
        const remindAt = input.remindAt.toISOString();
        const id = buildManualReminderId(input.recordId, input.remindAt);
        if (current.scheduled.some((item) => item.id === id)) {
          return current;
        }
        const manualReminder: ManualReminder = {
          id,
          kind: 'manual',
          recordId: input.recordId,
          title: input.title,
          remindAt,
          status: 'scheduled',
        };
        const next: ReminderState = {
          ...current,
          scheduled: sortByRemindAt([...current.scheduled, manualReminder]),
        };
        void store.setState(next);
        return next;
      });
    },
    [store],
  );

  const value = useMemo(
    () => ({
      state,
      isLoading,
      isGenerating,
      refreshSchedule,
      toggleReminder,
      createManualReminder,
    }),
    [state, isLoading, isGenerating, refreshSchedule, toggleReminder, createManualReminder],
  );

  return <ReminderStateContext.Provider value={value}>{children}</ReminderStateContext.Provider>;
}

export function useReminderState(): ReminderStateContextValue {
  const context = useContext(ReminderStateContext);
  if (!context) {
    throw new Error('useReminderState must be used within ReminderStateProvider');
  }
  return context;
}
