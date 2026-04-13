import type { ReminderStore } from '@/src/application/ports/ReminderStore';
import {
  defaultReminderPreferences,
  defaultReminderState,
  type ReminderHistoryEntry,
  type ReminderItem,
  type ReminderPreferences,
  type ReminderState,
} from '@/src/domain/models/reminders';
import { readJson, storageKeys, writeJson } from '@/src/infrastructure/storage/PersistentStorage';

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

const sanitizeReminderState = (input: ReminderState): ReminderState => ({
  lastGeneratedAt:
    typeof input.lastGeneratedAt === 'string' && input.lastGeneratedAt
      ? input.lastGeneratedAt
      : undefined,
  scheduled: Array.isArray(input.scheduled) ? input.scheduled : [],
  history: Array.isArray(input.history) ? input.history : [],
});

export class PersistentReminderStore implements ReminderStore {
  async getPreferences(): Promise<ReminderPreferences> {
    const stored = await readJson<ReminderPreferences>(
      storageKeys.reminderPreferences,
      defaultReminderPreferences,
    );
    return sanitizePreferences(stored);
  }

  async setPreferences(preferences: ReminderPreferences): Promise<void> {
    await writeJson(storageKeys.reminderPreferences, sanitizePreferences(preferences));
  }

  async getState(): Promise<ReminderState> {
    const stored = await readJson<ReminderState>(storageKeys.reminderState, defaultReminderState());
    return sanitizeReminderState(stored);
  }

  async setState(state: ReminderState): Promise<void> {
    await writeJson(storageKeys.reminderState, sanitizeReminderState(state));
  }

  async upsertScheduled(reminders: ReminderItem[]): Promise<void> {
    const current = await this.getState();
    const existing = new Map(current.scheduled.map((item) => [item.id, item]));
    for (const reminder of reminders) {
      existing.set(reminder.id, reminder);
    }
    await this.setState({ ...current, scheduled: Array.from(existing.values()) });
  }

  async appendHistory(entry: ReminderHistoryEntry): Promise<void> {
    const current = await this.getState();
    await this.setState({ ...current, history: [...current.history, entry] });
  }
}
