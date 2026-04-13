import type {
  ReminderHistoryEntry,
  ReminderPreferences,
  ReminderState,
  ReminderItem,
} from '@/src/domain/models/reminders';

export interface ReminderStore {
  getPreferences(): Promise<ReminderPreferences>;
  setPreferences(preferences: ReminderPreferences): Promise<void>;
  getState(): Promise<ReminderState>;
  setState(state: ReminderState): Promise<void>;
  upsertScheduled(reminders: ReminderItem[]): Promise<void>;
  appendHistory(entry: ReminderHistoryEntry): Promise<void>;
}
